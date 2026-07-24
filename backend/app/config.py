"""
Application configuration using Pydantic Settings.
All secrets loaded from environment variables.
"""

import os
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


BACKEND_DIR = Path(__file__).resolve().parents[1]
STELLAR_MAINNET_HORIZON_URL = "https://horizon.stellar.org"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/agenttrust"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT_SECONDS: int = 10
    DB_POOL_RECYCLE_SECONDS: int = 300
    DB_AUTO_CREATE_TABLES: bool = True

    # JWT
    JWT_SECRET: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # Stellar
    STELLAR_SECRET_KEY: str = ""
    STELLAR_PUBLIC_KEY: str = ""
    STELLAR_NETWORK: str = "mainnet"
    STELLAR_HORIZON_URL: str = STELLAR_MAINNET_HORIZON_URL
    STELLAR_MAX_BASE_FEE: int = 10_000

    # AI Provider
    OPENROUTER_API_KEY: str = ""

    # Browser Agent
    BROWSER_AGENT_HEADLESS: bool = True
    BROWSER_AGENT_ACTION_TIMEOUT_MS: int = 45000
    BROWSER_AGENT_NAVIGATION_TIMEOUT_MS: int = 60000

    # Decoupled Sandbox Worker
    SANDBOX_WORKER_URL: Optional[str] = "http://localhost:8001"

    # App
    APP_NAME: str = "AgentTrust"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    DEBUG: bool = True

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Normalize provider URLs to the async SQLAlchemy PostgreSQL driver."""
        if not isinstance(value, str):
            return value

        database_url = value.strip()
        if database_url.startswith("postgres://"):
            return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        if database_url.startswith("postgresql://"):
            return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return database_url

    def __init__(self, **values):
        super().__init__(**values)

        network_aliases = {
            "mainnet": "mainnet",
            "public": "mainnet",
            "pubnet": "mainnet",
        }
        configured_network = self.STELLAR_NETWORK.strip().lower()
        normalized_network = network_aliases.get(configured_network)
        if not normalized_network:
            raise ValueError(
                "AgentTrust anchoring is Mainnet-only; STELLAR_NETWORK must be "
                "mainnet, public, or pubnet"
            )

        horizon_url = self.STELLAR_HORIZON_URL.strip().rstrip("/")
        if not horizon_url.startswith("https://"):
            raise ValueError("STELLAR_HORIZON_URL must use HTTPS for Mainnet")
        if "testnet" in horizon_url.lower() or "friendbot" in horizon_url.lower():
            raise ValueError(
                "STELLAR_NETWORK=mainnet cannot use a Testnet Horizon endpoint"
            )
        if self.STELLAR_MAX_BASE_FEE < 100:
            raise ValueError("STELLAR_MAX_BASE_FEE must be at least 100 stroops")

        object.__setattr__(self, "STELLAR_NETWORK", normalized_network)
        object.__setattr__(self, "STELLAR_HORIZON_URL", horizon_url)

        raw_url = self.SANDBOX_WORKER_URL or os.getenv("SANDBOX_WORKER_URL", "http://localhost:8001")
        if raw_url and isinstance(raw_url, str):
            cleaned = raw_url.strip().rstrip("/")
            if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
                raise ValueError(
                    f"CRITICAL CONFIG ERROR: SANDBOX_WORKER_URL '{raw_url}' "
                    f"is missing a valid protocol scheme (http:// or https://)."
                )
            object.__setattr__(self, "SANDBOX_WORKER_URL", cleaned)
        else:
            object.__setattr__(self, "SANDBOX_WORKER_URL", None)

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    def validate_production(self) -> None:
        if self.ENVIRONMENT.lower() != "production":
            return
        missing = []
        if self.JWT_SECRET == "change-this-secret-key":
            missing.append("JWT_SECRET")
        if not self.STELLAR_SECRET_KEY:
            missing.append("STELLAR_SECRET_KEY")
        if not self.STELLAR_PUBLIC_KEY:
            missing.append("STELLAR_PUBLIC_KEY")
        if self.STELLAR_NETWORK != "mainnet":
            missing.append("STELLAR_NETWORK=mainnet")
        if not self.STELLAR_HORIZON_URL.startswith("https://"):
            missing.append("STELLAR_HORIZON_URL with HTTPS")
        if self.STELLAR_MAX_BASE_FEE < 100:
            missing.append("STELLAR_MAX_BASE_FEE>=100")
        if self.DATABASE_URL.startswith("postgresql+asyncpg://postgres:password@localhost"):
            missing.append("DATABASE_URL")
        if missing:
            raise RuntimeError(f"Unsafe production config: {', '.join(missing)}")

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
