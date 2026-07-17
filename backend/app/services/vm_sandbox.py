"""HTTP client for a decoupled AgentTrust sandbox worker VM."""

import logging
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from app.models.agent import Agent
from app.schemas.agent import normalize_docker_command

logger = logging.getLogger(__name__)

MAX_CAPTURE_CHARS = 20000
OOM_EXIT_CODE = 137
OOM_FINAL_OUTPUT = (
    "CRITICAL ERROR: Resource isolation boundary fractured. "
    "The sandbox agent container exceeded its allocated memory allocation limit (256MB) "
    "and was forcefully terminated by the system runtime manager."
)


@dataclass
class VmSandboxExecutionResult:
    final_output: str
    action_log: list[dict]
    stdout: str
    stderr: str
    exit_code: int | None
    status: str
    execution_time: float


class VMSandboxService:
    """Raw HTTP proxy for diagnostics and cloud connectivity checks."""

    def __init__(self, worker_url: str | None = None) -> None:
        from app.config import settings

        self.worker_url = (worker_url or settings.SANDBOX_WORKER_URL or "").rstrip("/")
        if not self.worker_url:
            raise ValueError("SANDBOX_WORKER_URL is not configured")

    async def execute_remote_run(self, payload: dict[str, Any]) -> dict[str, Any]:
        timeout_seconds = int(payload.get("timeout_seconds") or 60)
        endpoint = f"{self.worker_url}/run"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds + 5)) as client:
                response = await client.post(endpoint, json=payload)
                response.raise_for_status()
                result = _inspect_exit_state(response.json())
                result["routing_mode"] = "cloud_sandbox"
                result["worker_url"] = self.worker_url
                return result
        except httpx.TimeoutException:
            return {
                "status": "failure",
                "routing_mode": "cloud_sandbox",
                "worker_url": self.worker_url,
                "stdout": "",
                "stderr": "Sandbox worker request timed out",
                "exit_code": 503,
                "execution_time": float(timeout_seconds + 5),
                "final_output": f"Remote sandbox worker timed out after {timeout_seconds + 5}s client safety window.",
                "action_log": [
                    {
                        "step": 1,
                        "action": "Remote worker timeout circuit breaker",
                        "target": endpoint,
                        "status": "failure",
                        "note": f"Client timeout={timeout_seconds + 5}s",
                    }
                ],
            }


def _inspect_exit_state(raw_result: dict[str, Any]) -> dict[str, Any]:
    """
    Inspects container exit status codes against known kernel termination flags.
    """
    exit_code = raw_result.get("exit_code")

    if exit_code == OOM_EXIT_CODE:
        raw_result["status"] = "failure"
        raw_result["final_output"] = OOM_FINAL_OUTPUT
        raw_result["exit_code"] = OOM_EXIT_CODE

    return raw_result


def _truncate(value: str) -> str:
    if len(value) <= MAX_CAPTURE_CHARS:
        return value
    return value[:MAX_CAPTURE_CHARS] + "\n...[truncated]"


def _normalize_action_log(value: Any) -> list[dict]:
    if not isinstance(value, list):
        return [
            {
                "step": 1,
                "action": "Worker response normalized",
                "target": "action_log",
                "status": "success",
                "note": "Sandbox worker returned no structured action log.",
            }
        ]

    entries: list[dict] = []
    for index, item in enumerate(value, start=1):
        if isinstance(item, dict):
            entries.append(
                {
                    "step": int(item.get("step") or index),
                    "action": str(item.get("action") or "Agent action"),
                    "target": str(item.get("target") or "external_agent"),
                    "status": str(item.get("status") or "success"),
                    "note": str(item.get("note") or ""),
                }
            )
        else:
            entries.append(
                {
                    "step": index,
                    "action": "Agent action",
                    "target": "external_agent",
                    "status": "success",
                    "note": str(item),
                }
            )
    return entries


def _with_cloud_routing_entry(
    action_log: list[dict],
    *,
    worker_url: str,
    agent_image: str,
    exit_code: int | None,
    execution_time: float,
) -> list[dict]:
    routing_entry = {
        "step": 1,
        "action": "Routed through cloud sandbox worker",
        "target": worker_url.rstrip("/"),
        "status": "success" if exit_code == 0 else "failure",
        "note": (
            f"routing_mode=cloud_sandbox, agent_image={agent_image}, "
            f"exit_code={exit_code}, execution_span_seconds={execution_time:.4f}"
        ),
    }

    normalized = []
    for index, item in enumerate(action_log, start=2):
        copied = dict(item)
        copied["step"] = index
        normalized.append(copied)

    return [routing_entry, *normalized]


async def execute_vm_sandbox_agent(
    worker_url: str,
    agent: Agent,
    run_id: uuid.UUID,
    task: str,
) -> VmSandboxExecutionResult:
    """Execute an external agent through the decoupled sandbox worker HTTP API."""
    if not agent.docker_image:
        raise ValueError("Docker image is not configured for this agent")

    timeout_seconds = agent.timeout_seconds or 60
    request_timeout = timeout_seconds + 5
    payload = {
        "run_id": str(run_id),
        "agent_image": agent.docker_image,
        "docker_command": normalize_docker_command(agent.docker_command),
        "task": task,
        "timeout_seconds": timeout_seconds,
    }

    endpoint = f"{worker_url.rstrip('/')}/run"
    async with httpx.AsyncClient(timeout=httpx.Timeout(request_timeout)) as client:
        response = await client.post(endpoint, json=payload)
        response.raise_for_status()
        data = _inspect_exit_state(response.json())
        data["routing_mode"] = "cloud_sandbox"
        data["worker_url"] = worker_url.rstrip("/")

    stdout = _truncate(str(data.get("stdout") or ""))
    stderr = _truncate(str(data.get("stderr") or ""))
    exit_code = data.get("exit_code")
    if exit_code is not None:
        try:
            exit_code = int(exit_code)
        except (TypeError, ValueError):
            exit_code = None

    status_value = str(data.get("status") or "").lower()
    status = "success" if status_value == "success" and exit_code == 0 else "failure"
    final_output = str(data.get("final_output") or "").strip()
    if not final_output:
        final_output = stdout.strip() or stderr.strip() or "Sandbox worker returned no output."

    try:
        execution_time = round(float(data.get("execution_time") or 0), 4)
    except (TypeError, ValueError):
        execution_time = 0.0
    action_log = _with_cloud_routing_entry(
        _normalize_action_log(data.get("action_log")),
        worker_url=worker_url,
        agent_image=agent.docker_image,
        exit_code=exit_code,
        execution_time=execution_time,
    )

    return VmSandboxExecutionResult(
        final_output=final_output,
        action_log=action_log,
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        status=status,
        execution_time=execution_time,
    )
