"""Interactive desktop session lifecycle endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
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
    stop_desktop_container,
)
from app.services.port_manager import release_desktop_ports

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
    run.last_heartbeat = datetime.now(timezone.utc)
    db.add(run)
    await db.flush()

    return DesktopStopResponse(
        status="ok",
        desktop_status=run.desktop_status,
        container_stopped=container_stopped,
    )
