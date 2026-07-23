"""Phase 2.5 Stellar hashing, anchoring, and receipt verification helpers."""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, TypedDict

import httpx
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
FRIENDBOT_TIMEOUT_SECONDS = 20
TERMINAL_RUN_STATUSES = {"success", "failure", "completed", "failed"}
_runtime_keypair: Keypair | None = None
_runtime_keypair_funded = False
_runtime_keypair_lock = asyncio.Lock()


class StellarReceipt(TypedDict):
    verified: bool
    tx_hash: str | None
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


def stellar_explorer_url(tx_hash: str | None, network: str = "testnet") -> str | None:
    if not tx_hash:
        return None
    network_path = "public" if network.lower() == "mainnet" else "testnet"
    return f"https://stellar.expert/explorer/{network_path}/tx/{tx_hash}"


def _network_passphrase() -> str:
    if settings.STELLAR_NETWORK.lower() == "mainnet":
        return Network.PUBLIC_NETWORK_PASSPHRASE
    return Network.TESTNET_NETWORK_PASSPHRASE


def _anchor_error(message: str) -> StellarAnchorResult:
    return {
        "tx_hash": None,
        "ledger": None,
        "success": False,
        "error": message,
    }


async def _fund_testnet_account(public_key: str) -> None:
    if settings.STELLAR_NETWORK.lower() == "mainnet":
        return

    async with httpx.AsyncClient(timeout=FRIENDBOT_TIMEOUT_SECONDS) as client:
        response = await client.get(
            "https://friendbot.stellar.org",
            params={"addr": public_key},
        )
        response.raise_for_status()


async def _get_anchor_keypair() -> Keypair:
    """Return a configured or generated Testnet keypair, funding generated accounts once."""
    global _runtime_keypair, _runtime_keypair_funded

    async with _runtime_keypair_lock:
        if _runtime_keypair is None:
            configured_secret = (settings.STELLAR_SECRET_KEY or "").strip()
            configured_public = (settings.STELLAR_PUBLIC_KEY or "").strip()
            try:
                if configured_secret:
                    keypair = Keypair.from_secret(configured_secret)
                    if configured_public and configured_public != keypair.public_key:
                        raise ValueError("STELLAR_PUBLIC_KEY does not match STELLAR_SECRET_KEY")
                    _runtime_keypair = keypair
                    _runtime_keypair_funded = True
                else:
                    raise ValueError("STELLAR_SECRET_KEY is not configured")
            except Exception as exc:
                if settings.STELLAR_NETWORK.lower() == "mainnet":
                    raise ValueError("Valid STELLAR_SECRET_KEY is required on mainnet") from exc
                _runtime_keypair = Keypair.random()
                _runtime_keypair_funded = False
                logger.warning(
                    "Generated temporary Stellar Testnet anchor account: %s",
                    _runtime_keypair.public_key,
                )

        if not _runtime_keypair_funded and settings.STELLAR_NETWORK.lower() != "mainnet":
            try:
                await _fund_testnet_account(_runtime_keypair.public_key)
                _runtime_keypair_funded = True
                logger.info("Funded temporary Stellar Testnet anchor account: %s", _runtime_keypair.public_key)
            except Exception as exc:
                logger.error("Friendbot funding failed for %s: %s", _runtime_keypair.public_key, exc)

        return _runtime_keypair


async def ensure_stellar_anchor_account() -> None:
    """Prepare the Stellar anchor account during startup when possible."""
    try:
        keypair = await _get_anchor_keypair()
        logger.info("Stellar %s anchor account ready: %s", settings.STELLAR_NETWORK, keypair.public_key)
    except Exception as exc:
        logger.error("Stellar anchor account startup check failed: %s", exc)


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
            "stellar_ledger_sequence": anchor["ledger"],
            "anchored_at": datetime.now(timezone.utc),
            "anchor_status": "anchored",
            "anchor_error": None,
        }

    return {
        "hash": evidence_hash,
        "stellar_transaction": None,
        "stellar_ledger_sequence": None,
        "anchored_at": None,
        "anchor_status": "pending_anchor",
        "anchor_error": anchor.get("error"),
    }


async def submit_hash_to_stellar(evidence_hash: str) -> StellarAnchorResult:
    """Anchor a SHA-256 hash to Stellar using configured or generated Testnet keys."""
    try:
        try:
            evidence_hash_bytes = bytes.fromhex(evidence_hash)
        except ValueError:
            return _anchor_error("evidence_hash must be a hex SHA-256 digest")
        if len(evidence_hash_bytes) != 32:
            return _anchor_error("evidence_hash must decode to 32 bytes")

        keypair = await _get_anchor_keypair()

        async with ServerAsync(
            horizon_url=settings.STELLAR_HORIZON_URL,
            client=AiohttpClient(),
        ) as server:
            source_account = await asyncio.wait_for(
                server.load_account(keypair.public_key),
                timeout=STELLAR_ANCHOR_TIMEOUT_SECONDS,
            )
            transaction = (
                TransactionBuilder(
                    source_account=source_account,
                    network_passphrase=_network_passphrase(),
                    base_fee=100,
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
        logger.error("Stellar account not found after Friendbot funding attempt")
        return _anchor_error("Stellar account not found")
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
    if run.stellar_transaction and run.anchor_status == "anchored":
        return run

    anchor_fields = await anchor_run_hash(run)
    run.hash = anchor_fields["hash"]
    run.stellar_transaction = anchor_fields["stellar_transaction"]
    run.stellar_ledger_sequence = anchor_fields["stellar_ledger_sequence"]
    run.anchored_at = anchor_fields["anchored_at"]
    run.anchor_status = anchor_fields["anchor_status"]
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def verify_run_receipt(run: Run, *, network: str = "testnet") -> StellarReceipt:
    """Verify stored Stellar receipt against the local execution hash."""
    tx_hash = run.stellar_transaction
    explorer_url = stellar_explorer_url(tx_hash, network)
    if not tx_hash or not run.hash:
        return {
            "verified": False,
            "tx_hash": tx_hash,
            "ledger": run.stellar_ledger_sequence,
            "explorer_url": explorer_url,
            "timestamp": run.anchored_at.isoformat() if run.anchored_at else None,
            "anchor_status": run.anchor_status or "pending_anchor",
            "error": None,
        }

    stellar_info = await verify_stellar_transaction(
        tx_hash,
        expected_hash_bytes=hash_to_bytes(run.hash),
    )
    exists = bool(stellar_info.get("exists"))
    memo_matches = bool(stellar_info.get("memo_matches"))
    return {
        "verified": exists and memo_matches,
        "tx_hash": tx_hash,
        "ledger": stellar_info.get("ledger") or run.stellar_ledger_sequence,
        "explorer_url": explorer_url,
        "timestamp": stellar_info.get("created_at") or (run.anchored_at.isoformat() if run.anchored_at else None),
        "anchor_status": "anchored" if exists and memo_matches else (run.anchor_status or "pending_anchor"),
        "error": stellar_info.get("error"),
    }
