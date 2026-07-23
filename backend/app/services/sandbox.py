"""Defensive client for the remote AgentTrust sandbox worker."""

import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

SANDBOX_HEALTH_TIMEOUT_SECONDS = 3
FALLBACK_STDERR = "Sandbox worker unreachable. System operating in local fallback mode."
DESKTOP_CONTAINER_IMAGE = "agenttrust/desktop-environment:latest"
DESKTOP_CONTAINER_USER = "agentuser"
DESKTOP_CONTAINER_WORKDIR = "/home/agentuser/workspace"
DESKTOP_DISPLAY = ":1"
DESKTOP_VNC_PORT = 5901
DESKTOP_WEBSOCKET_PORT = 6080
DESKTOP_SCREEN_GEOMETRY = "1920x1080x24"
DESKTOP_CPU_LIMIT = "2.0"
DESKTOP_MEMORY_LIMIT = "4g"
DESKTOP_STORAGE_LIMIT = "10G"


@dataclass(frozen=True)
class DesktopContainerConfig:
    """Static defaults for the interactive desktop image used by later orchestration."""

    image: str = DESKTOP_CONTAINER_IMAGE
    user: str = DESKTOP_CONTAINER_USER
    workdir: str = DESKTOP_CONTAINER_WORKDIR
    display: str = DESKTOP_DISPLAY
    vnc_port: int = DESKTOP_VNC_PORT
    websocket_port: int = DESKTOP_WEBSOCKET_PORT
    screen_geometry: str = DESKTOP_SCREEN_GEOMETRY
    cpu_limit: str = DESKTOP_CPU_LIMIT
    memory_limit: str = DESKTOP_MEMORY_LIMIT
    storage_limit: str = DESKTOP_STORAGE_LIMIT

    def environment(self, *, session_token: str | None = None) -> dict[str, str]:
        env = {
            "DISPLAY": self.display,
            "VNC_PORT": str(self.vnc_port),
            "NO_VNC_PORT": str(self.websocket_port),
            "SCREEN_GEOMETRY": self.screen_geometry,
        }
        if session_token:
            env["AGENTTRUST_DESKTOP_TOKEN"] = session_token
        return env


def get_desktop_container_config() -> DesktopContainerConfig:
    """Return desktop container defaults without spawning or mutating runtime state."""
    return DesktopContainerConfig()


def _sandbox_worker_url(worker_url: str | None = None) -> str:
    return str(worker_url or settings.SANDBOX_WORKER_URL or "http://localhost:8001").rstrip("/")


def _fallback_payload() -> dict[str, Any]:
    return {
        "exit_code": 1,
        "stdout": "",
        "stderr": FALLBACK_STDERR,
        "action_log": [],
        "execution_time_ms": 0,
        "is_fallback": True,
    }


async def check_sandbox_health(worker_url: str | None = None) -> bool:
    """Return True only when the configured worker responds with HTTP 200."""
    try:
        async with httpx.AsyncClient(timeout=SANDBOX_HEALTH_TIMEOUT_SECONDS) as client:
            response = await client.get(f"{_sandbox_worker_url(worker_url)}/health")
        return response.status_code == 200
    except Exception:
        return False


def _coerce_execution_time_ms(value: Any, *, value_is_ms: bool = False) -> int:
    if value is None:
        return 0
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return 0

    if numeric_value < 0:
        return 0
    if not value_is_ms:
        return int(round(numeric_value * 1000))
    return int(round(numeric_value))


def _coerce_exit_code(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 1


def _standardize_worker_result(result: dict[str, Any]) -> dict[str, Any]:
    action_log = result.get("action_log")
    has_execution_time_ms = "execution_time_ms" in result
    exit_code = _coerce_exit_code(result.get("exit_code"))
    status = str(result.get("status") or "").lower()
    if not status:
        status = "success" if exit_code == 0 else "failure"

    return {
        "exit_code": exit_code,
        "stdout": str(result.get("stdout") or ""),
        "stderr": str(result.get("stderr") or ""),
        "action_log": action_log if isinstance(action_log, list) else [],
        "execution_time_ms": _coerce_execution_time_ms(
            result.get("execution_time_ms", result.get("execution_time")),
            value_is_ms=has_execution_time_ms,
        ),
        "is_fallback": bool(result.get("is_fallback", False)),
        "final_output": str(result.get("final_output") or ""),
        "status": status,
    }


async def execute_in_sandbox(
    image: str,
    command: str | None,
    timeout: int,
    task_input: str,
    run_id: str | uuid.UUID | None = None,
    worker_url: str | None = None,
) -> dict[str, Any]:
    """Execute an agent through the worker, returning a safe structured fallback on failure."""
    if not await check_sandbox_health(worker_url):
        return _fallback_payload()

    normalized_run_id = str(run_id or uuid.uuid4())
    payload = {
        "image": image,
        "command": command,
        "timeout": timeout,
        "task_input": task_input,
        # Compatibility with the current AgentTrust worker contract.
        "run_id": normalized_run_id,
        "agent_image": image,
        "docker_command": command,
        "task": task_input,
        "timeout_seconds": timeout,
    }

    started_at = time.time()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout + 5)) as client:
            response = await client.post(f"{_sandbox_worker_url(worker_url)}/run", json=payload)
            response.raise_for_status()
        result = _standardize_worker_result(response.json())
        if result["execution_time_ms"] == 0:
            result["execution_time_ms"] = int(round((time.time() - started_at) * 1000))
        return result
    except Exception:
        return _fallback_payload()
