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
from app.models.voucher import RedemptionVoucher, RedemptionVoucherStatus
from app.models.ledger import LedgerEntry, EntryDirection
from app.services.ledger_service import (
    record_earn_transaction,
    get_user_points_balance,
    verify_ledger_integrity,
)


@pytest.mark.asyncio
async def test_voucher_creation_insufficient_balance():
    """
    Test 1: Voucher creation with insufficient balance returns HTTP 400.
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Broke Shopper",
            sebet_points=0,
        )
        chain = Chain(id=uuid.uuid4(), name=f"Bravo-Test-{uuid.uuid4().hex[:6]}", slug=f"bravo-{uuid.uuid4().hex[:6]}")
        db.add_all([user, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User has 0 points, attempts to create 100 points voucher ($1.00)
        res = await ac.post(
            "/api/v1/redemption/create-voucher",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain.id),
                "points_amount": 100,
            },
        )
        assert res.status_code == 400
        data = res.json()
        assert "Kifayət qədər bal yoxdur" in data["detail"]


@pytest.mark.asyncio
async def test_voucher_claim_expired():
    """
    Test 2: Claiming an expired voucher returns HTTP 410 Gone.
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Time Traveler",
            sebet_points=0,
        )
        chain = Chain(id=uuid.uuid4(), name=f"Araz-{uuid.uuid4().hex[:6]}", slug=f"araz-{uuid.uuid4().hex[:6]}")
        db.add_all([user, chain])
        await db.commit()

        # Fund user with 300 points
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=Decimal("100.00"),
            merchant_name=chain.name,
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.30"),
        )
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create 100-point voucher
        create_res = await ac.post(
            "/api/v1/redemption/create-voucher",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain.id),
                "points_amount": 100,
            },
        )
        assert create_res.status_code == 200
        voucher_code = create_res.json()["voucher_code"]

        # 2. Artificially expire the voucher in DB (set expires_at in the past)
        async with async_session_factory() as db:
            from sqlalchemy import select
            v_stmt = select(RedemptionVoucher).where(RedemptionVoucher.voucher_code == voucher_code)
            v = (await db.execute(v_stmt)).scalar_one()
            v.expires_at = datetime.now(timezone.utc) - timedelta(minutes=15)
            await db.commit()

        # 3. Cashier attempts to claim expired voucher
        claim_res = await ac.post(
            "/api/v1/redemption/claim-voucher",
            headers={"X-Merchant-Id": str(chain.id)},
            json={"voucher_code": voucher_code},
        )
        assert claim_res.status_code == 410
        assert "expired" in claim_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unauthorized_merchant_claiming_other_merchant_voucher():
    """
    Test 3: Unauthorized merchant claiming another merchant's scoped voucher returns HTTP 403.
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Cross Shopper",
            sebet_points=0,
        )
        chain_a = Chain(id=uuid.uuid4(), name=f"Bravo-{uuid.uuid4().hex[:6]}", slug=f"bravo-{uuid.uuid4().hex[:6]}")
        chain_b = Chain(id=uuid.uuid4(), name=f"Oba-{uuid.uuid4().hex[:6]}", slug=f"oba-{uuid.uuid4().hex[:6]}")
        db.add_all([user, chain_a, chain_b])
        await db.commit()

        # Fund user with 300 points
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=Decimal("100.00"),
            merchant_name=chain_a.name,
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.30"),
        )
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. User creates voucher scoped to Chain A (Bravo)
        create_res = await ac.post(
            "/api/v1/redemption/create-voucher",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain_a.id),
                "points_amount": 150,
            },
        )
        assert create_res.status_code == 200
        voucher_code = create_res.json()["voucher_code"]

        # 2. Rival Chain B attempts to claim Chain A's voucher
        claim_res = await ac.post(
            "/api/v1/redemption/claim-voucher",
            headers={"X-Merchant-Id": str(chain_b.id)},
            json={"voucher_code": voucher_code},
        )
        assert claim_res.status_code == 403
        assert "different supermarket" in claim_res.json()["detail"].lower() or "forbidden" in claim_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_successful_end_to_end_voucher_redemption_clearinghouse():
    """
    Test 4: End-to-end clearinghouse redemption:
    - User earns 500 points ($166.67 purchase).
    - User creates 200-point voucher ($2.00) scoped to Bravo.
    - Bravo claims voucher via cashier endpoint.
    - Double-entry accounting invariants verified:
      - User liability debited $2.00 (200 pts extinguished).
      - Bravo credited $1.90 net ($2.00 - 5% fee).
      - Platform credited $0.10 servicing fee revenue.
      - Sum(Debits) == Sum(Credits) == $2.00.
    - User remaining points == 300.
    - Repeated claim returns HTTP 400 ("already claimed").
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Loyal VIP Shopper",
            sebet_points=0,
        )
        bravo = Chain(id=uuid.uuid4(), name=f"Bravo-{uuid.uuid4().hex[:6]}", slug=f"bravo-{uuid.uuid4().hex[:6]}")
        db.add_all([user, bravo])
        await db.commit()

        # Earn 500 points ($166.67 @ 3%)
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=Decimal("166.6667"),
            merchant_name=bravo.name,
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.30"),
        )
        await db.commit()

        initial_points = await get_user_points_balance(db, user.id)
        assert initial_points == 500

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create 200-point voucher ($2.00 discount)
        create_res = await ac.post(
            "/api/v1/redemption/create-voucher",
            json={
                "user_id": str(user.id),
                "merchant_id": str(bravo.id),
                "points_amount": 200,
            },
        )
        assert create_res.status_code == 200
        c_data = create_res.json()
        assert c_data["points_amount"] == 200
        assert Decimal(str(c_data["usd_value"])) == Decimal("2.0000")
        voucher_code = c_data["voucher_code"]

        # 2. Verify status polling endpoint before claim
        status_res = await ac.get(f"/api/v1/redemption/voucher/{voucher_code}/status")
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "ACTIVE"

        # 3. Verify cashier preview before burn
        preview_res = await ac.get(
            f"/api/v1/redemption/voucher/{voucher_code}/preview",
            headers={"X-Merchant-Id": str(bravo.id)},
        )
        assert preview_res.status_code == 200
        p_data = preview_res.json()
        assert p_data["is_valid"] is True
        assert p_data["is_merchant_match"] is True
        assert Decimal(str(p_data["gross_discount_usd"])) == Decimal("2.0000")
        assert Decimal(str(p_data["platform_servicing_fee_usd"])) == Decimal("0.1000")
        assert Decimal(str(p_data["merchant_net_reimbursement_usd"])) == Decimal("1.9000")

        # 4. Bravo cashier claims and burns the voucher
        claim_res = await ac.post(
            "/api/v1/redemption/claim-voucher",
            headers={"X-Merchant-Id": str(bravo.id)},
            json={"voucher_code": voucher_code, "cashier_notes": "Register #3 checkout"},
        )
        assert claim_res.status_code == 200
        claim_data = claim_res.json()
        assert claim_data["success"] is True
        assert claim_data["points_redeemed"] == 200
        assert Decimal(str(claim_data["gross_discount_usd"])) == Decimal("2.0000")
        assert Decimal(str(claim_data["platform_servicing_fee_usd"])) == Decimal("0.1000")
        assert Decimal(str(claim_data["merchant_net_reimbursement_usd"])) == Decimal("1.9000")
        assert claim_data["user_remaining_points"] == 300
        tx_id = uuid.UUID(claim_data["ledger_transaction_id"])

        # 5. Verify status polling endpoint reflects CLAIMED
        status_claimed_res = await ac.get(f"/api/v1/redemption/voucher/{voucher_code}/status")
        assert status_claimed_res.status_code == 200
        assert status_claimed_res.json()["status"] == "CLAIMED"
        assert status_claimed_res.json()["ledger_transaction_id"] == str(tx_id)

        # 6. Attempting to re-claim same voucher fails with HTTP 400
        reclaim_res = await ac.post(
            "/api/v1/redemption/claim-voucher",
            headers={"X-Merchant-Id": str(bravo.id)},
            json={"voucher_code": voucher_code},
        )
        assert reclaim_res.status_code == 400
        assert "already been claimed" in reclaim_res.json()["detail"].lower()

    # 7. Direct Database & Double-Entry Ledger Verification
    async with async_session_factory() as db:
        # Check user balance is exactly 300 points
        final_pts = await get_user_points_balance(db, user.id)
        assert final_pts == 300

        # Query entries for this transaction
        entries = (
            await db.execute(
                LedgerEntry.__table__.select().where(LedgerEntry.transaction_id == tx_id)
            )
        ).fetchall()

        debits = [e for e in entries if e.direction == EntryDirection.DEBIT.value or e.direction == EntryDirection.DEBIT]
        credits = [e for e in entries if e.direction == EntryDirection.CREDIT.value or e.direction == EntryDirection.CREDIT]

        assert len(debits) == 1
        assert len(credits) == 2

        total_debits = sum(Decimal(str(e.amount)) for e in debits)
        total_credits = sum(Decimal(str(e.amount)) for e in credits)

        assert total_debits == Decimal("2.0000")
        assert total_credits == Decimal("2.0000")
        assert total_debits == total_credits

        # Global ledger audit integrity
        audit = await verify_ledger_integrity(db)
        assert audit["is_balanced"] is True
        assert audit["net_discrepancy"] == Decimal("0.0000")
        assert len(audit["unbalanced_transactions"]) == 0
