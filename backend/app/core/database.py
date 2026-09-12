import os
import uuid
import logging
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy import text, TypeDecorator, String, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("sebet.database")

# Portable UUID type supporting both PostgreSQL native UUID and SQLite String(36)
class GUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return str(value)
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            else:
                try:
                    return str(uuid.UUID(str(value)))
                except (ValueError, AttributeError, TypeError):
                    return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


# Portable Vector type supporting pgvector Vector(dim) and JSON fallback
class VectorType(TypeDecorator):
    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = 384, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector
                return dialect.type_descriptor(Vector(self.dim))
            except ImportError:
                return dialect.type_descriptor(JSON)
        return dialect.type_descriptor(JSON)

    def process_bind_param(self, value, dialect):
        return value

    def process_result_value(self, value, dialect):
        return value


class Base(DeclarativeBase):
    pass


# Build database engine
db_url = settings.DATABASE_URL

# Fallback to local SQLite if postgres driver or database is missing
try:
    engine = create_async_engine(
        db_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )
except Exception as ex:
    logger.warning(f"Database connection error with '{db_url}': {ex}. Falling back to SQLite.")
    fallback_path = Path(__file__).resolve().parents[3] / "sebet.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{fallback_path}",
        echo=False,
        future=True,
    )

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        # If postgres, enable uuid and vector extensions
        if "postgresql" in str(engine.url):
            try:
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "vector";'))
            except Exception as e:
                logger.warning(f"Extensions could not be created directly (might already exist): {e}")

        await conn.run_sync(Base.metadata.create_all)

        # Ensure new columns exist on ledger_accounts if table was already created
        try:
            await conn.execute(text("ALTER TABLE ledger_accounts ADD COLUMN current_balance NUMERIC(18, 4) DEFAULT 0;"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE ledger_accounts ADD COLUMN version INTEGER DEFAULT 1;"))
        except Exception:
            pass

        # Ensure new columns exist on receipts if table was already created
        receipt_columns = [
            ("merchant_id", "VARCHAR(36)"),
            ("receipt_number", "VARCHAR(100)"),
            ("purchased_at", "TIMESTAMP"),
            ("image_hash", "VARCHAR(64)"),
            ("composite_fingerprint", "VARCHAR(64)"),
            ("status", "VARCHAR(20) DEFAULT 'PENDING'"),
            ("rejection_reason", "VARCHAR(500)"),
            ("ledger_transaction_id", "VARCHAR(36)"),
            ("terminal_id", "VARCHAR(100)"),
        ]
        for col_name, col_type in receipt_columns:
            try:
                await conn.execute(text(f"ALTER TABLE receipts ADD COLUMN {col_name} {col_type};"))
            except Exception:
                pass

        # Ensure category column exists on chains if table was already created
        try:
            await conn.execute(text("ALTER TABLE chains ADD COLUMN category VARCHAR(100) DEFAULT 'Grocery';"))
        except Exception:
            pass

        logger.info("Database schema initialized successfully.")

