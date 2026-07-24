"""
Execution API endpoints: execute agents, list/view runs.
"""

import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.run import ExecuteRequest, RunResponse, RunListResponse
from app.services import execution_service
from app.rate_limit import limiter, execution_rate_limit_key

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
async def stream_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream execution snapshots as SSE for the live sandbox console."""

    async def events():
        for _ in range(60):
            run = await execution_service.get_run(db, run_id, current_user.id)
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
