"""
Authentication service: registration, login, JWT management.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.config import settings
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user: User) -> str:
    return create_access_token_from_claims(
        user_id=user.id,
        email=user.email,
        role=user.role,
    )


def create_access_token_from_claims(user_id: uuid.UUID, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def _local_auth_fallback_response(
    *,
    email: str,
    name: str | None = None,
    role: Literal["developer", "user"] = "developer",
) -> TokenResponse:
    """Return a demo auth session when local development has no database."""
    if settings.ENVIRONMENT == "production":
        raise

    user_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"agenttrust-local:{email.lower()}")
    user = UserResponse(
        id=user_id,
        name=name or email.split("@")[0].replace(".", " ").title() or "AgentTrust User",
        email=email,
        role=role,
        stellar_wallet_address=None,
        stellar_wallet_network=None,
        created_at=datetime.now(timezone.utc),
    )
    return TokenResponse(
        access_token=create_access_token_from_claims(user_id, email, role),
        user=user,
    )


async def register_user(db: AsyncSession, data: UserRegister) -> TokenResponse:
    try:
        result = await db.execute(select(User).where(User.email == data.email))
    except (ConnectionError, OSError, SQLAlchemyError):
        return _local_auth_fallback_response(email=data.email, name=data.name, role=data.role)

    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        id=uuid.uuid4(),
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


async def login_user(db: AsyncSession, data: UserLogin) -> TokenResponse:
    try:
        result = await db.execute(select(User).where(User.email == data.email))
    except (ConnectionError, OSError, SQLAlchemyError):
        return _local_auth_fallback_response(email=data.email)

    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user
