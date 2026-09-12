import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Numeric,
    Integer,
    ForeignKey,
    Index,
    Enum as SQLEnum,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class AccountCategory(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"


class TransactionType(str, Enum):
    EARN = "EARN"
    REDEEM = "REDEEM"
    SETTLEMENT = "SETTLEMENT"
    ADJUSTMENT = "ADJUSTMENT"


class TransactionStatus(str, Enum):
    POSTED = "POSTED"
    REVERSED = "REVERSED"


class EntryDirection(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    account_code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[AccountCategory] = mapped_column(
        SQLEnum(AccountCategory, native_enum=False), nullable=False, index=True
    )
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    chain_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("chains.id", ondelete="CASCADE"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), default=Decimal("0.0000"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    entries: Mapped[List["LedgerEntry"]] = relationship("LedgerEntry", back_populates="account")

    __table_args__ = (
        Index("idx_ledger_acc_user_cat", "user_id", "category"),
        Index("idx_ledger_acc_chain_cat", "chain_id", "category"),
    )


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    transaction_type: Mapped[TransactionType] = mapped_column(
        SQLEnum(TransactionType, native_enum=False), nullable=False, index=True
    )
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(
        SQLEnum(TransactionStatus, native_enum=False), default=TransactionStatus.POSTED, nullable=False
    )
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    entries: Mapped[List["LedgerEntry"]] = relationship(
        "LedgerEntry", back_populates="transaction", cascade="all, delete-orphan"
    )


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("ledger_transactions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    direction: Mapped[EntryDirection] = mapped_column(
        SQLEnum(EntryDirection, native_enum=False), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    points_amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    transaction: Mapped["LedgerTransaction"] = relationship("LedgerTransaction", back_populates="entries")
    account: Mapped["LedgerAccount"] = relationship("LedgerAccount", back_populates="entries")

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_positive_entry_amount"),
        Index("idx_ledger_entries_acc_created", "account_id", "created_at"),
    )
