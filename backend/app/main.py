"""
AgentTrust Backend — FastAPI Application Entry Point.
Blockchain-backed execution verification and reputation platform for AI agents.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import DatabaseError, OperationalError, SQLAlchemyError

from app.config import settings
from app.database import DATABASE_UNAVAILABLE_DETAIL, check_db_connection, engine, init_db
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
    logger.info("Connecting to database: %s", engine.url.render_as_string(hide_password=True))
    try:
        await check_db_connection()
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

    try:
        yield
    finally:
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
@app.exception_handler(DatabaseError)
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error while handling %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=503,
        content={"detail": DATABASE_UNAVAILABLE_DETAIL},
    )


@app.exception_handler(ConnectionError)
async def connection_exception_handler(request: Request, exc: ConnectionError):
    logger.exception("Connection error while handling %s %s", request.method, request.url.path)
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
        "stellar_network": settings.STELLAR_NETWORK,
        "sandbox_worker_configured": bool(settings.SANDBOX_WORKER_URL),
    }


@app.get("/api/health")
async def api_health():
    return await health()
