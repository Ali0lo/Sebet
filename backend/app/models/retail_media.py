import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Any
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Numeric,
    Float,
    ForeignKey,
    Index,
    JSON,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class AdEventType(str, Enum):
    IMPRESSION = "IMPRESSION"
    CLICK = "CLICK"
    CONVERSION_EARN = "CONVERSION_EARN"


class BrandCampaign(Base):
    __tablename__ = "brand_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    brand_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    target_sku_keywords: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    multiplier: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    cpc_bid: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), default=Decimal("0.2500"), nullable=False
    )
    budget_pool_remaining: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), default=Decimal("500.0000"), nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="İçkilər", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    impression_logs: Mapped[List["CampaignImpressionLog"]] = relationship(
        "CampaignImpressionLog", back_populates="campaign", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_brand_campaign_active_budget", "is_active", "budget_pool_remaining"),
        Index("idx_brand_campaign_dates", "starts_at", "ends_at"),
    )


class CampaignImpressionLog(Base):
    __tablename__ = "campaign_impression_logs"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("brand_campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[AdEventType] = mapped_column(
        SQLEnum(AdEventType, native_enum=False), nullable=False, index=True
    )
    cost_deducted: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), default=Decimal("0.0000"), nullable=False
    )
    receipt_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    metadata_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    campaign: Mapped["BrandCampaign"] = relationship("BrandCampaign", back_populates="impression_logs")

    __table_args__ = (
        Index("idx_ad_event_campaign_type", "campaign_id", "event_type"),
        Index("idx_ad_event_created", "created_at"),
    )
