"""Pydantic schemas for Agent requests and responses."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


EMPTY_DOCKER_COMMANDS = {
    "",
    "leave",
    "leave empty",
    "blank",
    "empty",
    "none",
    "null",
    "n/a",
    "default",
    "image cmd",
    "use image cmd",
    "leave blank",
    "leave blank to use the image cmd",
}


def normalize_docker_command(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    command = value.strip()
    if command.lower() in EMPTY_DOCKER_COMMANDS:
        return None
    return command


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    provider: str = Field(..., pattern="^(openrouter|browser|external_docker)$")
    model: str = Field(..., min_length=1, max_length=100)
    system_prompt: str = Field(..., min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    docker_image: Optional[str] = Field(None, min_length=1, max_length=255)
    docker_command: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=600)

    @model_validator(mode="after")
    def validate_provider_model(self):
        self.docker_command = normalize_docker_command(self.docker_command)
        if self.provider == "openrouter" and self.model != "openrouter/free" and not self.model.endswith(":free"):
            raise ValueError("Only OpenRouter free models are allowed")
        if self.provider == "browser" and self.model != "browser-demo":
            raise ValueError("Browser Agent must use browser-demo")
        if self.provider == "external_docker":
            if not self.docker_image:
                raise ValueError("Docker image is required for external Docker agents")
            if not self.timeout_seconds:
                self.timeout_seconds = 60
        return self


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    provider: Optional[str] = Field(None, pattern="^(openrouter|browser|external_docker)$")
    model: Optional[str] = Field(None, min_length=1, max_length=100)
    system_prompt: Optional[str] = Field(None, min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")
    docker_image: Optional[str] = Field(None, min_length=1, max_length=255)
    docker_command: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=600)

    @model_validator(mode="after")
    def normalize_optional_fields(self):
        self.docker_command = normalize_docker_command(self.docker_command)
        return self


class AgentResponse(BaseModel):
    id: uuid.UUID
    developer_id: uuid.UUID
    name: str
    description: Optional[str]
    provider: str
    model: str
    system_prompt: str
    category: Optional[str]
    docker_image: Optional[str] = None
    docker_command: Optional[str] = None
    timeout_seconds: Optional[int] = None
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
