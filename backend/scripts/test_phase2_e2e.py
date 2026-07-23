"""Live Phase 2 orchestration smoke test for AWS EC2.

Run from the repository root after installing backend requirements:
    python backend/scripts/test_phase2_e2e.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import async_session, engine  # noqa: E402
from app.services.desktop_orchestrator import (  # noqa: E402
    DesktopOrchestrationError,
    get_container_status,
    spawn_desktop_container,
    stop_desktop_container,
    wait_for_desktop_readiness,
)
from app.services.port_manager import (  # noqa: E402
    allocate_desktop_ports,
    generate_desktop_session_token,
    is_port_in_use_socket,
    release_desktop_ports,
)


TEST_RUN_ID = "test-e2e-phase2"
READINESS_TIMEOUT_SECONDS = 30


def print_section(title: str) -> None:
    print(f"\n=== {title} ===", flush=True)


def assert_condition(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


async def main() -> int:
    container_id: str | None = None
    vnc_port: int | None = None
    websockify_port: int | None = None

    try:
        print_section("Database and Port Allocation")
        async with async_session() as db:
            vnc_port, websockify_port = await allocate_desktop_ports(db)
            print(f"Allocated VNC port: {vnc_port}", flush=True)
            print(f"Allocated websockify port: {websockify_port}", flush=True)

        token = generate_desktop_session_token()
        print(f"Generated session token length: {len(token)}", flush=True)
        assert_condition(len(token) >= 32, "Session token is shorter than expected")

        print_section("Spawn Desktop Container")
        metadata = await spawn_desktop_container(
            TEST_RUN_ID,
            token,
            vnc_port,
            websockify_port,
        )
        container_id = str(metadata["container_id"])
        print(f"Container ID: {container_id}", flush=True)
        print(f"Initial Docker status: {metadata.get('status')}", flush=True)
        assert_condition(bool(container_id), "Container ID was not returned")

        print_section("Readiness Check")
        readiness = await wait_for_desktop_readiness(
            container_id,
            timeout_seconds=READINESS_TIMEOUT_SECONDS,
        )
        print(f"Ready status: {readiness.get('status')}", flush=True)
        assert_condition(
            readiness.get("status") == "running",
            f"Expected running status after readiness, got {readiness.get('status')}",
        )

        logs = str(readiness.get("logs") or "")
        for marker in (
            "Starting Xvfb",
            "Starting x11vnc",
            "Starting websockify",
            "AgentTrust desktop environment is ready",
        ):
            assert_condition(marker in logs, f"Container logs missing marker: {marker}")

        print_section("Container Status and Logs")
        status = await get_container_status(container_id)
        print(f"Running: {status.get('running')}", flush=True)
        print(f"Paused: {status.get('paused')}", flush=True)
        print(f"Restarting: {status.get('restarting')}", flush=True)
        print(f"Dead: {status.get('dead')}", flush=True)
        print("\n--- Tail Logs ---", flush=True)
        print(status.get("logs") or "(empty)", flush=True)
        assert_condition(status.get("running") is True, "Container is not running")

        print_section("Port Bind Checks")
        assert_condition(
            is_port_in_use_socket(vnc_port),
            f"VNC host port {vnc_port} is not bound",
        )
        assert_condition(
            is_port_in_use_socket(websockify_port),
            f"websockify host port {websockify_port} is not bound",
        )
        print("Host ports are bound while container is running.", flush=True)

        return 0
    except Exception as exc:
        print_section("Failure")
        print(f"{type(exc).__name__}: {exc}", flush=True)
        return 1
    finally:
        print_section("Cleanup")
        if container_id:
            try:
                stopped = await stop_desktop_container(container_id)
                print(f"Container stopped and removed: {stopped}", flush=True)
            except DesktopOrchestrationError as exc:
                print(f"Container cleanup failed: {exc}", flush=True)
        if vnc_port or websockify_port:
            await release_desktop_ports(vnc_port, websockify_port)
            print("Released in-process port reservations.", flush=True)
            print(
                f"VNC port {vnc_port} in use after cleanup: "
                f"{is_port_in_use_socket(vnc_port) if vnc_port else 'n/a'}",
                flush=True,
            )
            print(
                f"websockify port {websockify_port} in use after cleanup: "
                f"{is_port_in_use_socket(websockify_port) if websockify_port else 'n/a'}",
                flush=True,
            )
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
