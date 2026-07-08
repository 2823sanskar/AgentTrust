"""
Trust Score calculation service.
Computes weighted trust scores based on execution outcomes.
"""

import uuid
import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run import Run
from app.models.trust_score import TrustScore

logger = logging.getLogger(__name__)

# Trust score weights (MVP - no user ratings, redistributed)
WEIGHT_SUCCESS_RATE = 0.50
WEIGHT_VERIFIED_RATIO = 0.25
WEIGHT_LATENCY = 0.15
WEIGHT_FAILURE_PENALTY = 0.10

# Latency benchmark (seconds) - responses faster than this get higher scores
LATENCY_BENCHMARK = 10.0


async def recalculate_trust_score(db: AsyncSession, agent_id: uuid.UUID) -> TrustScore:
    """
    Recalculate the trust score for an agent based on all its runs.
    
    Formula (0-100 scale):
    - Success Rate (50%): % of successful runs
    - Verified Ratio (25%): % of runs anchored on-chain
    - Latency Score (15%): normalized response time (lower = better)
    - Failure Penalty (10%): inverted failure rate
    """
    # Fetch aggregate stats
    stats_query = select(
        func.count(Run.id).label("total_runs"),
        func.count(Run.id).filter(Run.status == "success").label("success_count"),
        func.count(Run.id).filter(Run.stellar_transaction.isnot(None)).label("verified_count"),
        func.avg(Run.execution_time).label("avg_latency"),
    ).where(Run.agent_id == agent_id)

    result = await db.execute(stats_query)
    stats = result.one()

    total_runs = stats.total_runs or 0
    success_count = stats.success_count or 0
    verified_count = stats.verified_count or 0
    avg_latency = float(stats.avg_latency or 0)

    if total_runs == 0:
        # No runs yet - default score
        overall_score = 0.0
        success_rate = 0.0
    else:
        success_rate = success_count / total_runs
        failure_rate = 1.0 - success_rate
        verified_ratio = verified_count / total_runs

        # Latency score: 1.0 if instant, decreasing as latency increases
        latency_score = max(0.0, 1.0 - (avg_latency / LATENCY_BENCHMARK))

        # Weighted calculation
        overall_score = (
            (success_rate * WEIGHT_SUCCESS_RATE)
            + (verified_ratio * WEIGHT_VERIFIED_RATIO)
            + (latency_score * WEIGHT_LATENCY)
            + ((1.0 - failure_rate) * WEIGHT_FAILURE_PENALTY)
        ) * 100  # Scale to 0-100

        overall_score = round(min(100.0, max(0.0, overall_score)), 2)

    # Upsert trust score
    trust_result = await db.execute(
        select(TrustScore).where(TrustScore.agent_id == agent_id)
    )
    trust = trust_result.scalar_one_or_none()

    if trust:
        trust.overall_score = overall_score
        trust.success_rate = round(success_rate, 4)
        trust.average_latency = round(avg_latency, 4)
        trust.verified_runs = verified_count
        trust.total_runs = total_runs
    else:
        trust = TrustScore(
            agent_id=agent_id,
            overall_score=overall_score,
            success_rate=round(success_rate, 4),
            average_latency=round(avg_latency, 4),
            verified_runs=verified_count,
            total_runs=total_runs,
        )
        db.add(trust)

    await db.flush()
    logger.info(f"Trust score updated for agent {agent_id}: {overall_score}")
    return trust
