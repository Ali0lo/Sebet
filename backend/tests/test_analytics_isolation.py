import os
import sys
from pathlib import Path
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./sebet.db"
os.environ["ENVIRONMENT"] = "testing"

from app.main import app
from app.core.database import async_session_factory, init_db
from app.models.user import User
from app.models.chain import Chain
from app.models.receipt import Receipt, ReceiptStatus
from app.services.analytics_service import K_ANONYMITY_THRESHOLD
from app.services.receipt_fraud_service import compute_image_hash, compute_composite_fingerprint


@pytest.mark.asyncio
async def test_tenant_data_isolation_and_tamper_prevention():
    """
    Test 1: Tenant Data Scoping & Path/Query Parameter Tampering
    - Merchant A authenticates with their X-Merchant-Id
    - Merchant A queries their own transactions -> 200 OK
    - Merchant A attempts to query Merchant B's transactions via query parameter -> 403 Forbidden
    - Merchant A attempts to query Merchant B's transactions via path parameter -> 403 Forbidden
    - Admin with X-Is-Admin: true can access target merchant -> 200 OK
    """
    await init_db()
    async with async_session_factory() as db:
        merchant_a = Chain(
            id=uuid.uuid4(),
            name=f"Merchant-A-{uuid.uuid4().hex[:5]}",
            slug=f"m-a-{uuid.uuid4().hex[:5]}",
            category="Grocery",
        )
        merchant_b = Chain(
            id=uuid.uuid4(),
            name=f"Merchant-B-{uuid.uuid4().hex[:5]}",
            slug=f"m-b-{uuid.uuid4().hex[:5]}",
            category="Grocery",
        )
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Tenant User",
        )
        db.add_all([merchant_a, merchant_b, user])
        await db.flush()

        # Seed 1 receipt for merchant B
        rcpt_b = Receipt(
            user_id=user.id,
            merchant_id=merchant_b.id,
            receipt_number=f"REC-B-{uuid.uuid4().hex[:6]}",
            total_amount=Decimal("75.5000"),
            purchased_at=datetime.now(timezone.utc),
            image_hash=compute_image_hash(f"img-b-{uuid.uuid4().hex}".encode("utf-8")),
            composite_fingerprint=compute_composite_fingerprint(merchant_b.id, "75.50", datetime.now(timezone.utc)),
            status=ReceiptStatus.APPROVED,
            sebet_points_awarded=226,
        )
        db.add(rcpt_b)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Missing authentication header -> 401 Unauthorized
        no_auth = await ac.get("/api/v1/analytics/merchant/me/summary")
        assert no_auth.status_code == 401

        # 2. Merchant A queries their own transactions -> 200 OK
        headers_a = {"X-Merchant-Id": str(merchant_a.id)}
        res_own = await ac.get("/api/v1/analytics/merchant/transactions", headers=headers_a)
        assert res_own.status_code == 200

        # 3. Path parameter tampering: Merchant A accesses /merchant/{merchant_b_id}/transactions -> 403 Forbidden
        tamper_path = await ac.get(
            f"/api/v1/analytics/merchant/{merchant_b.id}/transactions",
            headers=headers_a,
        )
        assert tamper_path.status_code == 403
        assert "forbidden" in tamper_path.json()["detail"].lower()

        # 4. Query parameter tampering: Merchant A accesses ?merchant_id={merchant_b_id} -> 403 Forbidden
        tamper_query = await ac.get(
            f"/api/v1/analytics/merchant/transactions?merchant_id={merchant_b.id}",
            headers=headers_a,
        )
        assert tamper_query.status_code == 403
        assert "forbidden" in tamper_query.json()["detail"].lower()

        # 5. Platform Admin with X-Is-Admin accesses Merchant B -> 200 OK
        admin_headers = {"X-Merchant-Id": str(merchant_a.id), "X-Is-Admin": "true"}
        admin_access = await ac.get(
            f"/api/v1/analytics/merchant/{merchant_b.id}/transactions",
            headers=admin_headers,
        )
        assert admin_access.status_code == 200
        txs = admin_access.json()
        assert len(txs) == 1
        assert txs[0]["receipt_number"] == rcpt_b.receipt_number


@pytest.mark.asyncio
async def test_k_anonymity_suppression_under_threshold():
    """
    Test 2: k-Anonymity Suppression when participating merchants < 5
    - Category 'Specialty Tea' has only 3 participating merchants (k < 5)
    - Merchant requests benchmark
    - Returns benchmark_available: false
    - Message indicates insufficient category density
    - category_benchmark is null
    """
    await init_db()
    cat_name = f"Specialty-Tea-{uuid.uuid4().hex[:4]}"

    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Tea Lover",
        )
        db.add(user)

        # Create 3 merchants in this category
        tea_merchants = []
        for i in range(3):
            chain = Chain(
                id=uuid.uuid4(),
                name=f"Tea Merchant {i}-{uuid.uuid4().hex[:4]}",
                slug=f"tea-{i}-{uuid.uuid4().hex[:4]}",
                category=cat_name,
            )
            db.add(chain)
            tea_merchants.append(chain)
        await db.flush()

        # Add approved receipt for each merchant
        for i, m in enumerate(tea_merchants):
            rcpt = Receipt(
                user_id=user.id,
                merchant_id=m.id,
                receipt_number=f"TEA-{i}-{uuid.uuid4().hex[:4]}",
                total_amount=Decimal(f"{15 + i * 5}.0000"),
                purchased_at=datetime.now(timezone.utc),
                image_hash=compute_image_hash(f"tea-img-{i}-{uuid.uuid4().hex}".encode("utf-8")),
                composite_fingerprint=compute_composite_fingerprint(m.id, f"{15 + i * 5}.00", datetime.now(timezone.utc)),
                status=ReceiptStatus.APPROVED,
                sebet_points_awarded=45,
            )
            db.add(rcpt)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"X-Merchant-Id": str(tea_merchants[0].id)}
        res = await ac.get("/api/v1/analytics/merchant/me/benchmark", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # Verify strict suppression
        assert data["benchmark_available"] is False
        assert "insufficient category density" in data["message"].lower()
        assert data["category_benchmark"] is None
        assert data["category"] == cat_name
        # Merchant's own metrics are still available
        assert float(data["merchant_metrics"]["average_basket_size"]) > 0


@pytest.mark.asyncio
async def test_k_anonymity_exposure_at_and_above_threshold():
    """
    Test 3: k-Anonymity Exposure when participating merchants >= 5
    - Category 'Fitness' has 6 distinct participating merchants (k >= 5)
    - Returns benchmark_available: true
    - Returns category benchmark with aggregate average basket size, points, and repeat rate
    """
    await init_db()
    cat_name = f"Fitness-{uuid.uuid4().hex[:4]}"

    async with async_session_factory() as db:
        user1 = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="Gym Bro 1")
        user2 = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="Gym Bro 2")
        db.add_all([user1, user2])

        # Create 6 distinct merchants in Fitness
        merchants = []
        for i in range(6):
            chain = Chain(
                id=uuid.uuid4(),
                name=f"Gym-{i}-{uuid.uuid4().hex[:4]}",
                slug=f"gym-{i}-{uuid.uuid4().hex[:4]}",
                category=cat_name,
            )
            db.add(chain)
            merchants.append(chain)
        await db.flush()

        # Add approved receipts for all 6 merchants
        for i, m in enumerate(merchants):
            for u in (user1, user2):
                rcpt = Receipt(
                    user_id=u.id,
                    merchant_id=m.id,
                    receipt_number=f"FIT-{i}-{u.id.hex[:4]}",
                    total_amount=Decimal("50.0000"),
                    purchased_at=datetime.now(timezone.utc),
                    image_hash=compute_image_hash(f"fit-img-{i}-{u.id.hex}".encode("utf-8")),
                    composite_fingerprint=compute_composite_fingerprint(m.id, "50.00", datetime.now(timezone.utc), f"FIT-{i}"),
                    status=ReceiptStatus.APPROVED,
                    sebet_points_awarded=150,
                )
                db.add(rcpt)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"X-Merchant-Id": str(merchants[0].id)}
        res = await ac.get("/api/v1/analytics/merchant/me/benchmark", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # Verify benchmark is exposed
        assert data["benchmark_available"] is True
        benchmark = data["category_benchmark"]
        assert benchmark is not None
        assert benchmark["category"] == cat_name
        assert benchmark["k_anonymity_threshold"] == K_ANONYMITY_THRESHOLD
        assert benchmark["participating_merchants_count"] == 6
        assert Decimal(benchmark["average_basket_size"]) == Decimal("50.0000")
        assert benchmark["average_points_earned_per_transaction"] == 150.0


@pytest.mark.asyncio
async def test_cross_shopping_affinities_privacy_preservation():
    """
    Test 4: Cross-Shopping Category Affinities
    - Merchant M belongs to Category 'Electronics'
    - Customers of Merchant M also visit merchants in 'Grocery' and 'Coffee & Bakery'
    - Verify affinities return high-level category names and percentages only
    - Competitor names and chain IDs must NEVER be exposed
    """
    await init_db()
    cat_electronics = f"Electronics-{uuid.uuid4().hex[:4]}"
    cat_grocery = f"Grocery-{uuid.uuid4().hex[:4]}"
    cat_coffee = f"Coffee-{uuid.uuid4().hex[:4]}"

    async with async_session_factory() as db:
        # Create 10 customers
        users = [
            User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name=f"Cust {i}")
            for i in range(10)
        ]
        db.add_all(users)

        m_elec = Chain(id=uuid.uuid4(), name=f"TechStore-{uuid.uuid4().hex[:4]}", slug=f"tech-{uuid.uuid4().hex[:4]}", category=cat_electronics)
        m_groc = Chain(id=uuid.uuid4(), name=f"SecretGrocery-{uuid.uuid4().hex[:4]}", slug=f"sg-{uuid.uuid4().hex[:4]}", category=cat_grocery)
        m_coff = Chain(id=uuid.uuid4(), name=f"SecretCafe-{uuid.uuid4().hex[:4]}", slug=f"sc-{uuid.uuid4().hex[:4]}", category=cat_coffee)
        db.add_all([m_elec, m_groc, m_coff])
        await db.flush()

        # All 10 users shop at TechStore
        for u in users:
            db.add(
                Receipt(
                    user_id=u.id,
                    merchant_id=m_elec.id,
                    total_amount=Decimal("120.00"),
                    image_hash=compute_image_hash(f"e-{u.id}".encode("utf-8")),
                    composite_fingerprint=compute_composite_fingerprint(m_elec.id, "120.00", datetime.now(timezone.utc)),
                    status=ReceiptStatus.APPROVED,
                    sebet_points_awarded=360,
                )
            )

        # 6 of the users also shop at Grocery (60% affinity)
        for u in users[:6]:
            db.add(
                Receipt(
                    user_id=u.id,
                    merchant_id=m_groc.id,
                    total_amount=Decimal("40.00"),
                    image_hash=compute_image_hash(f"g-{u.id}".encode("utf-8")),
                    composite_fingerprint=compute_composite_fingerprint(m_groc.id, "40.00", datetime.now(timezone.utc)),
                    status=ReceiptStatus.APPROVED,
                    sebet_points_awarded=120,
                )
            )

        # 3 of the users also shop at Coffee (30% affinity)
        for u in users[:3]:
            db.add(
                Receipt(
                    user_id=u.id,
                    merchant_id=m_coff.id,
                    total_amount=Decimal("8.00"),
                    image_hash=compute_image_hash(f"c-{u.id}".encode("utf-8")),
                    composite_fingerprint=compute_composite_fingerprint(m_coff.id, "8.00", datetime.now(timezone.utc)),
                    status=ReceiptStatus.APPROVED,
                    sebet_points_awarded=24,
                )
            )

        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"X-Merchant-Id": str(m_elec.id)}
        res = await ac.get("/api/v1/analytics/merchant/me/benchmark", headers=headers)
        assert res.status_code == 200
        data = res.json()

        affinities = data["cross_shopping_affinities"]
        assert len(affinities) == 2

        # 1st affinity should be Grocery (60%)
        assert affinities[0]["category"] == cat_grocery
        assert affinities[0]["affinity_percentage"] == 60.0
        assert "60.0%" in affinities[0]["description"]

        # 2nd affinity should be Coffee (30%)
        assert affinities[1]["category"] == cat_coffee
        assert affinities[1]["affinity_percentage"] == 30.0
        assert "30.0%" in affinities[1]["description"]

        # Strict competitor name isolation check:
        # Competitor names and chain IDs must NOT appear anywhere in the JSON response
        raw_json_str = res.text
        assert m_groc.name not in raw_json_str
        assert m_coff.name not in raw_json_str
        assert str(m_groc.id) not in raw_json_str
        assert str(m_coff.id) not in raw_json_str


@pytest.mark.asyncio
async def test_merchant_own_summary_metrics():
    """
    Test 5: Merchant's own summary performance metrics
    - Verifies GET /api/v1/analytics/merchant/me/summary accurately returns:
      - total revenue
      - total points issued
      - unique customer count
      - total transactions
      - average basket size
      - repeat customer rate (30-day window)
    """
    await init_db()
    async with async_session_factory() as db:
        user_repeat = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="Loyal Customer")
        user_once = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="One-Time Customer")
        merchant = Chain(id=uuid.uuid4(), name=f"Summary-Shop-{uuid.uuid4().hex[:4]}", slug=f"ss-{uuid.uuid4().hex[:4]}", category="Retail")
        db.add_all([user_repeat, user_once, merchant])
        await db.flush()

        now = datetime.now(timezone.utc)

        # user_repeat has 2 visits (repeat customer)
        db.add(
            Receipt(
                user_id=user_repeat.id,
                merchant_id=merchant.id,
                total_amount=Decimal("100.00"),
                purchased_at=now,
                image_hash=compute_image_hash(f"sum-1-{uuid.uuid4().hex}".encode("utf-8")),
                composite_fingerprint=compute_composite_fingerprint(merchant.id, "100.00", now),
                status=ReceiptStatus.APPROVED,
                sebet_points_awarded=300,
            )
        )
        db.add(
            Receipt(
                user_id=user_repeat.id,
                merchant_id=merchant.id,
                total_amount=Decimal("50.00"),
                purchased_at=now,
                image_hash=compute_image_hash(f"sum-2-{uuid.uuid4().hex}".encode("utf-8")),
                composite_fingerprint=compute_composite_fingerprint(merchant.id, "50.00", now),
                status=ReceiptStatus.APPROVED,
                sebet_points_awarded=150,
            )
        )

        # user_once has 1 visit
        db.add(
            Receipt(
                user_id=user_once.id,
                merchant_id=merchant.id,
                total_amount=Decimal("30.00"),
                purchased_at=now,
                image_hash=compute_image_hash(f"sum-3-{uuid.uuid4().hex}".encode("utf-8")),
                composite_fingerprint=compute_composite_fingerprint(merchant.id, "30.00", now),
                status=ReceiptStatus.APPROVED,
                sebet_points_awarded=90,
            )
        )
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"X-Merchant-Id": str(merchant.id)}
        res = await ac.get("/api/v1/analytics/merchant/me/summary", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["merchant_id"] == str(merchant.id)
        assert Decimal(data["total_revenue"]) == Decimal("180.0000")
        assert data["total_points_issued"] == 540
        assert data["unique_customer_count"] == 2
        assert data["total_transactions"] == 3
        assert Decimal(data["average_basket_size"]) == Decimal("60.0000")  # 180 / 3
        assert data["average_points_earned_per_transaction"] == 180.0  # 540 / 3
        assert data["repeat_customer_rate"] == 50.0  # 1 out of 2 customers has >= 2 visits (50%)
