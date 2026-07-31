"""Run model for execution records."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Integer, String, Text, Float, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_log: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    container_stdout: Mapped[str | None] = mapped_column(Text, nullable=True)
    container_stderr: Mapped[str | None] = mapped_column(Text, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    execution_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_interactive: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    container_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vnc_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    websockify_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    desktop_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="stopped", server_default="stopped"
    )
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stellar_transaction: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stellar_network: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default="mainnet"
    )
    stellar_ledger_sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    anchored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anchor_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_anchor")
    user_stellar_wallet_address: Mapped[str | None] = mapped_column(String(56), nullable=True)
    user_stellar_wallet_network: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationships
    agent = relationship("Agent", back_populates="runs", lazy="selectin")
    user = relationship("User", back_populates="runs", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Run {self.id} status={self.status}>"
