"""
SHA-256 hashing utility for execution records.
Creates a deterministic hash of the execution data for blockchain anchoring.
"""

import hashlib
import json
from datetime import datetime
from typing import Optional
from uuid import UUID


class UUIDEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles UUID and datetime objects."""
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def compute_execution_hash(
    run_id: UUID,
    agent_id: UUID,
    user_id: UUID,
    task: str,
    response: Optional[str],
    status: str,
    execution_time: Optional[float],
    created_at: datetime,
    action_log: Optional[list[dict]] = None,
) -> str:
    """
    Compute a SHA-256 hash of an execution record.
    
    The hash covers all critical fields of the execution to ensure
    any tampering with the stored record is detectable.
    
    Returns:
        64-character hex digest string.
    """
    record = {
        "run_id": run_id,
        "agent_id": agent_id,
        "user_id": user_id,
        "task": task,
        "response": response,
        "status": status,
        "execution_time": execution_time,
        "created_at": created_at,
    }
    if action_log is not None:
        record["action_log"] = action_log

    # Deterministic JSON serialization (sorted keys, no whitespace)
    record_json = json.dumps(record, sort_keys=True, cls=UUIDEncoder)
    
    return hashlib.sha256(record_json.encode("utf-8")).hexdigest()


def hash_to_bytes(hex_hash: str) -> bytes:
    """Convert a 64-char hex hash to 32-byte bytes for Stellar memo."""
    return bytes.fromhex(hex_hash)
