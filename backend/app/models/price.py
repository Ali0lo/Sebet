import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Float, Boolean, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class StorePrice(Base):
    __tablename__ = "store_prices"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False
    )
    price: Mapped[float] = mapped_column(Float, nullable=False)
    promo_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_promo: Mapped[bool] = mapped_column(Boolean, default=False)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    source_type: Mapped[str] = mapped_column(
        String(30), default="web_scraper"
    )  # 'web_scraper', 'receipt_ocr', 'weekly_flyer'
    confidence_score: Mapped[float] = mapped_column(Float, default=1.00)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    product = relationship("Product", back_populates="prices")
    store = relationship("Store", back_populates="prices")

    __table_args__ = (
        Index("idx_store_prices_lookup", "product_id", "store_id", "recorded_at"),
    )

