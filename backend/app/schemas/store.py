from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class StoreOut(BaseModel):
    id: UUID
    branch_name: str
    neighborhood: Optional[str] = None
    chain_name: str
    chain_slug: str
    chain_color: str
    voen: Optional[str] = None
    obyekt_kodu: Optional[str] = None
    address: str
    latitude: float
    longitude: float
    distance_km: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class CategoryOut(BaseModel):
    id: UUID
    name_az: str
    name_en: Optional[str] = None
    slug: str
    icon_name: Optional[str] = None
    product_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: UUID
    phone_number: str
    full_name: Optional[str] = None
    sebet_points: int

    model_config = ConfigDict(from_attributes=True)


class RedeemRequest(BaseModel):
    reward_id: str
    points_cost: int
    title: str


class RedeemResponse(BaseModel):
    success: bool
    voucher_code: str
    remaining_points: int
    reward_title: str
    message: str

