"""Service-level hashing and Stellar anchoring helpers."""

import hashlib
import json
from typing import TypedDict

from app.services.stellar_service import submit_hash_to_stellar


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


async def anchor_hash_to_stellar(evidence_hash: str) -> StellarAnchorResult:
    """
    Anchor a hex SHA-256 evidence hash to Stellar.

    The 32-byte digest is attached as a HashMemo for compact verification, while
    the original hex string is also written through manageData for auditability.
    All failures return a structured result instead of raising.
    """
    return await submit_hash_to_stellar(evidence_hash)
