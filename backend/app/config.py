"""
Application configuration using Pydantic Settings.
All secrets loaded from environment variables.
"""

import os

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/agenttrust"

    # JWT
    JWT_SECRET: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # Stellar
    STELLAR_SECRET_KEY: str = ""
    STELLAR_PUBLIC_KEY: str = ""
    STELLAR_NETWORK: str = "testnet"
    STELLAR_HORIZON_URL: str = "https://horizon-testnet.stellar.org"

    # AI Provider
    OPENROUTER_API_KEY: str = ""

    # Browser Agent
    BROWSER_AGENT_HEADLESS: bool = True
    BROWSER_AGENT_ACTION_TIMEOUT_MS: int = 45000
    BROWSER_AGENT_NAVIGATION_TIMEOUT_MS: int = 60000

    # Decoupled Sandbox Worker
    SANDBOX_WORKER_URL: Optional[str] = None

    # App
    APP_NAME: str = "AgentTrust"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    DEBUG: bool = True

    def __init__(self, **values):
        super().__init__(**values)

        raw_url = self.SANDBOX_WORKER_URL or os.getenv("SANDBOX_WORKER_URL", "")
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
        if self.DEBUG:
            return
        missing = []
        if self.JWT_SECRET == "change-this-secret-key":
            missing.append("JWT_SECRET")
        if not self.STELLAR_SECRET_KEY:
            missing.append("STELLAR_SECRET_KEY")
        if self.DATABASE_URL.startswith("postgresql+asyncpg://postgres:password@localhost"):
            missing.append("DATABASE_URL")
        if missing:
            raise RuntimeError(f"Unsafe production config: {', '.join(missing)}")

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
