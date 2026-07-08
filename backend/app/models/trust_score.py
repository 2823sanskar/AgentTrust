"""Trust Score model for agent reputation tracking."""

import uuid
from datetime import datetime

from sqlalchemy import Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrustScore(Base):
    __tablename__ = "trust_scores"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    success_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    average_latency: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    verified_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    agent = relationship("Agent", back_populates="trust_score", lazy="selectin")

    def __repr__(self) -> str:
        return f"<TrustScore agent={self.agent_id} score={self.overall_score}>"
