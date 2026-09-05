from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class FlyerItemOut(BaseModel):
    id: UUID
    product_id: Optional[UUID] = None
    title: str
    discount_price: float
    original_price: float
    discount_percent: int
    image_url: Optional[str] = None
    badge_text: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FlyerOut(BaseModel):
    id: UUID
    chain_name: str
    chain_slug: str
    chain_color: str
    title: str
    start_date: datetime
    end_date: datetime
    pdf_url: Optional[str] = None
    cover_image_url: str
    items: List[FlyerItemOut] = []

    model_config = ConfigDict(from_attributes=True)

