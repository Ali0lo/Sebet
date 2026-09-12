import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional
from sqlalchemy import (
    String,
    Integer,
    DateTime,
    Numeric,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class RedemptionVoucherStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CLAIMED = "CLAIMED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class RedemptionVoucher(Base):
    __tablename__ = "redemption_vouchers"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    voucher_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("chains.id", ondelete="CASCADE"), nullable=False, index=True
    )
    points_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    usd_value: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    status: Mapped[RedemptionVoucherStatus] = mapped_column(
        SQLEnum(RedemptionVoucherStatus, native_enum=False),
        default=RedemptionVoucherStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    signature: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    redeemed_by_merchant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("chains.id", ondelete="SET NULL"), nullable=True
    )
    ledger_transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("ledger_transactions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cashier_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    user = relationship("User")
    merchant = relationship("Chain", foreign_keys=[merchant_id])
    redeemed_by_merchant = relationship("Chain", foreign_keys=[redeemed_by_merchant_id])
    ledger_transaction = relationship("LedgerTransaction")

