"""
Execution service: the core pipeline for running AI agents.
Orchestrates AI execution, hashing, blockchain anchoring, and trust recalculation.
"""

import asyncio
import uuid
import time
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.run import Run
from app.models.agent import Agent
from app.models.user import User
from app.schemas.run import RunResponse, RunListResponse, VerificationResponse
from app.services.ai_provider import execute_ai_provider
from app.services.browser_agent import BrowserAgentExecutionError, execute_browser_agent
from app.services.docker_sandbox import execute_docker_agent
from app.services.vm_sandbox import execute_vm_sandbox_agent
from app.services.trust_service import recalculate_trust_score
from app.blockchain.stellar import verify_stellar_transaction
from app.services.stellar import anchor_hash_to_stellar
from app.config import settings
from app.utils.hashing import compute_execution_hash, hash_to_bytes

logger = logging.getLogger(__name__)

# Maximum total seconds allowed for a browser agent run (3 minutes)
BROWSER_AGENT_TOTAL_TIMEOUT = 180
# Maximum total seconds allowed for an AI provider call (1 minute)
AI_PROVIDER_TIMEOUT = 60


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

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    # 2. Generate Run ID
    run_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    # 3-5. Execute AI provider and measure time
    start_time = time.time()
    action_log = None
    container_stdout = None
    container_stderr = None
    exit_code = None
    execution_time_override = None
    try:
        if agent.provider == "external_docker":
            if settings.SANDBOX_WORKER_URL:
                docker_result = await execute_vm_sandbox_agent(
                    settings.SANDBOX_WORKER_URL,
                    agent,
                    run_id,
                    task,
                )
            else:
                docker_result = await execute_docker_agent(agent, run_id, task)
            response_text = docker_result.final_output
            action_log = docker_result.action_log
            container_stdout = docker_result.stdout
            container_stderr = docker_result.stderr
            exit_code = docker_result.exit_code
            execution_status = docker_result.status
            execution_time_override = docker_result.execution_time
        elif agent.provider == "browser":
            response_text, action_log = await asyncio.wait_for(
                execute_browser_agent(task),
                timeout=BROWSER_AGENT_TOTAL_TIMEOUT,
            )
            execution_status = "success"
        else:
            response_text = await asyncio.wait_for(
                execute_ai_provider(
                    provider=agent.provider,
                    model=agent.model,
                    system_prompt=agent.system_prompt,
                    task=task,
                ),
                timeout=AI_PROVIDER_TIMEOUT,
            )
            execution_status = "success"
    except asyncio.TimeoutError:
        timeout_sec = (
            BROWSER_AGENT_TOTAL_TIMEOUT
            if agent.provider == "browser"
            else AI_PROVIDER_TIMEOUT
        )
        msg = f"Execution timed out after {timeout_sec}s"
        logger.error(f"{msg} for run {run_id}")
        if agent.provider == "browser":
            response_text = (
                "Browser run recorded with partial results.\n\n"
                f"The browser agent reached the {timeout_sec}s safety limit before finishing. "
                "The run is stored for audit instead of failing the execution."
            )
            action_log = [
                {
                    "step": 1,
                    "action": "Browser safety timeout",
                    "target": agent.provider,
                    "status": "blocked",
                    "note": msg,
                }
            ]
            execution_status = "success"
        else:
            response_text = msg
            action_log = [
                {
                    "step": 1,
                    "action": "Execution timed out",
                    "target": agent.provider,
                    "status": "failure",
                    "note": msg,
                }
            ]
            execution_status = "failure"
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

    execution_time = execution_time_override or round(time.time() - start_time, 4)

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
        container_stdout=container_stdout,
        container_stderr=container_stderr,
        exit_code=exit_code,
    )

    # 8. Submit hash to Stellar Testnet
    stellar_tx = None
    try:
        stellar_anchor = await anchor_hash_to_stellar(execution_hash)
        stellar_tx = stellar_anchor["tx_hash"] if stellar_anchor["success"] else None
        if not stellar_anchor["success"]:
            logger.error(
                "Stellar anchoring failed for run %s: %s",
                run_id,
                stellar_anchor["error"],
            )
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
        container_stdout=container_stdout,
        container_stderr=container_stderr,
        exit_code=exit_code,
        status=execution_status,
        execution_time=execution_time,
        created_at=created_at,
        hash=execution_hash,
        stellar_transaction=stellar_tx,
        user_stellar_wallet_address=user.stellar_wallet_address if user else None,
        user_stellar_wallet_network=user.stellar_wallet_network if user else None,
    )
    db.add(run)
    await db.flush()

    # 10. Recalculate trust score. Never let scoring failure hide a stored run.
    try:
        await recalculate_trust_score(db, agent_id)
    except Exception as e:
        logger.error(f"Trust recalculation failed for run {run_id}: {e}")

    # 11. Return complete run
    await db.refresh(run)
    return _run_to_response(run)


async def get_run(
    db: AsyncSession,
    run_id: uuid.UUID,
    current_user_id: uuid.UUID | None = None,
) -> RunResponse:
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    if current_user_id and run.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view another user's execution run",
        )
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
        container_stdout=run.container_stdout,
        container_stderr=run.container_stderr,
        exit_code=run.exit_code,
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
        evidence_hash=run.hash,
        stellar_tx_hash=run.stellar_transaction,
        stellar_verified=stellar_verified,
        verification_status=verification_status,
        run_details=_run_to_response(run),
    )


def _run_to_response(run: Run) -> RunResponse:
    routing_mode = _routing_mode_from_run(run)
    return RunResponse(
        id=run.id,
        agent_id=run.agent_id,
        user_id=run.user_id,
        task=run.task,
        response=run.response,
        action_log=run.action_log,
        container_stdout=run.container_stdout,
        container_stderr=run.container_stderr,
        exit_code=run.exit_code,
        status=run.status,
        execution_time=run.execution_time,
        created_at=run.created_at,
        hash=run.hash,
        stellar_transaction=run.stellar_transaction,
        evidence_hash=run.hash,
        stellar_tx_hash=run.stellar_transaction,
        agent_name=run.agent.name if run.agent else None,
        user_name=run.user.name if run.user else None,
        user_stellar_wallet_address=run.user_stellar_wallet_address or (run.user.stellar_wallet_address if run.user else None),
        user_stellar_wallet_network=run.user_stellar_wallet_network or (run.user.stellar_wallet_network if run.user else None),
        routing_mode=routing_mode,
    )


def _routing_mode_from_run(run: Run) -> str:
    action_log = run.action_log
    if not action_log:
        if _is_external_docker_cloud_candidate(run):
            return "cloud_sandbox"
        return "local_engine"

    for entry in action_log:
        if not isinstance(entry, dict):
            continue
        action = str(entry.get("action") or "").lower()
        note = str(entry.get("note") or "").lower()
        if "cloud sandbox" in action or "routing_mode=cloud_sandbox" in note:
            return "cloud_sandbox"
        if "docker sandbox completed" in action:
            return "local_engine"

    if _is_external_docker_cloud_candidate(run):
        return "cloud_sandbox"

    return "local_engine"


def _is_external_docker_cloud_candidate(run: Run) -> bool:
    return bool(
        settings.SANDBOX_WORKER_URL
        and run.agent
        and run.agent.provider == "external_docker"
    )
