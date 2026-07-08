"""
Public Verification API endpoint.
Allows anyone to verify an execution's integrity.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.run import VerificationResponse
from app.services import execution_service

router = APIRouter(prefix="/api", tags=["Verification"])


@router.get("/verify/{run_id}", response_model=VerificationResponse)
async def verify_run(run_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Publicly verify an execution record.
    Recomputes the hash and checks blockchain proof.
    No authentication required.
    """
    return await execution_service.verify_run(db, run_id)
