"""
Execution service: the core pipeline for running AI agents.
Orchestrates AI execution, hashing, blockchain anchoring, and trust recalculation.
"""

import uuid
import time
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.run import Run
from app.models.agent import Agent
from app.schemas.run import RunResponse, RunListResponse, VerificationResponse
from app.services.ai_provider import execute_ai_provider
from app.services.browser_agent import BrowserAgentExecutionError, execute_browser_agent
from app.services.trust_service import recalculate_trust_score
from app.blockchain.stellar import anchor_hash_on_stellar, verify_stellar_transaction
from app.utils.hashing import compute_execution_hash, hash_to_bytes

logger = logging.getLogger(__name__)


async def execute_agent(
    db: AsyncSession, agent_id: uuid.UUID, user_id: uuid.UUID, task: str
) -> RunResponse:
    """
    Full execution pipeline (PRD §7.1):
    1. Load agent config
    2. Generate Run ID
    3. Call AI provider
    4. Record execution time
    5. Determine status
    6. Build execution record
    7. Compute SHA-256 hash
    8. Submit hash to Stellar
    9. Store run with hash + tx ref
    10. Recalculate trust score
    11. Return complete run record
    """
    # 1. Load agent
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is inactive")

    # 2. Generate Run ID
    run_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    # 3-5. Execute AI provider and measure time
    start_time = time.time()
    try:
        action_log = None
        if agent.provider == "browser":
            response_text, action_log = await execute_browser_agent(task)
        else:
            response_text = await execute_ai_provider(
                provider=agent.provider,
                model=agent.model,
                system_prompt=agent.system_prompt,
                task=task,
            )
        execution_status = "success"
    except Exception as e:
        logger.error(f"AI execution failed for run {run_id}: {e}")
        response_text = f"Execution error: {str(e)}"
        if isinstance(e, BrowserAgentExecutionError):
            action_log = e.action_log
        else:
            action_log = [
                {
                    "step": 1,
                    "action": "Execution failed",
                    "target": agent.provider,
                    "status": "failure",
                    "note": str(e),
                }
            ]
        execution_status = "failure"

    execution_time = round(time.time() - start_time, 4)

    # 7. Compute SHA-256 hash
    execution_hash = compute_execution_hash(
        run_id=run_id,
        agent_id=agent_id,
        user_id=user_id,
        task=task,
        response=response_text,
        status=execution_status,
        execution_time=execution_time,
        created_at=created_at,
        action_log=action_log,
    )

    # 8. Submit hash to Stellar Testnet
    stellar_tx = None
    try:
        hash_bytes = hash_to_bytes(execution_hash)
        stellar_tx = await anchor_hash_on_stellar(hash_bytes)
    except Exception as e:
        logger.error(f"Stellar anchoring failed for run {run_id}: {e}")

    # 9. Store the run
    run = Run(
        id=run_id,
        agent_id=agent_id,
        user_id=user_id,
        task=task,
        response=response_text,
        action_log=action_log,
        status=execution_status,
        execution_time=execution_time,
        created_at=created_at,
        hash=execution_hash,
        stellar_transaction=stellar_tx,
    )
    db.add(run)
    await db.flush()

    # 10. Recalculate trust score
    await recalculate_trust_score(db, agent_id)

    # 11. Return complete run
    await db.refresh(run)
    return _run_to_response(run)


async def get_run(db: AsyncSession, run_id: uuid.UUID) -> RunResponse:
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _run_to_response(run)


async def list_runs(
    db: AsyncSession,
    agent_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
) -> RunListResponse:
    query = select(Run)

    if agent_id:
        query = query.where(Run.agent_id == agent_id)
    if user_id:
        query = query.where(Run.user_id == user_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    query = query.order_by(Run.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    runs = result.scalars().all()

    return RunListResponse(
        runs=[_run_to_response(r) for r in runs],
        total=total,
        page=page,
        page_size=page_size,
    )


async def verify_run(db: AsyncSession, run_id: uuid.UUID) -> VerificationResponse:
    """
    Publicly verify an execution record:
    1. Recompute hash from stored record
    2. Compare with stored hash
    3. Verify Stellar transaction exists
    """
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # Recompute hash
    computed_hash = compute_execution_hash(
        run_id=run.id,
        agent_id=run.agent_id,
        user_id=run.user_id,
        task=run.task,
        response=run.response,
        action_log=run.action_log,
        status=run.status,
        execution_time=run.execution_time,
        created_at=run.created_at,
    )

    hashes_match = computed_hash == run.hash

    # Verify Stellar transaction
    stellar_verified = False
    if run.stellar_transaction:
        stellar_info = await verify_stellar_transaction(
            run.stellar_transaction,
            expected_hash_bytes=hash_to_bytes(computed_hash),
        )
        stellar_verified = bool(
            stellar_info.get("exists", False)
            and stellar_info.get("memo_matches", False)
        )

    # Determine verification status
    if not hashes_match:
        verification_status = "tampered"
    elif stellar_verified:
        verification_status = "verified"
    elif not run.stellar_transaction:
        verification_status = "unanchored"
    else:
        verification_status = "unanchored"

    return VerificationResponse(
        run_id=run.id,
        stored_hash=run.hash,
        computed_hash=computed_hash,
        hashes_match=hashes_match,
        stellar_transaction=run.stellar_transaction,
        stellar_verified=stellar_verified,
        verification_status=verification_status,
        run_details=_run_to_response(run),
    )


def _run_to_response(run: Run) -> RunResponse:
    return RunResponse(
        id=run.id,
        agent_id=run.agent_id,
        user_id=run.user_id,
        task=run.task,
        response=run.response,
        action_log=run.action_log,
        status=run.status,
        execution_time=run.execution_time,
        created_at=run.created_at,
        hash=run.hash,
        stellar_transaction=run.stellar_transaction,
        agent_name=run.agent.name if run.agent else None,
        user_name=run.user.name if run.user else None,
    )
