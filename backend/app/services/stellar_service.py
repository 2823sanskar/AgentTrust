"""Phase 2.5 Stellar hashing, anchoring, and receipt verification helpers."""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, TypedDict

from stellar_sdk import AiohttpClient, HashMemo, Keypair, Network, TransactionBuilder
from stellar_sdk.exceptions import BadRequestError, NotFoundError
from stellar_sdk.server_async import ServerAsync
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.stellar import verify_stellar_transaction
from app.config import settings
from app.models.run import Run
from app.utils.hashing import UUIDEncoder, hash_to_bytes

logger = logging.getLogger(__name__)

STELLAR_ANCHOR_TIMEOUT_SECONDS = 30
TERMINAL_RUN_STATUSES = {"success", "failure", "completed", "failed"}
_runtime_keypair: Keypair | None = None
_runtime_keypair_lock = asyncio.Lock()
_anchor_submission_lock = asyncio.Lock()
_stellar_account_ready = False


class StellarReceipt(TypedDict):
    verified: bool
    tx_hash: str | None
    network: str | None
    ledger: int | None
    explorer_url: str | None
    timestamp: str | None
    anchor_status: str
    error: str | None


class StellarAnchorResult(TypedDict):
    tx_hash: str | None
    ledger: int | None
    success: bool
    error: str | None


def stellar_explorer_url(
    tx_hash: str | None,
    network: str | None = None,
) -> str | None:
    if not tx_hash:
        return None
    active_network = (network or settings.STELLAR_NETWORK).strip().lower()
    if active_network == "mainnet":
        network_path = "public"
    elif active_network == "testnet":
        network_path = "testnet"
    else:
        logger.warning("Refusing to build explorer URL for unknown network %r", network)
        return None
    return f"https://stellar.expert/explorer/{network_path}/tx/{tx_hash}"


def _network_passphrase() -> str:
    return Network.PUBLIC_NETWORK_PASSPHRASE


def _anchor_error(message: str) -> StellarAnchorResult:
    return {
        "tx_hash": None,
        "ledger": None,
        "success": False,
        "error": message,
    }


async def _get_anchor_keypair() -> Keypair:
    """Return the explicitly configured Mainnet keypair."""
    global _runtime_keypair

    async with _runtime_keypair_lock:
        if _runtime_keypair is None:
            configured_secret = (settings.STELLAR_SECRET_KEY or "").strip()
            configured_public = (settings.STELLAR_PUBLIC_KEY or "").strip()
            if not configured_secret:
                raise ValueError("STELLAR_SECRET_KEY is required for Mainnet anchoring")
            if not configured_public:
                raise ValueError("STELLAR_PUBLIC_KEY is required for Mainnet anchoring")

            try:
                keypair = Keypair.from_secret(configured_secret)
                Keypair.from_public_key(configured_public)
            except Exception as exc:
                raise ValueError("Invalid Stellar Mainnet key configuration") from exc
            if configured_public != keypair.public_key:
                raise ValueError("STELLAR_PUBLIC_KEY does not match STELLAR_SECRET_KEY")
            _runtime_keypair = keypair

        return _runtime_keypair


async def ensure_stellar_anchor_account() -> None:
    """Verify the configured account and Horizon endpoint against Mainnet."""
    global _stellar_account_ready
    _stellar_account_ready = False
    try:
        keypair = await _get_anchor_keypair()
        async with ServerAsync(
            horizon_url=settings.STELLAR_HORIZON_URL,
            client=AiohttpClient(),
        ) as server:
            root = await asyncio.wait_for(
                server.root().call(),
                timeout=STELLAR_ANCHOR_TIMEOUT_SECONDS,
            )
            network_passphrase = root.get("network_passphrase")
            if network_passphrase != Network.PUBLIC_NETWORK_PASSPHRASE:
                raise RuntimeError(
                    "Configured Horizon endpoint is not connected to Stellar Mainnet"
                )
            await asyncio.wait_for(
                server.load_account(keypair.public_key),
                timeout=STELLAR_ANCHOR_TIMEOUT_SECONDS,
            )
        _stellar_account_ready = True
        logger.info("Stellar %s anchor account ready: %s", settings.STELLAR_NETWORK, keypair.public_key)
    except Exception as exc:
        logger.error("Stellar anchor account startup check failed: %s", exc)
        if settings.ENVIRONMENT.lower() == "production":
            raise RuntimeError(
                "Stellar anchor account configuration is invalid"
            ) from exc


def stellar_anchor_account_ready() -> bool:
    return _stellar_account_ready


def compute_run_output_fingerprint(run: Run) -> str:
    """Compute deterministic SHA-256 from completed run output evidence."""
    payload: dict[str, Any] = {
        "run_id": run.id,
        "agent_id": run.agent_id,
        "status": run.status,
        "logs": {
            "action_log": run.action_log or [],
            "stdout": run.container_stdout or "",
            "stderr": run.container_stderr or "",
            "response": run.response or "",
            "exit_code": run.exit_code,
        },
    }
    serialized = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        cls=UUIDEncoder,
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


async def anchor_run_hash(run: Run) -> dict[str, Any]:
    """Submit a completed run hash to Stellar and return DB-ready receipt fields."""
    evidence_hash = run.hash or compute_run_output_fingerprint(run)
    anchor = await submit_hash_to_stellar(evidence_hash)
    if anchor["success"] and anchor["tx_hash"]:
        return {
            "hash": evidence_hash,
            "stellar_transaction": anchor["tx_hash"],
            "stellar_network": settings.STELLAR_NETWORK,
            "stellar_ledger_sequence": anchor["ledger"],
            "anchored_at": datetime.now(timezone.utc),
            "anchor_status": "anchored",
            "anchor_error": None,
        }

    return {
        "hash": evidence_hash,
        "stellar_transaction": None,
        "stellar_network": settings.STELLAR_NETWORK,
        "stellar_ledger_sequence": None,
        "anchored_at": None,
        "anchor_status": "pending_anchor",
        "anchor_error": anchor.get("error"),
    }


async def submit_hash_to_stellar(evidence_hash: str) -> StellarAnchorResult:
    """Anchor a SHA-256 hash to the configured Stellar network."""
    try:
        try:
            evidence_hash_bytes = bytes.fromhex(evidence_hash)
        except ValueError:
            return _anchor_error("evidence_hash must be a hex SHA-256 digest")
        if len(evidence_hash_bytes) != 32:
            return _anchor_error("evidence_hash must decode to 32 bytes")

        keypair = await _get_anchor_keypair()

        async with _anchor_submission_lock:
            async with ServerAsync(
                horizon_url=settings.STELLAR_HORIZON_URL,
                client=AiohttpClient(),
            ) as server:
                source_account = await asyncio.wait_for(
                    server.load_account(keypair.public_key),
                    timeout=STELLAR_ANCHOR_TIMEOUT_SECONDS,
                )
                base_fee = max(
                    100,
                    await asyncio.wait_for(
                        server.fetch_base_fee(),
                        timeout=STELLAR_ANCHOR_TIMEOUT_SECONDS,
                    ),
                )
                if base_fee > settings.STELLAR_MAX_BASE_FEE:
                    return _anchor_error(
                        "Recommended Stellar base fee exceeds STELLAR_MAX_BASE_FEE"
                    )
                transaction = (
                    TransactionBuilder(
                        source_account=source_account,
                        network_passphrase=_network_passphrase(),
                        base_fee=base_fee,
                    )
                    .append_manage_data_op(
                        data_name="agenttrust_hash",
                        data_value=evidence_hash,
                        source=keypair.public_key,
                    )
                    .add_memo(HashMemo(evidence_hash_bytes))
                    .set_timeout(STELLAR_ANCHOR_TIMEOUT_SECONDS)
                    .build()
                )
                transaction.sign(keypair)
                response: dict[str, Any] = await asyncio.wait_for(
                    server.submit_transaction(transaction),
                    timeout=STELLAR_ANCHOR_TIMEOUT_SECONDS,
                )

        return {
            "tx_hash": response.get("hash"),
            "ledger": response.get("ledger"),
            "success": bool(response.get("successful", True)),
            "error": None,
        }
    except asyncio.TimeoutError:
        logger.error("Stellar anchoring timed out")
        return _anchor_error("Stellar Horizon request timed out")
    except NotFoundError:
        logger.error("Configured Stellar Mainnet account was not found")
        return _anchor_error("Configured Stellar Mainnet account was not found")
    except BadRequestError as exc:
        logger.error("Stellar transaction rejected: %s", exc)
        return _anchor_error(str(exc))
    except Exception as exc:
        logger.error("Stellar anchoring failed: %s", exc)
        return _anchor_error(str(exc))


async def anchor_run_to_stellar(db: AsyncSession, run_id: Any) -> Run:
    """Anchor a completed run if it does not already have a Stellar receipt."""
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise ValueError(f"Run not found: {run_id}")
    if run.status not in TERMINAL_RUN_STATUSES:
        return run
    if run.stellar_transaction:
        return run

    anchor_fields = await anchor_run_hash(run)
    run.hash = anchor_fields["hash"]
    run.stellar_transaction = anchor_fields["stellar_transaction"]
    run.stellar_network = anchor_fields["stellar_network"]
    run.stellar_ledger_sequence = anchor_fields["stellar_ledger_sequence"]
    run.anchored_at = anchor_fields["anchored_at"]
    run.anchor_status = anchor_fields["anchor_status"]
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def verify_run_receipt(
    run: Run,
    *,
    network: str | None = None,
) -> StellarReceipt:
    """Verify stored Stellar receipt against the local execution hash."""
    tx_hash = run.stellar_transaction
    active_network = network or run.stellar_network or settings.STELLAR_NETWORK
    explorer_url = stellar_explorer_url(tx_hash, active_network)
    if not tx_hash or not run.hash:
        return {
            "verified": False,
            "tx_hash": tx_hash,
            "network": active_network,
            "ledger": run.stellar_ledger_sequence,
            "explorer_url": explorer_url,
            "timestamp": run.anchored_at.isoformat() if run.anchored_at else None,
            "anchor_status": run.anchor_status or "pending_anchor",
            "error": None,
        }

    candidate_networks = [active_network]
    if network is None and run.stellar_network is None and "testnet" not in candidate_networks:
        candidate_networks.append("testnet")

    stellar_info: dict[str, Any] = {}
    verified_network = active_network
    for candidate_network in candidate_networks:
        stellar_info = await verify_stellar_transaction(
            tx_hash,
            expected_hash_bytes=hash_to_bytes(run.hash),
            network=candidate_network,
        )
        if stellar_info.get("exists") and stellar_info.get("memo_matches"):
            verified_network = candidate_network
            break

    exists = bool(stellar_info.get("exists"))
    memo_matches = bool(stellar_info.get("memo_matches"))
    return {
        "verified": exists and memo_matches,
        "tx_hash": tx_hash,
        "network": verified_network,
        "ledger": stellar_info.get("ledger") or run.stellar_ledger_sequence,
        "explorer_url": stellar_explorer_url(tx_hash, verified_network),
        "timestamp": stellar_info.get("created_at") or (run.anchored_at.isoformat() if run.anchored_at else None),
        "anchor_status": "anchored" if exists and memo_matches else (run.anchor_status or "pending_anchor"),
        "error": stellar_info.get("error"),
    }
