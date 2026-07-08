"""
Trust Score API endpoint.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trust_score import TrustScore
from app.schemas.trust import TrustScoreResponse

router = APIRouter(prefix="/api", tags=["Trust"])


@router.get("/trust/{agent_id}", response_model=TrustScoreResponse)
async def get_trust_score(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get the current trust score breakdown for an agent."""
    result = await db.execute(
        select(TrustScore).where(TrustScore.agent_id == agent_id)
    )
    trust = result.scalar_one_or_none()
    if not trust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trust score not found for this agent",
        )
    return TrustScoreResponse.model_validate(trust)
