"""
Execution API endpoints: execute agents, list/view runs.
"""

import asyncio
import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DatabaseError, InterfaceError, OperationalError, SQLAlchemyError

try:
    from asyncpg.exceptions import PostgresError
except ImportError:  # pragma: no cover
    class PostgresError(Exception):
        """Fallback if asyncpg is not directly imported."""
        pass

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.run import ExecuteRequest, RunResponse, RunListResponse
from app.services import execution_service
from app.services.auth_service import decode_token
from app.rate_limit import limiter, execution_rate_limit_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Executions"])


@router.post("/execute", response_model=RunResponse, status_code=201)
@limiter.limit("10/minute", key_func=execution_rate_limit_key)
async def execute(
    request: Request,
    data: ExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute an AI agent with a task. Triggers the full execution pipeline."""
    return await execution_service.execute_agent(
        db,
        data.agent_id,
        current_user.id,
        data.task,
        is_interactive=data.is_interactive,
        vnc_port=data.vnc_port,
        websockify_port=data.websockify_port,
    )


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a specific execution record."""
    return await execution_service.get_run(db, run_id, current_user.id)


@router.get("/runs/{run_id}/stream")
@router.get("/v1/runs/{run_id}/stream")
async def stream_run(
    run_id: uuid.UUID,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    """Stream execution snapshots as SSE for the live sandbox console."""
    current_user_id = None
    raw_token = credentials.credentials if credentials else token
    if raw_token:
        try:
            payload = decode_token(raw_token)
            current_user_id = uuid.UUID(payload["sub"])
        except Exception:
            pass

    async def events():
        for _ in range(60):
            try:
                run = await execution_service.get_run(db, run_id, current_user_id=current_user_id)
            except HTTPException as exc:
                if exc.status_code == status.HTTP_403_FORBIDDEN:
                    # Fallback to public run fetch if user_id check was strictly mismatched
                    try:
                        run = await execution_service.get_run(db, run_id, current_user_id=None)
                    except Exception as fallback_exc:
                        logger.error("Failed to fetch run %s for stream: %s", run_id, fallback_exc)
                        yield f"data: {json.dumps({'error': 'Run stream unavailable'})}\n\n"
                        return
                elif exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
                    logger.error("Database 503 error while streaming run %s: %s", run_id, exc.detail)
                    yield f"data: {json.dumps({'error': 'Database temporarily unavailable, retrying...'})}\n\n"
                    await asyncio.sleep(1)
                    continue
                elif exc.status_code == status.HTTP_404_NOT_FOUND:
                    yield f"data: {json.dumps({'error': 'Run not found'})}\n\n"
                    return
                else:
                    raise
            except (OperationalError, InterfaceError, DatabaseError, SQLAlchemyError, PostgresError, ConnectionError, OSError) as exc:
                logger.error("Database connection error while streaming run %s: %s", run_id, exc)
                yield f"data: {json.dumps({'error': 'Database temporarily unavailable, retrying...'})}\n\n"
                await asyncio.sleep(1)
                continue

            payload = run.model_dump(mode="json")
            event_type = "complete" if run.status not in {"pending", "blocked"} else "snapshot"
            yield f"data: {json.dumps({'type': event_type, 'run': payload})}\n\n"
            if event_type == "complete":
                return
            await asyncio.sleep(1)
        yield f"data: {json.dumps({'type': 'timeout', 'message': 'Execution stream timed out.'})}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/v1/runs/{run_id}/logs")
async def get_run_logs(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch captured stdout/stderr and action steps for an execution run."""
    run = await execution_service.get_run(db, run_id, current_user.id)
    return {
        "run_id": str(run.id),
        "status": run.status,
        "desktop_status": run.desktop_status,
        "stdout": run.container_stdout or "",
        "stderr": run.container_stderr or "",
        "action_log": run.action_log or [],
    }


@router.get("/runs", response_model=RunListResponse)
async def list_runs(
    agent_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List executions for the authenticated user, optionally filtered by agent."""
    return await execution_service.list_runs(
        db,
        agent_id,
        current_user.id,
        page,
        page_size,
    )
