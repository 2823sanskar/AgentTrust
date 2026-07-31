"""Pydantic schemas for Agent requests and responses."""

import re
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


def normalize_env_vars(values: Optional[list[str]]) -> Optional[list[str]]:
    if not values:
        return None

    seen: set[str] = set()
    normalized: list[str] = []
    for value in values:
        key = value.strip().upper()
        if not key:
            continue
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]{1,63}", key):
            raise ValueError(f"Invalid environment variable name: {value}")
        if key not in seen:
            seen.add(key)
            normalized.append(key)

    return normalized or None


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    provider: str = Field(..., pattern="^external_docker$")
    model: str = Field(..., min_length=1, max_length=100)
    system_prompt: str = Field(..., min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    agent_type: str = Field("prebuilt", pattern="^(prebuilt|custom_docker|custom_script)$")
    docker_image: Optional[str] = Field(None, min_length=1, max_length=255)
    docker_command: Optional[str] = None
    entrypoint_command: Optional[str] = None
    required_env_vars: Optional[list[str]] = None
    source_repo_url: Optional[str] = Field(None, max_length=500)
    timeout_seconds: Optional[int] = Field(None, ge=1, le=600)

    @model_validator(mode="after")
    def validate_provider_model(self):
        self.docker_command = normalize_docker_command(self.docker_command)
        self.entrypoint_command = normalize_docker_command(self.entrypoint_command)
        self.required_env_vars = normalize_env_vars(self.required_env_vars)
        if self.agent_type == "prebuilt" and self.provider == "external_docker":
            self.agent_type = "custom_docker"
        if self.agent_type == "custom_script" and self.provider != "external_docker":
            raise ValueError("Custom script manifests must use the external Docker execution provider")
        if self.provider == "external_docker" and not self.docker_image:
            raise ValueError("Docker image is required for external custom agents")
        if self.agent_type == "custom_docker":
            if not self.docker_image:
                raise ValueError("Docker image is required for external Docker agents")
            if not self.timeout_seconds:
                self.timeout_seconds = 60
        if self.agent_type == "custom_script":
            if not self.entrypoint_command:
                raise ValueError("Entrypoint command is required for custom script agents")
            if not self.timeout_seconds:
                self.timeout_seconds = 60
            if not self.docker_command:
                self.docker_command = self.entrypoint_command
        return self


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    provider: Optional[str] = Field(None, pattern="^external_docker$")
    model: Optional[str] = Field(None, min_length=1, max_length=100)
    system_prompt: Optional[str] = Field(None, min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")
    agent_type: Optional[str] = Field(None, pattern="^(prebuilt|custom_docker|custom_script)$")
    docker_image: Optional[str] = Field(None, min_length=1, max_length=255)
    docker_command: Optional[str] = None
    entrypoint_command: Optional[str] = None
    required_env_vars: Optional[list[str]] = None
    source_repo_url: Optional[str] = Field(None, max_length=500)
    timeout_seconds: Optional[int] = Field(None, ge=1, le=600)

    @model_validator(mode="after")
    def normalize_optional_fields(self):
        self.docker_command = normalize_docker_command(self.docker_command)
        self.entrypoint_command = normalize_docker_command(self.entrypoint_command)
        self.required_env_vars = normalize_env_vars(self.required_env_vars)
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
    agent_type: str = "prebuilt"
    docker_image: Optional[str] = None
    docker_command: Optional[str] = None
    entrypoint_command: Optional[str] = None
    required_env_vars: Optional[list[str]] = None
    source_repo_url: Optional[str] = None
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
