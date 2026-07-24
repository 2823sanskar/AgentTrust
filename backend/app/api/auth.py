"""
Auth API endpoints: registration, login, current user.
"""

import base64
import binascii
import hashlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from stellar_sdk import Keypair

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    WalletConnectRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/api", tags=["Authentication"])

STELLAR_SIGNED_MESSAGE_PREFIX = b"Stellar Signed Message:\n"


def _wallet_signature_candidates(signature: str) -> list[bytes]:
    candidates: list[bytes] = []
    try:
        candidates.append(base64.b64decode(signature, validate=True))
    except (binascii.Error, ValueError):
        pass
    try:
        candidates.append(bytes.fromhex(signature))
    except ValueError:
        pass
    candidates.append(signature.encode("utf-8"))

    unique: list[bytes] = []
    for candidate in candidates:
        if candidate and candidate not in unique:
            unique.append(candidate)
    return unique


def _wallet_message_payloads(message: str) -> list[bytes]:
    message_bytes = message.encode("utf-8")
    sep53_payload = hashlib.sha256(
        STELLAR_SIGNED_MESSAGE_PREFIX + message_bytes
    ).digest()
    return [sep53_payload, message_bytes]


def _verify_wallet_signature(public_key: str, message: str, signature: str) -> None:
    keypair = Keypair.from_public_key(public_key)
    for payload in _wallet_message_payloads(message):
        for candidate in _wallet_signature_candidates(signature):
            try:
                keypair.verify(payload, candidate)
                return
            except Exception:
                continue
    raise ValueError("Invalid wallet ownership signature")


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new developer or user account."""
    return await auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate and receive JWT token."""
    return await auth_service.login_user(db, data)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return UserResponse.model_validate(current_user)


@router.put("/me/wallet", response_model=UserResponse)
async def connect_wallet(
    data: WalletConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a Stellar wallet public key to the current user."""
    if data.stellar_wallet_network != settings.STELLAR_NETWORK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Switch Freighter to Stellar {settings.STELLAR_NETWORK.title()} "
                "before connecting this wallet."
            ),
        )
    signed_lines = set(data.signature_message.splitlines())
    if f"Address: {data.stellar_wallet_address}" not in signed_lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet signature message must include the public address",
        )
    if "Network: mainnet" not in signed_lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet signature message must identify Stellar Mainnet",
        )
    try:
        _verify_wallet_signature(
            data.stellar_wallet_address,
            data.signature_message,
            data.signature,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid wallet ownership signature") from exc

    current_user.stellar_wallet_address = data.stellar_wallet_address
    current_user.stellar_wallet_network = data.stellar_wallet_network
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.delete("/me/wallet", response_model=UserResponse)
async def disconnect_wallet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the Stellar wallet public key from the current user."""
    current_user.stellar_wallet_address = None
    current_user.stellar_wallet_network = None
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
