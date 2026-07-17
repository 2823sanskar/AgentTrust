"""Pydantic schemas for User requests and responses."""

import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="developer", pattern="^(developer|user)$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    stellar_wallet_address: str | None = None
    stellar_wallet_network: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletConnectRequest(BaseModel):
    stellar_wallet_address: str = Field(
        ...,
        pattern=r"^G[A-Z2-7]{55}$",
        description="Stellar public account ID.",
    )
    stellar_wallet_network: str = Field(default="testnet", max_length=20)
    signature_message: str = Field(..., min_length=16, max_length=500)
    signature: str = Field(..., min_length=16, max_length=500)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str  # user id
    email: str
    role: str
    exp: int
