"""
AgentTrust Backend — FastAPI Application Entry Point.
Blockchain-backed execution verification and reputation platform for AI agents.
"""

import logging
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import DatabaseError, InterfaceError, OperationalError, SQLAlchemyError

try:
    from asyncpg.exceptions import PostgresError
except ImportError:  # pragma: no cover
    class PostgresError(Exception):
        """Fallback if asyncpg is not directly imported."""
        pass

from app.config import settings
from app.database import DATABASE_UNAVAILABLE_DETAIL, check_db_connection, engine, init_db
from app.api import auth, agents, executions, trust, verify, sandbox, desktop
from app.rate_limit import limiter
from app.services.cleanup_service import run_desktop_cleanup_loop
from app.services.stellar_service import (
    ensure_stellar_anchor_account,
    stellar_anchor_account_ready,
)

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
    logger.info("Connecting to database: %s", engine.url.render_as_string(hide_password=True))
    db_ready = False
    cleanup_stop_event = asyncio.Event()
    cleanup_task: asyncio.Task | None = None
    try:
        await check_db_connection()
        db_ready = True
        logger.info("Database connection verified.")
        if settings.DB_AUTO_CREATE_TABLES:
            await init_db()
            logger.info("Database tables created/verified from ORM metadata.")
    except Exception:
        logger.exception(
            "Database startup failed. Check backend/.env, DATABASE_URL credentials, "
            "Supabase network access, and SSL settings."
        )
        if settings.ENVIRONMENT.lower() == "production":
            raise
        logger.warning(
            "Backend is starting in degraded development mode; database-backed routes "
            "will return HTTP 503 until the connection is fixed."
        )

    if (
        settings.ENVIRONMENT.lower() == "production"
        or settings.STELLAR_SECRET_KEY
        or settings.STELLAR_PUBLIC_KEY
    ):
        await ensure_stellar_anchor_account()

    if db_ready:
        cleanup_task = asyncio.create_task(run_desktop_cleanup_loop(cleanup_stop_event))

    try:
        yield
    finally:
        if cleanup_task:
            cleanup_stop_event.set()
            cleanup_task.cancel()
            with suppress(asyncio.CancelledError):
                await cleanup_task
        await engine.dispose()
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


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
@app.exception_handler(DatabaseError)
@app.exception_handler(SQLAlchemyError)
@app.exception_handler(PostgresError)
async def sqlalchemy_exception_handler(request: Request, exc: Exception):
    logger.error("Database connection failure while handling %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=503,
        content={"detail": DATABASE_UNAVAILABLE_DETAIL},
    )


@app.exception_handler(ConnectionError)
@app.exception_handler(OSError)
async def connection_exception_handler(request: Request, exc: Exception):
    logger.error("Network connection error while handling %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=503,
        content={"detail": DATABASE_UNAVAILABLE_DETAIL},
    )

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
app.include_router(desktop.router)


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
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "stellar_configured": bool(settings.STELLAR_SECRET_KEY and settings.STELLAR_PUBLIC_KEY),
        "stellar_ready": stellar_anchor_account_ready(),
        "stellar_network": settings.STELLAR_NETWORK,
        "sandbox_worker_configured": bool(settings.SANDBOX_WORKER_URL),
    }


@app.get("/api/health")
async def api_health():
    return await health()
