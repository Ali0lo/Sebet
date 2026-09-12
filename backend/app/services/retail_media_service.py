import uuid
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.retail_media import BrandCampaign, CampaignImpressionLog, AdEventType
from app.services.ledger_service import POINTS_PER_DOLLAR

logger = logging.getLogger("sebet.retail_media")


def ensure_utc(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


DEFAULT_SEED_CAMPAIGNS = [
    {
        "brand_name": "Coca-Cola",
        "title": "Yay Təravəti: 5x Bal Qazan",
        "description": "Bütün Coca-Cola, Fanta, Sprite və Fuse Tea içkilərinə 5 qat Sebet loyallıq balı!",
        "target_sku_keywords": ["coca-cola", "cola", "fanta", "sprite", "fuse tea", "cappy"],
        "multiplier": 5.0,
        "cpc_bid": Decimal("0.2500"),
        "budget_pool_remaining": Decimal("250.0000"),
        "banner_image_url": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
        "category": "İçkilər",
        "duration_days": 30,
    },
    {
        "brand_name": "Milla",
        "title": "Təbii Süd Məhsullarına 4x Bal",
        "description": "Milla süd, qatıq, ayran, kəsmik və kərə yağı alışında 4x Sebet balı qazanın.",
        "target_sku_keywords": ["milla", "milla sud", "milla qatig", "milla ayran", "milla kesmik"],
        "multiplier": 4.0,
        "cpc_bid": Decimal("0.2000"),
        "budget_pool_remaining": Decimal("200.0000"),
        "banner_image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80",
        "category": "Süd Məhsulları",
        "duration_days": 25,
    },
    {
        "brand_name": "Ariel",
        "title": "Təmizlik Festivalı: 5x Bal",
        "description": "Ariel yuyucu tozları və kapsulları ilə paltarlarınız təravətli, xallarınız 5 qat olsun.",
        "target_sku_keywords": ["ariel", "ariel toz", "ariel dag teraveti", "ariel kapsul", "tide"],
        "multiplier": 5.0,
        "cpc_bid": Decimal("0.3000"),
        "budget_pool_remaining": Decimal("300.0000"),
        "banner_image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80",
        "category": "Məişət",
        "duration_days": 40,
    },
    {
        "brand_name": "Red Bull",
        "title": "Qanadlandırıcı Təklif: 6x Bal",
        "description": "Red Bull enerji içkiləri alış-verişinizə dərhal 6x loyalty balı qazandırır.",
        "target_sku_keywords": ["red bull", "redbull", "red bull 250ml", "red bull sugarfree"],
        "multiplier": 6.0,
        "cpc_bid": Decimal("0.3500"),
        "budget_pool_remaining": Decimal("150.0000"),
        "banner_image_url": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
        "category": "İçkilər",
        "duration_days": 15,
    },
    {
        "brand_name": "Bizim Süfrə",
        "title": "Bərəkətli Süfrələrə 3x Bal",
        "description": "Bizim Süfrə mayonez və sousları ilə hər yemək daha ləziz, hər alış 3x daha sərfəli.",
        "target_sku_keywords": ["bizim sufre", "bizim süfrə", "bizim sufre mayonez"],
        "multiplier": 3.0,
        "cpc_bid": Decimal("0.1500"),
        "budget_pool_remaining": Decimal("100.0000"),
        "banner_image_url": "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80",
        "category": "Qida & Ərzaq",
        "duration_days": 20,
    },
]


async def seed_default_campaigns(db: AsyncSession) -> List[BrandCampaign]:
    """
    Auto-seeds top FMCG brand campaigns if no campaigns exist in the database.
    """
    stmt = select(func.count(BrandCampaign.id))
    count = (await db.execute(stmt)).scalar() or 0
    if count > 0:
        return []

    now = datetime.now(timezone.utc)
    created: List[BrandCampaign] = []

    for item in DEFAULT_SEED_CAMPAIGNS:
        starts_at = now - timedelta(days=1)
        ends_at = now + timedelta(days=item["duration_days"])
        camp = BrandCampaign(
            id=uuid.uuid4(),
            brand_name=item["brand_name"],
            title=item["title"],
            description=item["description"],
            target_sku_keywords=item["target_sku_keywords"],
            multiplier=item["multiplier"],
            cpc_bid=item["cpc_bid"],
            budget_pool_remaining=item["budget_pool_remaining"],
            starts_at=starts_at,
            ends_at=ends_at,
            is_active=True,
            banner_image_url=item["banner_image_url"],
            category=item["category"],
        )
        db.add(camp)
        created.append(camp)

    await db.flush()
    return created


async def get_active_promotions(
    db: AsyncSession, category: Optional[str] = None, limit: int = 20
) -> List[BrandCampaign]:
    """
    Returns active, unexpired brand campaigns with available budget.
    """
    # Seed if empty
    await seed_default_campaigns(db)

    now = datetime.now(timezone.utc)
    stmt = select(BrandCampaign).where(
        BrandCampaign.is_active == True,
        BrandCampaign.budget_pool_remaining > Decimal("0.0000"),
        BrandCampaign.starts_at <= now,
        BrandCampaign.ends_at >= now,
    )

    if category and category.upper() != "ALL":
        stmt = stmt.where(BrandCampaign.category == category)

    stmt = stmt.order_by(BrandCampaign.multiplier.desc(), BrandCampaign.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def record_ad_event(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    event_type: AdEventType | str,
    user_id: Optional[uuid.UUID] = None,
    receipt_id: Optional[uuid.UUID] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[CampaignImpressionLog, Decimal]:
    """
    Atomically records an impression or click event, deducting CPC bid from the brand budget pool.
    """
    if isinstance(event_type, str):
        event_type = AdEventType(event_type.upper())

    stmt = select(BrandCampaign).where(BrandCampaign.id == campaign_id)
    camp = (await db.execute(stmt)).scalar_one_or_none()
    if not camp:
        raise ValueError(f"Campaign {campaign_id} not found")

    cost = Decimal("0.0000")
    if event_type == AdEventType.CLICK:
        # Deduct CPC bid from active budget pool
        cost = min(camp.cpc_bid, camp.budget_pool_remaining)
        camp.budget_pool_remaining = (camp.budget_pool_remaining - cost).quantize(Decimal("0.0001"))
        if camp.budget_pool_remaining <= Decimal("0.0000"):
            camp.budget_pool_remaining = Decimal("0.0000")
            camp.is_active = False

    log = CampaignImpressionLog(
        campaign_id=camp.id,
        user_id=user_id,
        event_type=event_type,
        cost_deducted=cost,
        receipt_id=receipt_id,
        metadata_json=metadata,
    )
    db.add(log)
    await db.flush()
    return log, cost


import re


def _keyword_matches(kw: str, text: str) -> bool:
    if not kw or not text:
        return False
    # Word boundary matching supporting hyphen, underscore, whitespace
    pattern = r'(?:^|[\s\W_])' + re.escape(kw) + r'(?:$|[\s\W_])'
    return bool(re.search(pattern, text))


async def evaluate_receipt_brand_boost(
    db: AsyncSession,
    line_items: Optional[List[Dict[str, Any]]] = None,
    raw_text: Optional[str] = None,
    total_amount: Decimal = Decimal("0.0000"),
    base_earn_rate: Decimal = Decimal("0.03"),
) -> Optional[Dict[str, Any]]:
    """
    Inspects receipt line items and OCR text against active brand campaigns.
    Computes bonus multiplier points funded by the brand ad pool.
    """
    now = datetime.now(timezone.utc)
    stmt = select(BrandCampaign).where(
        BrandCampaign.is_active == True,
        BrandCampaign.budget_pool_remaining > Decimal("0.0100"),
        BrandCampaign.starts_at <= now,
        BrandCampaign.ends_at >= now,
    )
    active_campaigns = (await db.execute(stmt)).scalars().all()
    if not active_campaigns:
        return None

    # Normalization of input lines
    inspected_text = (raw_text or "").lower()
    items_list = line_items or []

    best_match: Optional[Dict[str, Any]] = None

    for camp in active_campaigns:
        keywords = [k.lower().strip() for k in (camp.target_sku_keywords or [])]
        matched_keywords: List[str] = []
        matched_spend = Decimal("0.0000")

        # 1. Check itemized line items
        for item in items_list:
            raw_name = str(item.get("raw_name") or item.get("name") or "").lower()
            price = Decimal(str(item.get("total_price") or item.get("price") or 0.0))
            matched_item = False
            for kw in keywords:
                if _keyword_matches(kw, raw_name):
                    matched_keywords.append(kw)
                    matched_item = True
            if matched_item:
                matched_spend += price if price > 0 else Decimal("2.50")

        # 2. Check full raw OCR text if no item prices matched
        if not matched_keywords and inspected_text:
            for kw in keywords:
                if _keyword_matches(kw, inspected_text):
                    matched_keywords.append(kw)

            if matched_keywords:
                # If matched from full text without item breakdown, attribute a realistic portion of basket
                matched_spend = min(total_amount, Decimal("10.0000")) if total_amount > 0 else Decimal("5.0000")

        if matched_keywords and matched_spend > Decimal("0.0000"):
            # Bonus multiplier = (multiplier - 1.0) * base_earn_rate
            # E.g. 5x on 3% base: extra 4x * 3% = 12% bonus points
            multiplier = camp.multiplier
            bonus_factor = Decimal(str(max(multiplier - 1.0, 0.0)))
            bonus_usd = (matched_spend * base_earn_rate * bonus_factor).quantize(Decimal("0.0001"))

            # Cap bonus by available campaign budget pool
            bonus_usd = min(bonus_usd, camp.budget_pool_remaining)
            bonus_points = int(bonus_usd * POINTS_PER_DOLLAR)

            if bonus_points > 0 and bonus_usd > Decimal("0.0000"):
                match_data = {
                    "campaign": camp,
                    "campaign_id": camp.id,
                    "brand_name": camp.brand_name,
                    "campaign_title": camp.title,
                    "multiplier": camp.multiplier,
                    "matched_spend": matched_spend,
                    "bonus_points": bonus_points,
                    "bonus_usd": bonus_usd,
                    "matched_keywords": list(set(matched_keywords)),
                }

                # Pick campaign with highest bonus points
                if not best_match or match_data["bonus_points"] > best_match["bonus_points"]:
                    best_match = match_data

    return best_match


async def apply_brand_conversion(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    receipt_id: Optional[uuid.UUID],
    bonus_usd: Decimal,
    metadata: Optional[Dict[str, Any]] = None,
) -> CampaignImpressionLog:
    """
    Subsidizes bonus points from the brand's budget pool and records a CONVERSION_EARN event.
    """
    stmt = select(BrandCampaign).where(BrandCampaign.id == campaign_id)
    camp = (await db.execute(stmt)).scalar_one_or_none()
    if not camp:
        raise ValueError(f"Campaign {campaign_id} not found")

    bonus_usd = Decimal(str(bonus_usd)).quantize(Decimal("0.0001"))
    camp.budget_pool_remaining = (camp.budget_pool_remaining - bonus_usd).quantize(Decimal("0.0001"))
    if camp.budget_pool_remaining <= Decimal("0.0000"):
        camp.budget_pool_remaining = Decimal("0.0000")
        camp.is_active = False

    log = CampaignImpressionLog(
        campaign_id=camp.id,
        user_id=user_id,
        event_type=AdEventType.CONVERSION_EARN,
        cost_deducted=bonus_usd,
        receipt_id=receipt_id,
        metadata_json=metadata,
    )
    db.add(log)
    await db.flush()
    return log


async def get_brand_analytics(
    db: AsyncSession,
    brand_name: Optional[str] = None,
    campaign_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """
    Aggregates advertiser reporting metrics: impressions, clicks, CTR, conversions, and budget spend.
    """
    camp_stmt = select(BrandCampaign)
    if campaign_id:
        camp_stmt = camp_stmt.where(BrandCampaign.id == campaign_id)
    elif brand_name:
        camp_stmt = camp_stmt.where(BrandCampaign.brand_name.ilike(f"%{brand_name}%"))

    campaigns = (await db.execute(camp_stmt)).scalars().all()
    if not campaigns:
        return {
            "total_campaigns": 0,
            "total_impressions": 0,
            "total_clicks": 0,
            "ctr_percent": 0.0,
            "total_conversions": 0,
            "total_spent_usd": 0.0,
            "total_budget_remaining_usd": 0.0,
            "campaigns": [],
        }

    campaign_ids = [c.id for c in campaigns]

    logs_stmt = select(CampaignImpressionLog).where(CampaignImpressionLog.campaign_id.in_(campaign_ids))
    logs = (await db.execute(logs_stmt)).scalars().all()

    total_impressions = sum(1 for l in logs if l.event_type == AdEventType.IMPRESSION)
    total_clicks = sum(1 for l in logs if l.event_type == AdEventType.CLICK)
    total_conversions = sum(1 for l in logs if l.event_type == AdEventType.CONVERSION_EARN)
    total_spent_usd = sum(l.cost_deducted for l in logs)
    total_budget_remaining_usd = sum(c.budget_pool_remaining for c in campaigns)

    ctr_percent = (
        round((total_clicks / total_impressions) * 100, 2) if total_impressions > 0 else 0.0
    )

    campaigns_data = []
    for c in campaigns:
        c_logs = [l for l in logs if l.campaign_id == c.id]
        c_imps = sum(1 for l in c_logs if l.event_type == AdEventType.IMPRESSION)
        c_clicks = sum(1 for l in c_logs if l.event_type == AdEventType.CLICK)
        c_convs = sum(1 for l in c_logs if l.event_type == AdEventType.CONVERSION_EARN)
        c_spent = sum(l.cost_deducted for l in c_logs)
        c_ctr = round((c_clicks / c_imps) * 100, 2) if c_imps > 0 else 0.0

        campaigns_data.append(
            {
                "id": str(c.id),
                "brand_name": c.brand_name,
                "title": c.title,
                "multiplier": c.multiplier,
                "category": c.category,
                "is_active": c.is_active,
                "cpc_bid": float(c.cpc_bid),
                "budget_pool_remaining": float(c.budget_pool_remaining),
                "impressions": c_imps,
                "clicks": c_clicks,
                "ctr_percent": c_ctr,
                "conversions": c_convs,
                "spent_usd": float(c_spent),
            }
        )

    return {
        "total_campaigns": len(campaigns),
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "ctr_percent": ctr_percent,
        "total_conversions": total_conversions,
        "total_spent_usd": float(total_spent_usd),
        "total_budget_remaining_usd": float(total_budget_remaining_usd),
        "campaigns": campaigns_data,
    }
