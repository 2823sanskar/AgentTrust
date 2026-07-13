"""
Application configuration using Pydantic Settings.
All secrets loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from typing import List


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

    # App
    APP_NAME: str = "AgentTrust"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    DEBUG: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
