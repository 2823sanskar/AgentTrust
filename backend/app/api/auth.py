"""
Auth API endpoints: registration, login, current user.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

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
