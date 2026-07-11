"""Pydantic schemas for Agent requests and responses."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    provider: str = Field(..., pattern="^(openrouter|browser)$")
    model: str = Field(..., min_length=1, max_length=100)
    system_prompt: str = Field(..., min_length=10)
    category: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="after")
    def validate_provider_model(self):
        if self.provider == "openrouter" and self.model != "openrouter/free" and not self.model.endswith(":free"):
            raise ValueError("Only OpenRouter free models are allowed")
        if self.provider == "browser" and self.model != "browser-demo":
            raise ValueError("Browser Agent must use browser-demo")
        return self


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    provider: Optional[str] = Field(None, pattern="^(openrouter|browser)$")
    model: Optional[str] = Field(None, min_length=1, max_length=100)
    system_prompt: Optional[str] = Field(None, min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")


class AgentResponse(BaseModel):
    id: uuid.UUID
    developer_id: uuid.UUID
    name: str
    description: Optional[str]
    provider: str
    model: str
    system_prompt: str
    category: Optional[str]
    status: str
    created_at: datetime
    developer_name: Optional[str] = None
    trust_score: Optional[float] = None
    total_runs: Optional[int] = None
    success_rate: Optional[float] = None

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    total: int
    page: int
    page_size: int
