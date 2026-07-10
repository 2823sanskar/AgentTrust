"""Shared rate-limiting configuration and keys."""

import hashlib

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def execution_rate_limit_key(request: Request) -> str:
    """Rate-limit authenticated executions per bearer token without storing it."""
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token_digest = hashlib.sha256(authorization.encode("utf-8")).hexdigest()
        return f"token:{token_digest}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=get_remote_address)
