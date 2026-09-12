import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from sqlalchemy import (
    String,
    Float,
    Integer,
    DateTime,
    Numeric,
    ForeignKey,
    Text,
    Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class ReceiptStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FLAGGED_REVIEW = "FLAGGED_REVIEW"


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    merchant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("chains.id", ondelete="SET NULL"), nullable=True, index=True
    )
    receipt_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    image_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    composite_fingerprint: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[ReceiptStatus] = mapped_column(
        SQLEnum(ReceiptStatus, native_enum=False), default=ReceiptStatus.PENDING, index=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ledger_transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("ledger_transactions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    terminal_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Backward compatibility & OCR integration fields
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, default="")
    fiscal_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    voen: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    obyekt_kodu: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    matched_store_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True
    )
    receipt_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    raw_ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(30), default="PENDING"
    )  # 'PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE'
    sebet_points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    # Relationships
    user = relationship("User")
    merchant = relationship("Chain")
    matched_store = relationship("Store", back_populates="receipts")
    ledger_transaction = relationship("LedgerTransaction")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    receipt_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False
    )
    raw_line_text: Mapped[str] = mapped_column(String(255), nullable=False)
    matched_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[float] = mapped_column(Float, default=1.00)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, default=1.00)

    receipt = relationship("Receipt", back_populates="items")
    matched_product = relationship("Product", back_populates="receipt_items")
