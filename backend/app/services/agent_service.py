"""
Agent service: CRUD operations for AI agent management.
"""

import hashlib
import uuid
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.agent import Agent
from app.models.trust_score import TrustScore
from app.models.run import Run
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse


def generate_agent_hash(name: str, author_id: str, install_cmd: str = "", exec_cmd: str = "") -> str:
    """Generate deterministic SHA-256 fingerprint for registered agent."""
    raw_payload = f"{name or ''}:{author_id or ''}:{install_cmd or ''}:{exec_cmd or ''}"
    return hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()


async def create_agent(
    db: AsyncSession, developer_id: uuid.UUID, data: AgentCreate
) -> AgentResponse:
    author = data.author_id or str(developer_id)
    install = data.install_cmd or ""
    execution = data.exec_cmd or data.docker_command or data.entrypoint_command or ""
    reg_hash = data.registration_hash or generate_agent_hash(data.name, author, install, execution)

    agent = Agent(
        id=uuid.uuid4(),
        developer_id=developer_id,
        author_id=author,
        name=data.name,
        description=data.description,
        provider=data.provider,
        model=data.model,
        system_prompt=data.system_prompt,
        category=data.category,
        install_cmd=install,
        exec_cmd=execution,
        registration_hash=reg_hash,
        is_public=data.is_public,
        agent_type=data.agent_type,
        docker_image=data.docker_image,
        docker_command=data.docker_command,
        entrypoint_command=data.entrypoint_command,
        required_env_vars=data.required_env_vars,
        source_repo_url=data.source_repo_url,
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
        author_id=getattr(agent, "author_id", None) or str(agent.developer_id),
        name=agent.name,
        description=agent.description,
        provider=agent.provider,
        model=agent.model,
        system_prompt=agent.system_prompt,
        category=agent.category,
        install_cmd=getattr(agent, "install_cmd", None),
        exec_cmd=getattr(agent, "exec_cmd", None),
        registration_hash=getattr(agent, "registration_hash", None),
        is_public=getattr(agent, "is_public", True),
        agent_type=agent.agent_type,
        docker_image=agent.docker_image,
        docker_command=agent.docker_command,
        entrypoint_command=agent.entrypoint_command,
        required_env_vars=agent.required_env_vars,
        source_repo_url=agent.source_repo_url,
        timeout_seconds=agent.timeout_seconds,
        status=agent.status,
        created_at=agent.created_at,
        developer_name=developer.name if developer else None,
        trust_score=trust.overall_score if trust else None,
        total_runs=trust.total_runs if trust else 0,
        success_rate=trust.success_rate if trust else None,
    )
