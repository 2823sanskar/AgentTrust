"""
Agent API endpoints: CRUD operations for AI agents.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse
from app.services import agent_service

router = APIRouter(prefix="/api", tags=["Agents"])


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    search: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """List/search public agents with filters and pagination."""
    return await agent_service.get_agents(db, search, provider, category, page, page_size)


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get full agent details including trust score."""
    return await agent_service.get_agent(db, agent_id)


@router.post("/agents", response_model=AgentResponse, status_code=201)
async def create_agent(
    data: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new AI agent. Developer-only."""
    return await agent_service.create_agent(db, current_user.id, data)


@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update agent configuration. Owner-only."""
    return await agent_service.update_agent(db, agent_id, current_user.id, data)


@router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate an agent. Owner-only."""
    return await agent_service.delete_agent(db, agent_id, current_user.id)
