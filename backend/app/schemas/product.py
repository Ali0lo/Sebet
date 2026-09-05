from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class StorePriceOut(BaseModel):
    store_id: UUID
    branch_name: str
    neighborhood: Optional[str] = None
    chain_name: str
    chain_slug: str
    chain_color: str
    price: float
    promo_price: Optional[float] = None
    is_promo: bool = False
    in_stock: bool = True
    source_type: str
    confidence_score: float = 1.00
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductOut(BaseModel):
    id: UUID
    barcode: Optional[str] = None
    canonical_name: str
    brand: Optional[str] = None
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    unit: str
    pack_size: Optional[str] = None
    image_url: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    prices: List[StorePriceOut] = []

    model_config = ConfigDict(from_attributes=True)


class ProductSearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ProductOut]

