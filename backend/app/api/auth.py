"""
Auth API endpoints: registration, login, current user.
"""

import base64

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from stellar_sdk import Keypair

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
    if data.stellar_wallet_address not in data.signature_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wallet signature message must include the public address")
    try:
        keypair = Keypair.from_public_key(data.stellar_wallet_address)
        try:
            signature = base64.b64decode(data.signature)
        except Exception:
            signature = bytes.fromhex(data.signature)
        keypair.verify(data.signature_message.encode("utf-8"), signature)
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
