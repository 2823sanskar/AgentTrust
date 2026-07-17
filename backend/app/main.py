"""
AgentTrust Backend — FastAPI Application Entry Point.
Blockchain-backed execution verification and reputation platform for AI agents.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import init_db
from app.api import auth, agents, executions, trust, verify, sandbox
from app.rate_limit import limiter

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    settings.validate_production()
    logger.info(f"Starting {settings.APP_NAME} backend...")
    # Create tables in dev mode
    if settings.DEBUG:
        await init_db()
        logger.info("Database tables created/verified.")
    yield
    logger.info(f"Shutting down {settings.APP_NAME} backend...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Blockchain-backed execution verification and reputation platform for AI agents.",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(executions.router)
app.include_router(trust.router)
app.include_router(verify.router)
app.include_router(sandbox.router)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "description": "Blockchain-backed execution verification for AI agents",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
