import os
import sys
from pathlib import Path
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./sebet.db"
os.environ["ENVIRONMENT"] = "testing"

from app.main import app
from app.core.database import async_session_factory, init_db
from app.models.user import User
from app.models.chain import Chain
from app.models.retail_media import BrandCampaign, CampaignImpressionLog, AdEventType
from app.models.ledger import LedgerEntry, LedgerAccount, EntryDirection
from app.services.retail_media_service import (
    get_active_promotions,
    record_ad_event,
    evaluate_receipt_brand_boost,
    apply_brand_conversion,
    get_brand_analytics,
)
from app.services.ledger_service import (
    get_user_points_balance,
    get_account_balance,
    verify_ledger_integrity,
)


@pytest.mark.asyncio
async def test_campaign_retrieval_and_cpc_click_deduction():
    """
    Test 1: Campaign retrieval returns active campaigns and click event atomically deducts CPC.
    """
    await init_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Fetch active campaigns
        res = await ac.get("/api/v1/media/campaigns")
        assert res.status_code == 200
        campaigns = res.json()
        assert len(campaigns) >= 4

        coca_cola = next((c for c in campaigns if "Coca-Cola" in c["brand_name"]), None)
        assert coca_cola is not None
        assert coca_cola["multiplier"] == 5.0
        assert coca_cola["cpc_bid"] == 0.25
        initial_budget = Decimal(str(coca_cola["budget_pool_remaining"]))

        # 2. Track IMPRESSION (cost = 0)
        imp_res = await ac.post(
            "/api/v1/media/track",
            json={
                "campaign_id": coca_cola["id"],
                "event_type": "IMPRESSION",
            },
        )
        assert imp_res.status_code == 200
        imp_data = imp_res.json()
        assert imp_data["success"] is True
        assert imp_data["cost_deducted"] == 0.0
        assert Decimal(str(imp_data["budget_pool_remaining"])) == initial_budget

        # 3. Track CLICK (cost = 0.25 CPC)
        click_res = await ac.post(
            "/api/v1/media/track",
            json={
                "campaign_id": coca_cola["id"],
                "event_type": "CLICK",
            },
        )
        assert click_res.status_code == 200
        click_data = click_res.json()
        assert click_data["success"] is True
        assert click_data["cost_deducted"] == 0.25
        expected_budget = initial_budget - Decimal("0.25")
        assert abs(Decimal(str(click_data["budget_pool_remaining"])) - expected_budget) < Decimal("0.001")


@pytest.mark.asyncio
async def test_ocr_receipt_brand_bonus_multiplier():
    """
    Test 2: OCR/Receipt submission with matching brand SKU credits user with brand-subsidized points
    while the supermarket merchant debit remains strictly base (protecting merchant margin).
    """
    await init_db()

    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Brand Boost Shopper",
            sebet_points=0,
        )
        chain = Chain(
            id=uuid.uuid4(),
            name=f"Bravo-Media-{uuid.uuid4().hex[:6]}",
            slug=f"bravo-media-{uuid.uuid4().hex[:6]}",
        )

        unique_tag = uuid.uuid4().hex[:6]
        brand_name = f"TestCola-{unique_tag}"
        kw = f"testcola{unique_tag}"

        # Create a dedicated high-budget campaign for this test
        test_campaign = BrandCampaign(
            id=uuid.uuid4(),
            brand_name=brand_name,
            title=f"{brand_name} 5x Bal",
            target_sku_keywords=[kw],
            multiplier=5.0,
            cpc_bid=Decimal("0.2500"),
            budget_pool_remaining=Decimal("100.0000"),
            starts_at=datetime.now(timezone.utc) - timedelta(days=1),
            ends_at=datetime.now(timezone.utc) + timedelta(days=10),
            is_active=True,
            category="İçkilər",
        )
        db.add_all([user, chain, test_campaign])
        await db.commit()
        campaign_id = test_campaign.id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Total basket: $50.00
        # Line items contain $10.00 worth of TestCola
        # Base earn rate = 3% -> Base points = $50.00 * 0.03 = $1.50 = 150 pts
        # Bonus on TestCola: 4x extra * 3% * $10.00 = 12% * $10.00 = $1.20 = 120 bonus pts
        # Total points awarded = 150 + 120 = 270 pts
        submit_res = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain.id),
                "merchant_name": chain.name,
                "receipt_number": f"RCPT-BOOST-{uuid.uuid4().hex[:6]}",
                "total_amount": "50.00",
                "earn_rate": "0.03",
                "raw_ocr_text": f"1. {kw.upper()} 1.5L   10.00 AZN\n2. BREAD   40.00 AZN",
                "line_items": [
                    {"raw_name": f"{kw.upper()} 1.5L", "total_price": 10.00},
                    {"raw_name": "BREAD", "total_price": 40.00},
                ],
            },
        )
        assert submit_res.status_code == 200
        data = submit_res.json()
        assert data["success"] is True
        assert data["points_awarded"] == 270
        assert data["base_points"] == 150
        assert data["bonus_points"] == 120
        assert data["brand_boost"] is not None
        assert data["brand_boost"]["brand_name"] == brand_name
        assert data["brand_boost"]["bonus_points"] == 120
        assert data["brand_boost"]["campaign_id"] == str(campaign_id)

    # Verify double-entry ledger accounts:
    async with async_session_factory() as db:
        # 1. User points liability balance = 270 points ($2.70)
        user_balance = await get_user_points_balance(db, user.id)
        assert user_balance == 270

        # 2. Check campaign budget was decremented by $1.20 ($100.00 - $1.20 = $98.80)
        camp = await db.get(BrandCampaign, campaign_id)
        assert camp is not None
        assert abs(camp.budget_pool_remaining - Decimal("98.8000")) < Decimal("0.001")

        # 3. Check Merchant Receivable Account
        # Merchant should ONLY be debited for base $1.50 + $0.30 platform fee = $1.80
        merchant_code = f"MER-RCV-{chain.id}"
        stmt = select(LedgerAccount).where(LedgerAccount.account_code == merchant_code)
        m_account = (await db.execute(stmt)).scalar_one_or_none()
        assert m_account is not None
        m_bal = await get_account_balance(db, m_account.id)
        assert abs(m_bal - Decimal("1.8000")) < Decimal("0.001")

        # 4. Check Brand Sponsor Receivable Account
        # Brand is debited for $1.20
        brand_code = f"BRD-ADV-{brand_name.upper()}"
        b_stmt = select(LedgerAccount).where(LedgerAccount.account_code == brand_code)
        b_account = (await db.execute(b_stmt)).scalar_one_or_none()
        assert b_account is not None
        b_bal = await get_account_balance(db, b_account.id)
        assert abs(b_bal - Decimal("1.2000")) < Decimal("0.001")

        # 5. Full clearinghouse audit integrity
        audit = await verify_ledger_integrity(db)
        assert audit["is_balanced"] is True
        assert audit["net_discrepancy"] == Decimal("0.0000")


@pytest.mark.asyncio
async def test_budget_exhaustion_stops_bonus():
    """
    Test 3: Exhausted brand campaign gracefully ceases awarding bonus points and falls back to base points.
    """
    await init_db()

    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Depleted Campaign Shopper",
            sebet_points=0,
        )
        chain = Chain(
            id=uuid.uuid4(),
            name=f"Bravo-Depleted-{uuid.uuid4().hex[:6]}",
            slug=f"bravo-depleted-{uuid.uuid4().hex[:6]}",
        )
        # Campaign with 0 remaining budget
        depleted_campaign = BrandCampaign(
            id=uuid.uuid4(),
            brand_name="ZeroBudgetBrand",
            title="Zero Budget 5x Bal",
            target_sku_keywords=["zerobudget"],
            multiplier=5.0,
            cpc_bid=Decimal("0.2500"),
            budget_pool_remaining=Decimal("0.0000"),
            starts_at=datetime.now(timezone.utc) - timedelta(days=1),
            ends_at=datetime.now(timezone.utc) + timedelta(days=10),
            is_active=False,
            category="İçkilər",
        )
        db.add_all([user, chain, depleted_campaign])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        submit_res = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain.id),
                "merchant_name": chain.name,
                "receipt_number": f"RCPT-DEP-{uuid.uuid4().hex[:6]}",
                "total_amount": "50.00",
                "earn_rate": "0.03",
                "raw_ocr_text": "1. ZEROBUDGET DRINK 50.00 AZN",
                "line_items": [{"raw_name": "ZEROBUDGET DRINK", "total_price": 50.00}],
            },
        )
        assert submit_res.status_code == 200
        data = submit_res.json()
        assert data["success"] is True
        # Base 150 points awarded, 0 brand bonus
        assert data["points_awarded"] == 150
        assert data["bonus_points"] == 0
        assert data["brand_boost"] is None


@pytest.mark.asyncio
async def test_brand_analytics_aggregation():
    """
    Test 4: Brand advertiser analytics aggregates impressions, clicks, CTR, and budget consumption.
    """
    await init_db()

    async with async_session_factory() as db:
        camp = BrandCampaign(
            id=uuid.uuid4(),
            brand_name=f"AnalyticsBrand-{uuid.uuid4().hex[:4]}",
            title="Analytics Test 4x Bal",
            target_sku_keywords=["analyticsbrand"],
            multiplier=4.0,
            cpc_bid=Decimal("0.3000"),
            budget_pool_remaining=Decimal("50.0000"),
            starts_at=datetime.now(timezone.utc) - timedelta(days=1),
            ends_at=datetime.now(timezone.utc) + timedelta(days=5),
            is_active=True,
            category="Məişət",
        )
        db.add(camp)
        await db.commit()

        # Simulate 10 impressions
        for _ in range(10):
            db.add(
                CampaignImpressionLog(
                    id=uuid.uuid4(),
                    campaign_id=camp.id,
                    event_type=AdEventType.IMPRESSION,
                    cost_deducted=Decimal("0.0000"),
                )
            )

        # Simulate 2 clicks
        for _ in range(2):
            db.add(
                CampaignImpressionLog(
                    id=uuid.uuid4(),
                    campaign_id=camp.id,
                    event_type=AdEventType.CLICK,
                    cost_deducted=Decimal("0.3000"),
                )
            )

        # Simulate 1 conversion
        db.add(
            CampaignImpressionLog(
                id=uuid.uuid4(),
                campaign_id=camp.id,
                event_type=AdEventType.CONVERSION_EARN,
                cost_deducted=Decimal("1.5000"),
            )
        )
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/media/brand-analytics?campaign_id={camp.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["total_impressions"] == 10
        assert data["total_clicks"] == 2
        # CTR = 2 / 10 * 100 = 20.0%
        assert data["ctr_percent"] == 20.0
        assert data["total_conversions"] == 1
        # Spent = 2 * 0.30 (clicks) + 1.50 (conversion) = 2.10
        assert abs(data["total_spent_usd"] - 2.10) < 0.01
