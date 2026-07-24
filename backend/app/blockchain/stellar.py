"""
Stellar integration for anchoring execution hashes on-chain.
Uses a self-payment transaction with a HashMemo containing the SHA-256 digest.
Uses the async ServerAsync client to avoid blocking the asyncio event loop.
"""

import asyncio
import logging
import base64
from typing import Optional

from stellar_sdk import (
    Keypair,
    TransactionBuilder,
    Network,
    Asset,
    HashMemo,
)
from stellar_sdk import AiohttpClient
from stellar_sdk.server_async import ServerAsync
from stellar_sdk.exceptions import (
    BadRequestError,
    NotFoundError,
)

from app.config import settings

logger = logging.getLogger(__name__)

# Maximum time (seconds) to wait for Stellar operations
STELLAR_TIMEOUT_SECONDS = 30


def _get_keypair() -> Keypair:
    if not settings.STELLAR_SECRET_KEY:
        raise ValueError("STELLAR_SECRET_KEY is not configured")
    return Keypair.from_secret(settings.STELLAR_SECRET_KEY)


def _active_network(network: str | None = None) -> str:
    active_network = (network or settings.STELLAR_NETWORK).strip().lower()
    if active_network not in {"mainnet", "testnet"}:
        raise ValueError(f"Unsupported Stellar network: {active_network}")
    return active_network


def _network_passphrase() -> str:
    return Network.PUBLIC_NETWORK_PASSPHRASE


def _horizon_url(network: str | None = None) -> str:
    active_network = _active_network(network)
    if active_network == settings.STELLAR_NETWORK:
        return settings.STELLAR_HORIZON_URL
    if active_network == "mainnet":
        return "https://horizon.stellar.org"
    return "https://horizon-testnet.stellar.org"


async def anchor_hash_on_stellar(execution_hash_bytes: bytes) -> Optional[str]:
    """
    Anchor a 32-byte SHA-256 hash on the configured Stellar network.

    Creates a minimal self-payment transaction (0.0000001 XLM to self)
    with the execution hash as a HashMemo.

    Uses the async ServerAsync client so this function never blocks
    the asyncio event loop.

    Args:
        execution_hash_bytes: 32-byte SHA-256 hash

    Returns:
        Transaction hash/ID string if successful, None if failed.
    """
    try:
        keypair = _get_keypair()
        configured_public_key = (settings.STELLAR_PUBLIC_KEY or "").strip()
        if not configured_public_key or configured_public_key != keypair.public_key:
            raise ValueError(
                "STELLAR_PUBLIC_KEY must match STELLAR_SECRET_KEY for Mainnet anchoring"
            )

        async with ServerAsync(
            horizon_url=settings.STELLAR_HORIZON_URL,
            client=AiohttpClient(),
        ) as server:
            # Load the source account asynchronously
            source_account = await asyncio.wait_for(
                server.load_account(keypair.public_key),
                timeout=STELLAR_TIMEOUT_SECONDS,
            )

            base_fee = max(
                100,
                await asyncio.wait_for(
                    server.fetch_base_fee(),
                    timeout=STELLAR_TIMEOUT_SECONDS,
                ),
            )
            if base_fee > settings.STELLAR_MAX_BASE_FEE:
                raise ValueError(
                    "Recommended Stellar base fee exceeds STELLAR_MAX_BASE_FEE"
                )

            # Build transaction with hash memo
            transaction = (
                TransactionBuilder(
                    source_account=source_account,
                    network_passphrase=_network_passphrase(),
                    base_fee=base_fee,
                )
                .append_payment_op(
                    destination=keypair.public_key,  # Self-payment
                    asset=Asset.native(),
                    amount="0.0000001",  # Minimum amount
                )
                .add_memo(HashMemo(execution_hash_bytes))
                .set_timeout(30)
                .build()
            )

            # Sign and submit
            transaction.sign(keypair)
            response = await asyncio.wait_for(
                server.submit_transaction(transaction),
                timeout=STELLAR_TIMEOUT_SECONDS,
            )

            tx_hash = response.get("hash", "")
            logger.info(f"Stellar transaction submitted: {tx_hash}")
            return tx_hash

    except asyncio.TimeoutError:
        logger.error("Stellar transaction timed out after %ds", STELLAR_TIMEOUT_SECONDS)
        return None
    except NotFoundError:
        logger.error(
            "Stellar account not found on %s. Check the configured account and network.",
            settings.STELLAR_NETWORK,
        )
        return None
    except BadRequestError as e:
        logger.error(f"Stellar transaction failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Stellar anchoring error: {e}")
        return None


async def verify_stellar_transaction(
    tx_hash: str,
    expected_hash_bytes: bytes | None = None,
    network: str | None = None,
) -> dict:
    """
    Verify a transaction exists on the configured Stellar network and retrieve its memo.

    Uses the async ServerAsync client so this function never blocks
    the asyncio event loop.

    Returns:
        Dict with 'exists', 'memo_hash', and 'created_at' fields.
    """
    try:
        async with ServerAsync(
            horizon_url=_horizon_url(network),
            client=AiohttpClient(),
        ) as server:
            tx = await asyncio.wait_for(
                server.transactions().transaction(tx_hash).call(),
                timeout=STELLAR_TIMEOUT_SECONDS,
            )

            memo = tx.get("memo", "")
            memo_type = tx.get("memo_type", "")
            memo_matches = None
            if expected_hash_bytes is not None:
                expected_memo = base64.b64encode(expected_hash_bytes).decode("ascii")
                memo_matches = memo_type == "hash" and memo == expected_memo

            return {
                "exists": True,
                "memo_type": memo_type,
                "memo": memo,
                "memo_matches": memo_matches,
                "ledger": tx.get("ledger"),
                "created_at": tx.get("created_at", ""),
                "source_account": tx.get("source_account", ""),
            }
    except asyncio.TimeoutError:
        logger.error("Stellar verification timed out")
        return {"exists": False, "error": "timeout"}
    except NotFoundError:
        return {"exists": False}
    except Exception as e:
        logger.error(f"Stellar verification error: {e}")
        return {"exists": False, "error": str(e)}
