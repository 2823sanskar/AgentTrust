"""Agent model for registered AI agents."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    developer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # openrouter, browser, external_docker
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    agent_type: Mapped[str] = mapped_column(String(32), nullable=False, default="prebuilt")
    docker_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    docker_command: Mapped[str | None] = mapped_column(Text, nullable=True)
    entrypoint_command: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_env_vars: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    source_repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timeout_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    developer = relationship("User", back_populates="agents", lazy="selectin")
    runs = relationship("Run", back_populates="agent", lazy="selectin")
    trust_score = relationship("TrustScore", back_populates="agent", uselist=False, lazy="selectin")

    def __repr__(self) -> str:
        return f"<Agent {self.name} ({self.provider}/{self.model})>"
