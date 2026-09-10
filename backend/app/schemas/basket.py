from typing import List, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field


class BasketItemIn(BaseModel):
    product_id: UUID
    quantity: float = Field(default=1.0, gt=0)


class BasketOptimizeIn(BaseModel):
    items: List[BasketItemIn]
    latitude: float = 40.3800  # Default 28 May, Baku
    longitude: float = 49.8475
    max_walking_distance_m: float = 750.0


class BasketItemDetail(BaseModel):
    product_id: Union[UUID, str]
    product_name: str
    brand: Optional[str] = None
    quantity: float
    unit_price: float
    total_price: float


class SingleStoreResult(BaseModel):
    store_id: Union[UUID, str]
    branch_name: str
    neighborhood: Optional[str] = None
    chain_name: str
    chain_slug: str
    chain_color: str
    address: str
    latitude: float
    longitude: float
    total_cost: float
    coverage_pct: float
    distance_km: float
    items: List[BasketItemDetail]
    missing_items_count: int = 0


class SplitStoreInfo(BaseModel):
    store_id: Union[UUID, str]
    branch_name: str
    neighborhood: Optional[str] = None
    chain_name: str
    chain_slug: str
    chain_color: str
    address: str
    latitude: float
    longitude: float
    subtotal: float
    items: List[BasketItemDetail]


class SplitStoreResult(BaseModel):
    is_split_viable: bool = False
    primary_store: SplitStoreInfo
    secondary_store: SplitStoreInfo
    store_1: Optional[SplitStoreInfo] = None
    store_2: Optional[SplitStoreInfo] = None
    total_cost: float
    savings_azn: float
    savings_vs_single_azn: float = 0.0
    savings_percent: float = 0.0
    walking_distance_meters: float
    distance_between_stores_m: float = 0.0


class BasketOptimizeResponse(BaseModel):
    basket_count: int
    is_split_viable: bool = False
    single_store_baseline: Optional[SingleStoreResult] = None
    best_single_store: Optional[SingleStoreResult] = None
    best_split_store: Optional[SplitStoreResult] = None
    all_single_stores: List[SingleStoreResult] = []

