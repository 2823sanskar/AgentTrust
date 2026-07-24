"""Pydantic schemas for interactive desktop sandbox sessions."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.run import RunResponse


class SandboxSessionCreate(BaseModel):
    agent_id: Optional[uuid.UUID] = None
    task: Optional[str] = Field(default=None, max_length=10000)
    timeout_seconds: int = Field(default=3600, ge=60, le=86400)
    environment: dict[str, str] = Field(default_factory=dict)


class SandboxSessionResponse(BaseModel):
    run_id: uuid.UUID
    user_id: uuid.UUID
    is_interactive: bool = True
    container_id: Optional[str] = None
    vnc_port: Optional[int] = None
    websockify_port: Optional[int] = None
    desktop_status: str
    websocket_url: Optional[str] = None
    session_token: Optional[str] = Field(
        default=None,
        description="Only returned to the authorized session creator during setup.",
    )
    session_token_preview: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SandboxSessionStatusUpdate(BaseModel):
    desktop_status: Optional[str] = Field(
        default=None,
        pattern="^(pending|running|stopping|stopped|failed|timed_out)$",
    )
    last_heartbeat: Optional[datetime] = None
    container_id: Optional[str] = Field(default=None, max_length=64)


class DesktopSessionStatusResponse(BaseModel):
    run_id: uuid.UUID
    desktop_status: str
    vnc_port: Optional[int] = None
    websockify_port: Optional[int] = None
    container_id: Optional[str] = None
    created_at: datetime
    last_heartbeat: Optional[datetime] = None


class DesktopConnectInfoResponse(BaseModel):
    run_id: uuid.UUID
    websockify_port: Optional[int] = None
    session_token: Optional[str] = None
    status: str


class DesktopHeartbeatResponse(BaseModel):
    status: str = "ok"
    last_heartbeat: datetime


class DesktopStopResponse(BaseModel):
    status: str
    desktop_status: str
    container_stopped: bool
    run: Optional[RunResponse] = None
