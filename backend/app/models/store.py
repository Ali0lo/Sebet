import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    chain_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("chains.id", ondelete="CASCADE"), nullable=False
    )
    branch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    neighborhood: Mapped[str] = mapped_column(String(100), nullable=True, default="Baku")
    voen: Mapped[str] = mapped_column(String(50), nullable=True)
    obyekt_kodu: Mapped[str] = mapped_column(String(50), nullable=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    chain = relationship("Chain", back_populates="stores")
    prices = relationship("StorePrice", back_populates="store", cascade="all, delete-orphan")
    receipts = relationship("Receipt", back_populates="matched_store")

    __table_args__ = (
        Index("idx_stores_lat_lon", "latitude", "longitude"),
        Index("idx_stores_voen_obyekt", "voen", "obyekt_kodu"),
    )

