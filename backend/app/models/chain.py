import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base, GUID


class Chain(Base):
    __tablename__ = "chains"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(20), nullable=True, default="#10B981")
    category: Mapped[str] = mapped_column(String(100), default="Grocery", index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    stores = relationship("Store", back_populates="chain", cascade="all, delete-orphan")
    flyers = relationship("Flyer", back_populates="chain", cascade="all, delete-orphan")

