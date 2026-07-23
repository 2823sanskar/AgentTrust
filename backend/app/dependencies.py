"""
FastAPI dependencies: authentication, database session.
"""

import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import decode_token, get_user_by_id
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that validates JWT and returns the current user."""
    payload = decode_token(credentials.credentials)
    user_id = uuid.UUID(payload["sub"])
    try:
        return await get_user_by_id(db, user_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from exc
        raise


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optional auth dependency - returns None if no token provided."""
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
        return await get_user_by_id(db, user_id)
    except Exception:
        return None
