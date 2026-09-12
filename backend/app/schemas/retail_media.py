from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class BrandCampaignResponse(BaseModel):
    id: UUID
    brand_name: str
    title: str
    description: Optional[str] = None
    target_sku_keywords: List[str] = []
    multiplier: float
    cpc_bid: float
    budget_pool_remaining: float
    starts_at: datetime
    ends_at: datetime
    is_active: bool
    banner_image_url: Optional[str] = None
    category: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrackEventRequest(BaseModel):
    campaign_id: UUID
    event_type: str = Field(..., description="IMPRESSION or CLICK")
    user_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None


class TrackEventResponse(BaseModel):
    success: bool
    event_id: UUID
    campaign_id: UUID
    event_type: str
    cost_deducted: float
    budget_pool_remaining: float
    message: str

    model_config = ConfigDict(from_attributes=True)


class BrandAnalyticsCampaignItem(BaseModel):
    id: str
    brand_name: str
    title: str
    multiplier: float
    category: str
    is_active: bool
    cpc_bid: float
    budget_pool_remaining: float
    impressions: int
    clicks: int
    ctr_percent: float
    conversions: int
    spent_usd: float

    model_config = ConfigDict(from_attributes=True)


class BrandAnalyticsResponse(BaseModel):
    total_campaigns: int
    total_impressions: int
    total_clicks: int
    ctr_percent: float
    total_conversions: int
    total_spent_usd: float
    total_budget_remaining_usd: float
    campaigns: List[BrandAnalyticsCampaignItem] = []

    model_config = ConfigDict(from_attributes=True)


class BrandBoostInfo(BaseModel):
    campaign_id: UUID
    brand_name: str
    campaign_title: str
    multiplier: float
    matched_keywords: List[str]
    bonus_points: int
    bonus_usd: float

    model_config = ConfigDict(from_attributes=True)
