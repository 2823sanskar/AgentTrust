"""
Async SQLAlchemy engine and session factory.
Uses asyncpg driver for PostgreSQL.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.exc import DatabaseError, InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from fastapi import HTTPException, status

try:
    from asyncpg.exceptions import PostgresError
except ImportError:  # pragma: no cover
    class PostgresError(Exception):
        """Fallback if asyncpg is not directly imported."""
        pass

from app.config import settings

logger = logging.getLogger(__name__)

DATABASE_UNAVAILABLE_DETAIL = "Database connection failed. Please check DATABASE_URL or DB status."

def _database_engine_options(database_url: str) -> tuple[URL, dict[str, object]]:
    """Build asyncpg-compatible URL and SSL options for Supabase/PostgreSQL."""
    url = make_url(database_url)
    query = dict(url.query)
    connect_args: dict[str, object] = {}

    ssl_mode = query.pop("sslmode", None)
    if ssl_mode:
        connect_args["ssl"] = ssl_mode
        url = url.set(query=query)

    if "pooler.supabase.com" in (url.host or ""):
        connect_args["statement_cache_size"] = 0

    return url, connect_args


database_url, database_connect_args = _database_engine_options(settings.DATABASE_URL)

engine = create_async_engine(
    database_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,      # Re-tests dropped connections before executing queries
    pool_recycle=300,        # Recycles stale connections every 5 mins
    pool_timeout=10,         # Prevents hanging indefinitely on stalled DB queries
    max_overflow=10,
    pool_size=settings.DB_POOL_SIZE,
    connect_args=database_connect_args,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency that provides an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except (ConnectionError, OSError, OperationalError, InterfaceError, DatabaseError, SQLAlchemyError, PostgresError) as exc:
            await session.rollback()
            logger.error("Database connection failure in get_db: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=DATABASE_UNAVAILABLE_DETAIL,
            ) from exc
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables (for development). Use Alembic in production."""
    # Import all models to register them on Base.metadata
    import app.models  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS stellar_ledger_sequence INTEGER"))
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS anchored_at TIMESTAMP WITH TIME ZONE"))
        await conn.execute(
            text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS anchor_status VARCHAR(32) NOT NULL DEFAULT 'pending_anchor'")
        )
        await conn.execute(
            text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_type VARCHAR(32) NOT NULL DEFAULT 'prebuilt'")
        )
        await conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS entrypoint_command TEXT"))
        await conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS required_env_vars JSONB"))
        await conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS source_repo_url VARCHAR(500)"))
        await conn.execute(
            text("UPDATE agents SET agent_type = 'custom_docker' WHERE provider = 'external_docker' AND agent_type = 'prebuilt'")
        )
        await conn.execute(
            text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS is_interactive BOOLEAN NOT NULL DEFAULT false")
        )
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS container_id VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS vnc_port INTEGER"))
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS websockify_port INTEGER"))
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS session_token VARCHAR(255)"))
        await conn.execute(
            text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS desktop_status VARCHAR(32) NOT NULL DEFAULT 'stopped'")
        )
        await conn.execute(text("ALTER TABLE runs ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_runs_is_interactive ON runs (is_interactive)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_runs_desktop_status ON runs (desktop_status)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_runs_last_heartbeat ON runs (last_heartbeat)"))


async def check_db_connection() -> None:
    """Fail fast during startup when PostgreSQL cannot be reached."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
