import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.retail_media import (
    BrandCampaignResponse,
    TrackEventRequest,
    TrackEventResponse,
    BrandAnalyticsResponse,
)
from app.services.retail_media_service import (
    get_active_promotions,
    record_ad_event,
    get_brand_analytics,
)

logger = logging.getLogger("sebet.media_api")

router = APIRouter()


@router.get("/campaigns", response_model=List[BrandCampaignResponse])
async def list_active_campaigns(
    category: Optional[str] = Query(None, description="Filter campaigns by category (e.g. İçkilər, Süd Məhsulları, ALL)"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Consumer feed endpoint: Returns active sponsored brand campaigns with multiplier boosts.
    """
    campaigns = await get_active_promotions(db=db, category=category, limit=limit)
    return campaigns


@router.post("/track", response_model=TrackEventResponse)
async def track_ad_event(
    payload: TrackEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Telemetry ingestion endpoint:
    - IMPRESSION: logs card viewing event without CPC cost.
    - CLICK: logs user engagement and deducts CPC bid from the brand's budget pool.
    """
    try:
        log, cost = await record_ad_event(
            db=db,
            campaign_id=payload.campaign_id,
            event_type=payload.event_type,
            user_id=payload.user_id,
            metadata=payload.metadata,
        )
        await db.commit()

        # Re-fetch campaign remaining balance
        from app.models.retail_media import BrandCampaign
        camp = await db.get(BrandCampaign, payload.campaign_id)
        remaining = float(camp.budget_pool_remaining) if camp else 0.0

        return TrackEventResponse(
            success=True,
            event_id=log.id,
            campaign_id=payload.campaign_id,
            event_type=log.event_type.value,
            cost_deducted=float(cost),
            budget_pool_remaining=remaining,
            message="Hadisə uğurla qeydə alındı.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error tracking ad event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Reklam hadisəsi qeydə alınarkən daxili xəta baş verdi.",
        )


@router.get("/brand-analytics", response_model=BrandAnalyticsResponse)
async def get_advertiser_analytics(
    brand_name: Optional[str] = Query(None, description="Optional brand name filter (e.g. Coca-Cola)"),
    campaign_id: Optional[uuid.UUID] = Query(None, description="Optional campaign UUID filter"),
    db: AsyncSession = Depends(get_db),
):
    """
    Advertiser reporting endpoint: Returns real-time campaign performance KPIs:
    - Impressions, Clicks, CTR %, Conversions, Total Budget Consumed, and Remaining Pool.
    """
    analytics = await get_brand_analytics(db=db, brand_name=brand_name, campaign_id=campaign_id)
    return analytics
