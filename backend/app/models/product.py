import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID, VectorType


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    barcode: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    canonical_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    unit: Mapped[str] = mapped_column(String(20), default="piece")
    pack_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    embedding: Mapped[Optional[List[float]]] = mapped_column(VectorType(384), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    category = relationship("Category", back_populates="products")
    prices = relationship("StorePrice", back_populates="product", cascade="all, delete-orphan")
    receipt_items = relationship("ReceiptItem", back_populates="matched_product")

    __table_args__ = (
        Index("idx_products_name_brand", "canonical_name", "brand"),
    )

