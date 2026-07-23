"""Cleanup routines for abandoned interactive desktop sessions."""

from __future__ import annotations

import logging
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.run import Run
from app.services.desktop_orchestrator import (
    DesktopOrchestrationError,
    stop_desktop_container,
)
from app.services.port_manager import release_desktop_ports

logger = logging.getLogger(__name__)

ACTIVE_DESKTOP_STATUSES = ("pending", "running")
DEFAULT_CLEANUP_INTERVAL_SECONDS = 60


async def cleanup_idle_desktop_sessions(
    db_session: AsyncSession,
    max_idle_seconds: int = 600,
    max_lifetime_seconds: int = 14400,
) -> int:
    """Stop interactive desktop containers that exceeded idle or lifetime limits."""
    now = datetime.now(timezone.utc)
    idle_cutoff = now - timedelta(seconds=max_idle_seconds)
    lifetime_cutoff = now - timedelta(seconds=max_lifetime_seconds)

    result = await db_session.execute(
        select(Run).where(
            Run.is_interactive.is_(True),
            Run.desktop_status.in_(ACTIVE_DESKTOP_STATUSES),
            or_(
                Run.last_heartbeat < idle_cutoff,
                and_(Run.last_heartbeat.is_(None), Run.created_at < idle_cutoff),
                Run.created_at < lifetime_cutoff,
            ),
        )
    )
    stale_runs = result.scalars().all()
    cleaned_count = 0

    for run in stale_runs:
        try:
            if run.container_id:
                await stop_desktop_container(run.container_id)
            await release_desktop_ports(run.vnc_port, run.websockify_port)
            run.desktop_status = "timed_out"
            run.last_heartbeat = now
            db_session.add(run)
            cleaned_count += 1
        except DesktopOrchestrationError as exc:
            logger.warning("Failed to clean up desktop run %s: %s", run.id, exc)
            run.desktop_status = "failed"
            db_session.add(run)

    if stale_runs:
        await db_session.flush()

    return cleaned_count


async def run_desktop_cleanup_loop(
    stop_event: asyncio.Event,
    *,
    interval_seconds: int = DEFAULT_CLEANUP_INTERVAL_SECONDS,
    max_idle_seconds: int = 600,
    max_lifetime_seconds: int = 14400,
) -> None:
    """Periodically clean idle desktop sessions until application shutdown."""
    while not stop_event.is_set():
        try:
            async with async_session() as db_session:
                cleaned_count = await cleanup_idle_desktop_sessions(
                    db_session,
                    max_idle_seconds=max_idle_seconds,
                    max_lifetime_seconds=max_lifetime_seconds,
                )
                await db_session.commit()
                if cleaned_count:
                    logger.info("Cleaned up %s idle desktop session(s)", cleaned_count)
        except Exception:
            logger.exception("Desktop cleanup loop failed; retrying on next interval")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            pass
