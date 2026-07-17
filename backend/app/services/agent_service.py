"""
Agent service: CRUD operations for AI agent management.
"""

import uuid
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.agent import Agent
from app.models.trust_score import TrustScore
from app.models.run import Run
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse


async def create_agent(
    db: AsyncSession, developer_id: uuid.UUID, data: AgentCreate
) -> AgentResponse:
    agent = Agent(
        id=uuid.uuid4(),
        developer_id=developer_id,
        name=data.name,
        description=data.description,
        provider=data.provider,
        model=data.model,
        system_prompt=data.system_prompt,
        category=data.category,
        docker_image=data.docker_image,
        docker_command=data.docker_command,
        timeout_seconds=data.timeout_seconds,
        status="active",
    )
    db.add(agent)
    await db.flush()

    # Create initial trust score record
    trust = TrustScore(
        agent_id=agent.id,
        overall_score=0.0,
        success_rate=0.0,
        average_latency=0.0,
        verified_runs=0,
        total_runs=0,
    )
    db.add(trust)
    await db.flush()
    await db.refresh(agent)

    return _agent_to_response(agent)


async def get_agents(
    db: AsyncSession,
    search: Optional[str] = None,
    provider: Optional[str] = None,
    category: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
) -> AgentListResponse:
    query = select(Agent).where(Agent.status == "active")

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                Agent.name.ilike(search_filter),
                Agent.description.ilike(search_filter),
            )
        )

    if provider:
        query = query.where(Agent.provider == provider)

    if category:
        query = query.where(Agent.category == category)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(Agent.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    agents = result.scalars().all()

    return AgentListResponse(
        agents=[_agent_to_response(a) for a in agents],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_agent(db: AsyncSession, agent_id: uuid.UUID) -> AgentResponse:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return _agent_to_response(agent)


async def get_agent_model(db: AsyncSession, agent_id: uuid.UUID) -> Agent:
    """Return the raw Agent ORM model (for internal use)."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


async def update_agent(
    db: AsyncSession, agent_id: uuid.UUID, developer_id: uuid.UUID, data: AgentUpdate
) -> AgentResponse:
    agent = await get_agent_model(db, agent_id)

    if agent.developer_id != developer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the agent owner")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent, field, value)

    await db.flush()
    await db.refresh(agent)
    return _agent_to_response(agent)


async def delete_agent(
    db: AsyncSession, agent_id: uuid.UUID, developer_id: uuid.UUID
) -> dict:
    agent = await get_agent_model(db, agent_id)

    if agent.developer_id != developer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the agent owner")

    agent.status = "inactive"
    await db.flush()
    return {"message": "Agent deactivated successfully"}


def _agent_to_response(agent: Agent) -> AgentResponse:
    trust = agent.trust_score
    developer = agent.developer
    return AgentResponse(
        id=agent.id,
        developer_id=agent.developer_id,
        name=agent.name,
        description=agent.description,
        provider=agent.provider,
        model=agent.model,
        system_prompt=agent.system_prompt,
        category=agent.category,
        docker_image=agent.docker_image,
        docker_command=agent.docker_command,
        timeout_seconds=agent.timeout_seconds,
        status=agent.status,
        created_at=agent.created_at,
        developer_name=developer.name if developer else None,
        trust_score=trust.overall_score if trust else None,
        total_runs=trust.total_runs if trust else 0,
        success_rate=trust.success_rate if trust else None,
    )
