"""Interactive desktop session lifecycle endpoints."""

from __future__ import annotations

import uuid
import asyncio
import logging
from datetime import datetime, timezone

import websockets
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from websockets.exceptions import ConnectionClosed

from app.database import async_session, get_db
from app.dependencies import get_current_user
from app.models.run import Run
from app.models.user import User
from app.schemas.sandbox import (
    DesktopConnectInfoResponse,
    DesktopHeartbeatResponse,
    DesktopSessionStatusResponse,
    DesktopStopResponse,
)
from app.services.desktop_orchestrator import (
    DesktopOrchestrationError,
    capture_desktop_container_logs,
    stop_desktop_container,
)
from app.services.port_manager import release_desktop_ports

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/desktop", tags=["Desktop Sessions"])


async def _get_owned_interactive_run(
    db: AsyncSession,
    run_id: uuid.UUID,
    current_user: User,
) -> Run:
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run or not run.is_interactive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interactive desktop session not found",
        )
    if run.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access another user's desktop session",
        )
    return run


@router.get("/{run_id}/status", response_model=DesktopSessionStatusResponse)
async def get_desktop_status(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch interactive desktop lifecycle state for an owned run."""
    run = await _get_owned_interactive_run(db, run_id, current_user)
    return DesktopSessionStatusResponse(
        run_id=run.id,
        desktop_status=run.desktop_status,
        vnc_port=run.vnc_port,
        websockify_port=run.websockify_port,
        container_id=run.container_id,
        created_at=run.created_at,
        last_heartbeat=run.last_heartbeat,
    )


@router.get("/{run_id}/connect-info", response_model=DesktopConnectInfoResponse)
async def get_desktop_connect_info(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return noVNC connection metadata for the authenticated session owner."""
    run = await _get_owned_interactive_run(db, run_id, current_user)
    return DesktopConnectInfoResponse(
        run_id=run.id,
        websockify_port=run.websockify_port,
        session_token=run.session_token,
        status=run.desktop_status,
    )


@router.post("/{run_id}/heartbeat", response_model=DesktopHeartbeatResponse)
async def heartbeat_desktop_session(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refresh activity timestamp for an owned interactive desktop session."""
    run = await _get_owned_interactive_run(db, run_id, current_user)
    now = datetime.now(timezone.utc)
    run.last_heartbeat = now
    db.add(run)
    await db.flush()
    return DesktopHeartbeatResponse(last_heartbeat=now)


@router.post("/{run_id}/stop", response_model=DesktopStopResponse)
async def stop_desktop_session(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop and release resources for an owned interactive desktop session."""
    run = await _get_owned_interactive_run(db, run_id, current_user)
    run.desktop_status = "stopping"
    db.add(run)
    await db.flush()

    container_stopped = True
    if run.container_id:
        try:
            run.container_stdout = await capture_desktop_container_logs(run.container_id, tail=500)
        except DesktopOrchestrationError as exc:
            logger.warning("Final desktop log capture failed for run %s: %s", run.id, exc)
        try:
            container_stopped = await stop_desktop_container(run.container_id)
        except DesktopOrchestrationError as exc:
            run.desktop_status = "failed"
            db.add(run)
            await db.flush()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Desktop container could not be stopped.",
            ) from exc

    await release_desktop_ports(run.vnc_port, run.websockify_port)
    run.desktop_status = "stopped"
    run.status = "success"
    run.response = "Interactive desktop session completed successfully."
    run.last_heartbeat = datetime.now(timezone.utc)
    if run.created_at:
        created_at = run.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        run.execution_time = round((run.last_heartbeat - created_at).total_seconds(), 4)
    next_step = len(run.action_log or []) + 1
    run.action_log = [
        *(run.action_log or []),
        {
            "step": next_step,
            "action": "Interactive desktop session stopped",
            "target": run.container_id or "desktop-container",
            "status": "success",
            "note": "Container stopped by session owner.",
        },
    ]
    db.add(run)
    await db.flush()

    return DesktopStopResponse(
        status="ok",
        desktop_status=run.desktop_status,
        container_stopped=container_stopped,
    )


def _select_websocket_subprotocol(header_value: str | None) -> str | None:
    if not header_value:
        return None
    requested_protocols = [value.strip() for value in header_value.split(",")]
    for protocol in ("binary", "base64"):
        if protocol in requested_protocols:
            return protocol
    return None


async def _get_proxy_run(run_id: uuid.UUID) -> Run | None:
    async with async_session() as db:
        result = await db.execute(select(Run).where(Run.id == run_id))
        return result.scalar_one_or_none()


@router.websocket("/ws/{run_id}")
async def desktop_websocket_proxy(
    websocket: WebSocket,
    run_id: uuid.UUID,
    token: str = Query(...),
):
    """Proxy authenticated browser noVNC traffic to localhost-bound websockify."""
    subprotocol = _select_websocket_subprotocol(
        websocket.headers.get("sec-websocket-protocol")
    )
    await websocket.accept(subprotocol=subprotocol)

    run = await _get_proxy_run(run_id)
    if not run or not run.is_interactive:
        await websocket.close(code=4004)
        return
    if run.session_token != token or run.desktop_status != "running":
        await websocket.close(code=4003)
        return
    if not run.websockify_port:
        await websocket.close(code=4004)
        return

    internal_url = f"ws://127.0.0.1:{int(run.websockify_port)}"
    internal_protocols = [subprotocol] if subprotocol else None

    async def browser_to_container(container_ws):
        try:
            while True:
                message = await websocket.receive()
                message_type = message.get("type")
                if message_type == "websocket.disconnect":
                    return
                if "bytes" in message and message["bytes"] is not None:
                    await container_ws.send(message["bytes"])
                elif "text" in message and message["text"] is not None:
                    await container_ws.send(message["text"])
        except (WebSocketDisconnect, ConnectionClosed):
            return

    async def container_to_browser(container_ws):
        try:
            async for message in container_ws:
                if isinstance(message, bytes):
                    await websocket.send_bytes(message)
                else:
                    await websocket.send_text(message)
        except (WebSocketDisconnect, ConnectionClosed, RuntimeError):
            return

    try:
        async with websockets.connect(
            internal_url,
            subprotocols=internal_protocols,
            max_size=None,
        ) as container_ws:
            tasks = {
                asyncio.create_task(browser_to_container(container_ws)),
                asyncio.create_task(container_to_browser(container_ws)),
            }
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                task.result()
    except Exception as exc:
        logger.warning("Desktop WebSocket proxy failed for run %s: %s", run_id, exc)
        try:
            await websocket.close(code=1011)
        except RuntimeError:
            pass
