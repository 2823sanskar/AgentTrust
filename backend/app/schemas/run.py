"""Pydantic schemas for Run (execution) requests and responses."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    agent_id: uuid.UUID
    task: str = Field(..., min_length=1, max_length=10000)


class RunResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    user_id: uuid.UUID
    task: str
    response: Optional[str]
    action_log: Optional[list[dict]] = None
    container_stdout: Optional[str] = None
    container_stderr: Optional[str] = None
    exit_code: Optional[int] = None
    status: str
    execution_time: Optional[float]
    is_interactive: bool = False
    container_id: Optional[str] = None
    vnc_port: Optional[int] = None
    websockify_port: Optional[int] = None
    session_token: Optional[str] = Field(default=None, exclude=True)
    session_token_preview: Optional[str] = None
    desktop_status: str = "stopped"
    last_heartbeat: Optional[datetime] = None
    created_at: datetime
    hash: Optional[str]
    stellar_transaction: Optional[str]
    evidence_hash: Optional[str] = None
    stellar_tx_hash: Optional[str] = None
    stellar_ledger_sequence: Optional[int] = None
    anchored_at: Optional[datetime] = None
    anchor_status: Optional[str] = None
    agent_name: Optional[str] = None
    user_name: Optional[str] = None
    user_stellar_wallet_address: Optional[str] = None
    user_stellar_wallet_network: Optional[str] = None
    routing_mode: str = "local_engine"

    model_config = {"from_attributes": True}


class RunListResponse(BaseModel):
    runs: list[RunResponse]
    total: int
    page: int
    page_size: int


class VerificationResponse(BaseModel):
    run_id: uuid.UUID
    stored_hash: Optional[str]
    computed_hash: str
    hashes_match: bool
    stellar_transaction: Optional[str]
    evidence_hash: Optional[str] = None
    stellar_tx_hash: Optional[str] = None
    stellar_ledger_sequence: Optional[int] = None
    anchored_at: Optional[datetime] = None
    anchor_status: Optional[str] = None
    verified: bool = False
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None
    timestamp: Optional[str] = None
    stellar_verified: bool
    verification_status: str  # "verified", "tampered", "unanchored"
    run_details: RunResponse
