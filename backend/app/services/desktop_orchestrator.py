"""Docker lifecycle orchestration for interactive desktop containers."""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.run import Run
from app.services.sandbox import get_desktop_container_config

logger = logging.getLogger(__name__)

ACTIVE_DESKTOP_STATUSES = {"pending", "running", "stopping"}
DEFAULT_MAX_IDLE_MINUTES = 60
DEFAULT_STARTUP_TIMEOUT_SECONDS = 90
DESKTOP_LOG_POLL_SECONDS = 2
DESKTOP_LOG_MAX_CHARS = 120_000
_desktop_log_tail_tasks: dict[str, asyncio.Task[None]] = {}


class DesktopOrchestrationError(RuntimeError):
    """Raised when a desktop container lifecycle operation fails."""


def _docker_client():
    try:
        import docker
        from docker.errors import DockerException
    except Exception as exc:
        raise DesktopOrchestrationError(
            "Docker SDK is not installed. Install backend requirements before spawning desktops."
        ) from exc
    if not hasattr(docker, "from_env"):
        raise DesktopOrchestrationError(
            "Docker SDK is not available on Python path. Install backend requirements before spawning desktops."
        )

    try:
        client = docker.from_env()
        client.ping()
        return client
    except DockerException as exc:
        raise DesktopOrchestrationError("Docker daemon is unavailable") from exc


def _safe_container_name(run_id: str) -> str:
    safe_run_id = re.sub(r"[^a-zA-Z0-9_.-]", "-", str(run_id)).strip("-")
    if not safe_run_id:
        raise DesktopOrchestrationError("run_id cannot produce a valid container name")
    return f"agenttrust-desktop-{safe_run_id}"


def _decode_logs(raw_logs: bytes | str | None) -> str:
    if raw_logs is None:
        return ""
    if isinstance(raw_logs, bytes):
        return raw_logs.decode("utf-8", errors="replace")
    return str(raw_logs)


def _spawn_desktop_container_sync(
    run_id: str,
    vnc_password: str,
    vnc_port: int,
    websockify_port: int,
) -> dict[str, Any]:
    config = get_desktop_container_config()
    client = _docker_client()
    container_name = _safe_container_name(run_id)
    environment = config.environment(session_token=vnc_password)
    environment["VNC_PASSWORD"] = vnc_password
    environment["RESOLUTION"] = config.screen_geometry.rsplit("x", 1)[0]

    try:
        stale_container = client.containers.get(container_name)
        stale_container.remove(force=True)
    except Exception:
        pass

    try:
        started_at = datetime.now(timezone.utc)
        container = client.containers.run(
            image=config.image,
            detach=True,
            name=container_name,
            auto_remove=False,
            environment=environment,
            ports={
                f"{config.vnc_port}/tcp": ("127.0.0.1", int(vnc_port)),
                f"{config.websocket_port}/tcp": ("127.0.0.1", int(websockify_port)),
            },
            mem_limit=config.memory_limit,
            nano_cpus=int(float(config.cpu_limit) * 1_000_000_000),
            labels={
                "agenttrust.kind": "interactive-desktop",
                "agenttrust.run_id": str(run_id),
            },
        )
        container.reload()
    except Exception as exc:
        raise DesktopOrchestrationError(f"Failed to spawn desktop container: {exc}") from exc

    return {
        "container_id": container.id,
        "container_name": container_name,
        "status": container.status,
        "started_at": started_at,
        "vnc_port": int(vnc_port),
        "websockify_port": int(websockify_port),
    }


async def spawn_desktop_container(
    run_id: str,
    vnc_password: str,
    vnc_port: int,
    websockify_port: int,
) -> dict[str, Any]:
    """Spawn an interactive desktop container and return Docker metadata."""
    return await asyncio.to_thread(
        _spawn_desktop_container_sync,
        run_id,
        vnc_password,
        vnc_port,
        websockify_port,
    )


def _stop_desktop_container_sync(container_id: str, timeout: int = 10) -> bool:
    client = _docker_client()
    try:
        container = client.containers.get(container_id)
    except Exception:
        logger.info("Desktop container %s was already absent", container_id)
        return True

    try:
        container.stop(timeout=timeout)
    except Exception as exc:
        logger.warning("Graceful desktop container stop failed for %s: %s", container_id, exc)
        try:
            container.kill()
        except Exception as kill_exc:
            logger.warning("Force kill failed for desktop container %s: %s", container_id, kill_exc)

    try:
        container.remove(force=True, v=True)
        return True
    except Exception as exc:
        raise DesktopOrchestrationError(f"Failed to remove desktop container {container_id}: {exc}") from exc


async def stop_desktop_container(container_id: str, timeout: int = 10) -> bool:
    """Gracefully stop and remove a desktop container."""
    return await asyncio.to_thread(_stop_desktop_container_sync, container_id, timeout)


def _get_container_status_sync(container_id: str) -> dict[str, Any]:
    client = _docker_client()
    try:
        container = client.containers.get(container_id)
        container.reload()
        attrs = container.attrs
        state = attrs.get("State", {})
        return {
            "container_id": container.id,
            "name": container.name,
            "status": container.status,
            "running": bool(state.get("Running")),
            "paused": bool(state.get("Paused")),
            "restarting": bool(state.get("Restarting")),
            "dead": bool(state.get("Dead")),
            "exit_code": state.get("ExitCode"),
            "started_at": state.get("StartedAt"),
            "finished_at": state.get("FinishedAt"),
            "logs": _decode_logs(container.logs(tail=50)),
        }
    except Exception as exc:
        raise DesktopOrchestrationError(f"Failed to inspect desktop container {container_id}: {exc}") from exc


async def get_container_status(container_id: str) -> dict[str, Any]:
    """Inspect Docker state and recent logs for a desktop container."""
    return await asyncio.to_thread(_get_container_status_sync, container_id)


def _read_container_logs_sync(container_id: str, tail: int | str = "all") -> str:
    client = _docker_client()
    container = client.containers.get(container_id)
    return _decode_logs(container.logs(stdout=True, stderr=True, tail=tail))


async def refresh_desktop_container_logs(
    container_id: str,
    run_id: str,
    *,
    tail: int | str = "all",
) -> str:
    """Persist the latest Docker logs for an interactive desktop run."""
    logs = await asyncio.to_thread(_read_container_logs_sync, container_id, tail)
    if len(logs) > DESKTOP_LOG_MAX_CHARS:
        logs = logs[-DESKTOP_LOG_MAX_CHARS:]

    async with async_session() as db:
        result = await db.execute(select(Run).where(Run.id == uuid.UUID(str(run_id))))
        run = result.scalar_one_or_none()
        if not run:
            return logs
        run.container_stdout = logs
        db.add(run)
        await db.commit()
    return logs


async def capture_desktop_container_logs(
    container_id: str,
    *,
    tail: int | str = "all",
) -> str:
    """Read Docker logs without writing to the database."""
    logs = await asyncio.to_thread(_read_container_logs_sync, container_id, tail)
    if len(logs) > DESKTOP_LOG_MAX_CHARS:
        return logs[-DESKTOP_LOG_MAX_CHARS:]
    return logs


async def _tail_container_logs(container_id: str, run_id: str) -> None:
    """Poll Docker logs into the run record while the desktop container is active."""
    try:
        while True:
            try:
                await refresh_desktop_container_logs(container_id, run_id, tail=500)
                status_snapshot = await get_container_status(container_id)
                if not status_snapshot.get("running"):
                    return
            except Exception as exc:
                logger.info("Desktop log tail stopped for run %s: %s", run_id, exc)
                return
            await asyncio.sleep(DESKTOP_LOG_POLL_SECONDS)
    finally:
        _desktop_log_tail_tasks.pop(str(run_id), None)


def start_desktop_log_tail(container_id: str, run_id: str) -> None:
    """Start one in-process background Docker log tailer per run."""
    key = str(run_id)
    existing = _desktop_log_tail_tasks.get(key)
    if existing and not existing.done():
        return
    try:
        _desktop_log_tail_tasks[key] = asyncio.create_task(
            _tail_container_logs(container_id, key)
        )
    except RuntimeError:
        logger.warning("No running event loop available to tail desktop logs for run %s", run_id)


async def wait_for_desktop_readiness(
    container_id: str,
    timeout_seconds: int = DEFAULT_STARTUP_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Poll container logs until the desktop entrypoint reports readiness."""
    deadline = time.monotonic() + timeout_seconds
    last_status: dict[str, Any] | None = None

    while time.monotonic() < deadline:
        last_status = await get_container_status(container_id)
        logs = str(last_status.get("logs") or "")
        if "AgentTrust desktop environment is ready" in logs:
            return last_status
        if last_status.get("status") in {"exited", "dead"}:
            raise DesktopOrchestrationError("Desktop container exited before readiness")
        await asyncio.sleep(1)

    # Container is still running but didn't emit the readiness string in time.
    # If the container is alive we treat it as ready rather than failing the run.
    if last_status and last_status.get("running"):
        logger.warning(
            "Desktop container %s did not emit readiness signal within %ds — "
            "container is running, treating as ready.",
            container_id,
            timeout_seconds,
        )
        return last_status
    raise DesktopOrchestrationError(
        f"Desktop container did not become ready within {timeout_seconds}s"
    )


async def prune_stale_containers(
    db: AsyncSession,
    max_idle_minutes: int = DEFAULT_MAX_IDLE_MINUTES,
) -> list[str]:
    """Stop abandoned interactive desktop containers based on run heartbeat age."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_idle_minutes)
    result = await db.execute(
        select(Run).where(
            Run.is_interactive.is_(True),
            Run.container_id.is_not(None),
            Run.desktop_status.in_(ACTIVE_DESKTOP_STATUSES),
            Run.last_heartbeat < cutoff,
        )
    )
    stale_runs = result.scalars().all()
    stopped_container_ids: list[str] = []

    for run in stale_runs:
        if not run.container_id:
            continue
        try:
            await stop_desktop_container(run.container_id)
            stopped_container_ids.append(run.container_id)
            run.desktop_status = "stopped"
            run.status = "failure" if run.status == "pending" else run.status
            db.add(run)
        except Exception as exc:
            logger.warning("Failed pruning desktop container for run %s: %s", run.id, exc)
            run.desktop_status = "failed"
            db.add(run)

    if stale_runs:
        await db.flush()

    return stopped_container_ids
