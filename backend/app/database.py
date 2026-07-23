"""
Async SQLAlchemy engine and session factory.
Uses asyncpg driver for PostgreSQL.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.exc import DatabaseError, OperationalError, SQLAlchemyError
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from fastapi import HTTPException, status

from app.config import settings

DATABASE_UNAVAILABLE_DETAIL = "Database unavailable. Please verify connectivity or check backend logs."

def _database_engine_options(database_url: str) -> tuple[URL, dict[str, object]]:
    """Build asyncpg-compatible URL and SSL options for Supabase/PostgreSQL."""
    url = make_url(database_url)
    query = dict(url.query)
    connect_args: dict[str, object] = {}

    ssl_mode = query.pop("sslmode", None)
    if ssl_mode:
        connect_args["ssl"] = ssl_mode
        url = url.set(query=query)

    if "pooler.supabase.com" in url.host:
        connect_args["statement_cache_size"] = 0

    return url, connect_args


database_url, database_connect_args = _database_engine_options(settings.DATABASE_URL)

engine = create_async_engine(
    database_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
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
        except (ConnectionError, OSError, OperationalError, DatabaseError, SQLAlchemyError) as exc:
            await session.rollback()
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


async def check_db_connection() -> None:
    """Fail fast during startup when PostgreSQL cannot be reached."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
