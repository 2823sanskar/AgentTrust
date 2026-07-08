"""
Execution API endpoints: execute agents, list/view runs.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.run import ExecuteRequest, RunResponse, RunListResponse
from app.services import execution_service

router = APIRouter(prefix="/api", tags=["Executions"])


@router.post("/execute", response_model=RunResponse, status_code=201)
async def execute(
    data: ExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute an AI agent with a task. Triggers the full execution pipeline."""
    return await execution_service.execute_agent(
        db, data.agent_id, current_user.id, data.task
    )


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(run_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Fetch a specific execution record."""
    return await execution_service.get_run(db, run_id)


@router.get("/runs", response_model=RunListResponse)
async def list_runs(
    agent_id: Optional[uuid.UUID] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List executions with optional filters (by agent or user)."""
    return await execution_service.list_runs(db, agent_id, user_id, page, page_size)
