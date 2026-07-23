"""Service-level hashing and Stellar anchoring helpers."""

import asyncio
import hashlib
import json
import logging
from typing import Any, TypedDict

from stellar_sdk import HashMemo, Keypair, Network, TransactionBuilder
from stellar_sdk import AiohttpClient
from stellar_sdk.exceptions import BadRequestError, NotFoundError
from stellar_sdk.server_async import ServerAsync

from app.config import settings

logger = logging.getLogger(__name__)

STELLAR_ANCHOR_TIMEOUT_SECONDS = 30


class StellarAnchorResult(TypedDict):
    tx_hash: str | None
    ledger: int | None
    success: bool
    error: str | None


def generate_execution_hash(agent_id: str, prompt: str, stdout: str, exit_code: int) -> str:
    """Generate a deterministic SHA-256 hash for sandbox execution evidence."""
    evidence = {
        "agent_id": str(agent_id),
        "exit_code": int(exit_code),
        "prompt": str(prompt),
        "stdout": str(stdout),
    }
    evidence_json = json.dumps(
        evidence,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(evidence_json.encode("utf-8")).hexdigest()


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


async def anchor_hash_to_stellar(evidence_hash: str) -> StellarAnchorResult:
    """
    Anchor a hex SHA-256 evidence hash to Stellar.

    The 32-byte digest is attached as a HashMemo for compact verification, while
    the original hex string is also written through manageData for auditability.
    All failures return a structured result instead of raising.
    """
    try:
        if not settings.STELLAR_SECRET_KEY:
            return _anchor_error("STELLAR_SECRET_KEY is not configured")

        keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        configured_public_key = (settings.STELLAR_PUBLIC_KEY or "").strip()
        public_key = configured_public_key or keypair.public_key
        if configured_public_key and configured_public_key != keypair.public_key:
            return _anchor_error("STELLAR_PUBLIC_KEY does not match STELLAR_SECRET_KEY")

        try:
            evidence_hash_bytes = bytes.fromhex(evidence_hash)
        except ValueError:
            return _anchor_error("evidence_hash must be a hex SHA-256 digest")
        if len(evidence_hash_bytes) != 32:
            return _anchor_error("evidence_hash must decode to 32 bytes")

        async with ServerAsync(
            horizon_url=settings.STELLAR_HORIZON_URL,
            client=AiohttpClient(),
        ) as server:
            source_account = await asyncio.wait_for(
                server.load_account(public_key),
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
                    source=public_key,
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
        logger.error("Stellar account not found")
        return _anchor_error("Stellar account not found. Fund it on Testnet first.")
    except BadRequestError as exc:
        logger.error("Stellar transaction rejected: %s", exc)
        return _anchor_error(str(exc))
    except Exception as exc:
        logger.error("Stellar anchoring failed: %s", exc)
        return _anchor_error(str(exc))
