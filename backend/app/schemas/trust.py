"""Pydantic schemas for Trust Score responses."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TrustScoreResponse(BaseModel):
    agent_id: uuid.UUID
    overall_score: float
    success_rate: float
    average_latency: float
    verified_runs: int
    total_runs: int
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
