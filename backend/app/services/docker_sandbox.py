"""Local Docker sandbox runner for external AgentTrust agents."""

import asyncio
import json
import logging
import shlex
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.models.agent import Agent

IGNORED_COMMAND_OVERRIDES = {
    "leave",
    "leave empty",
    "blank",
    "empty",
    "none",
    "null",
    "n/a",
    "default",
    "image cmd",
    "use image cmd",
    "leave blank",
    "leave blank to use the image cmd",
}

logger = logging.getLogger(__name__)

MAX_CAPTURE_CHARS = 20000
MAX_MEMORY = "256m"
MAX_CPUS = "0.5"
MAX_PIDS = "50"
TMPFS_LIMIT = "64m"


@dataclass
class DockerExecutionResult:
    final_output: str
    action_log: list[dict]
    stdout: str
    stderr: str
    exit_code: int | None
    status: str
    execution_time: float


def _truncate(value: str) -> str:
    if len(value) <= MAX_CAPTURE_CHARS:
        return value
    return value[:MAX_CAPTURE_CHARS] + "\n...[truncated]"


def _normalize_action_log(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []

    entries: list[dict] = []
    for index, item in enumerate(value, start=1):
        if isinstance(item, dict):
            entries.append(
                {
                    "step": item.get("step") or index,
                    "action": str(item.get("action") or "Agent action"),
                    "target": str(item.get("target") or "external_docker"),
                    "status": str(item.get("status") or "success"),
                    "note": str(item.get("note") or ""),
                }
            )
        else:
            entries.append(
                {
                    "step": index,
                    "action": "Agent action",
                    "target": "external_docker",
                    "status": "success",
                    "note": str(item),
                }
            )
    return entries


def _read_json(path: Path) -> object | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Could not parse Docker agent JSON file %s: %s", path, exc)
        return None


async def execute_docker_agent(agent: Agent, run_id: uuid.UUID, task: str) -> DockerExecutionResult:
    """Execute an external Docker agent using the AgentTrust file contract."""
    if not agent.docker_image:
        raise ValueError("Docker image is not configured for this agent")

    timeout_seconds = agent.timeout_seconds or 60

    with tempfile.TemporaryDirectory(prefix=f"agenttrust-{run_id}-") as temp_dir:
        run_dir = Path(temp_dir)
        input_path = run_dir / "input.json"
        output_path = run_dir / "output.json"
        action_log_path = run_dir / "action_log.json"

        input_path.write_text(
            json.dumps({"run_id": str(run_id), "task": task}, ensure_ascii=False),
            encoding="utf-8",
        )

        command = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--cpus",
            MAX_CPUS,
            "--memory",
            MAX_MEMORY,
            "--memory-swap",
            MAX_MEMORY,
            "--pids-limit",
            MAX_PIDS,
            "--read-only",
            "--tmpfs",
            f"/tmp:rw,noexec,nosuid,size={TMPFS_LIMIT}",
            "-v",
            f"{run_dir}:/agenttrust:rw",
            "-e",
            "AGENTTRUST_INPUT=/agenttrust/input.json",
            "-e",
            "AGENTTRUST_OUTPUT=/agenttrust/output.json",
            "-e",
            "AGENTTRUST_ACTION_LOG=/agenttrust/action_log.json",
            "-e",
            f"AGENTTRUST_RUN_ID={run_id}",
            agent.docker_image,
        ]

        docker_command = (agent.docker_command or "").strip()
        if docker_command and docker_command.lower() not in IGNORED_COMMAND_OVERRIDES:
            command.extend(shlex.split(docker_command))

        start_time = time.time()
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout_seconds,
            )
            timed_out = False
        except asyncio.TimeoutError:
            process.kill()
            stdout_bytes, stderr_bytes = await process.communicate()
            timed_out = True

        execution_time = round(time.time() - start_time, 4)
        stdout = _truncate(stdout_bytes.decode("utf-8", errors="replace"))
        stderr = _truncate(stderr_bytes.decode("utf-8", errors="replace"))
        exit_code = process.returncode

        output_json = _read_json(output_path)
        action_json = _read_json(action_log_path)

        final_output = ""
        contract_status: str | None = None
        if isinstance(output_json, dict):
            final_output = str(
                output_json.get("final_output")
                or output_json.get("output")
                or output_json.get("response")
                or ""
            )
            raw_status = output_json.get("status")
            contract_status = str(raw_status) if raw_status is not None else None

        if not final_output:
            final_output = stdout.strip() or stderr.strip() or "Docker agent produced no output."

        action_log = _normalize_action_log(action_json)
        action_log.extend(
            [
                {
                    "step": len(action_log) + 1,
                    "action": "Docker sandbox completed",
                    "target": agent.docker_image,
                    "status": "failure" if timed_out or exit_code else "success",
                    "note": f"exit_code={exit_code}, duration={execution_time:.2f}s",
                },
                {
                    "step": len(action_log) + 2,
                    "action": "Captured stdout",
                    "target": "container_stdout",
                    "status": "success",
                    "note": stdout or "(empty)",
                },
            ]
        )
        if stderr:
            action_log.append(
                {
                    "step": len(action_log) + 1,
                    "action": "Captured stderr",
                    "target": "container_stderr",
                    "status": "failure" if exit_code else "success",
                    "note": stderr,
                }
            )

        status = "success"
        if timed_out:
            status = "failure"
            final_output = f"Docker execution timed out after {timeout_seconds}s."
        elif exit_code == 137:
            status = "failure"
            final_output = (
                "CRITICAL ERROR: Resource isolation boundary triggered. "
                f"The sandbox agent container exceeded its allocated memory limit ({MAX_MEMORY}) "
                "or was forcefully terminated by the runtime manager."
            )
        elif exit_code != 0:
            status = "failure"
        elif contract_status and contract_status.lower() not in {"success", "ok", "completed"}:
            status = "failure"

        return DockerExecutionResult(
            final_output=final_output,
            action_log=action_log,
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            status=status,
            execution_time=execution_time,
        )
