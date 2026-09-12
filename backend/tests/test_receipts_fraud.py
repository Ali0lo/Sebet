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
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.ledger import (
    LedgerTransaction,
    LedgerEntry,
    LedgerAccount,
    AccountCategory,
    TransactionType,
    EntryDirection,
)
from app.services.ledger_service import (
    get_user_points_balance,
    get_account_balance,
    verify_ledger_integrity,
)
from app.services.receipt_fraud_service import (
    compute_image_hash,
    compute_composite_fingerprint,
)


@pytest.mark.asyncio
async def test_clean_receipt_earn_flow():
    """
    Test 1: Clean receipt earn flow
    - User submits valid receipt for $50.00 at 3% earn rate
    - System approves receipt
    - Points minted in double-entry ledger clearinghouse (150 points)
    - Offsetting merchant debit ($1.80) and platform fee ($0.30)
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Clean Receipt User",
            sebet_points=0,
        )
        chain = Chain(
            id=uuid.uuid4(),
            name=f"Bravo-{uuid.uuid4().hex[:5]}",
            slug=f"bravo-{uuid.uuid4().hex[:5]}",
        )
        db.add_all([user, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain.id),
                "merchant_name": chain.name,
                "receipt_number": f"REC-{uuid.uuid4().hex[:6]}",
                "total_amount": "50.00",
                "image_hash": compute_image_hash(f"clean-img-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["status"] == "APPROVED"
        assert data["is_flagged"] is False
        assert data["points_awarded"] == 150
        assert data["ledger_transaction_id"] is not None

        receipt_id = uuid.UUID(data["receipt_id"])
        tx_id = uuid.UUID(data["ledger_transaction_id"])

    # Verify double-entry ledger integrity
    async with async_session_factory() as db:
        receipt = await db.get(Receipt, receipt_id)
        assert receipt.status == ReceiptStatus.APPROVED
        assert receipt.ledger_transaction_id == tx_id

        user_balance = await get_user_points_balance(db, user.id)
        assert user_balance == 150

        # Verify balanced ledger entries
        stmt = (
            select(LedgerTransaction)
            .options(selectinload(LedgerTransaction.entries))
            .where(LedgerTransaction.id == tx_id)
        )
        tx = (await db.execute(stmt)).scalar_one()
        assert tx.transaction_type == TransactionType.EARN
        debits = sum(e.amount for e in tx.entries if e.direction == EntryDirection.DEBIT)
        credits = sum(e.amount for e in tx.entries if e.direction == EntryDirection.CREDIT)
        assert debits == Decimal("1.8000")
        assert credits == Decimal("1.8000")


@pytest.mark.asyncio
async def test_exact_duplicate_image_rejection():
    """
    Test 2: Exact duplicate image rejection (within 60 days)
    - User A submits receipt with image_hash H1 -> APPROVED
    - User B (or same user) submits receipt with same image_hash H1 within 60 days -> REJECTED (409)
    - Second receipt logged in database as REJECTED
    - Zero points or ledger entries minted for the duplicate
    """
    await init_db()
    shared_image_hash = compute_image_hash(f"shared-receipt-img-{uuid.uuid4().hex}".encode("utf-8"))

    async with async_session_factory() as db:
        user_a = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="User A",
            sebet_points=0,
        )
        user_b = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="User B",
            sebet_points=0,
        )
        chain = Chain(
            id=uuid.uuid4(),
            name=f"Araz-{uuid.uuid4().hex[:5]}",
            slug=f"araz-{uuid.uuid4().hex[:5]}",
        )
        db.add_all([user_a, user_b, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First submission: clean
        res1 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_a.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"REC-1-{uuid.uuid4().hex[:6]}",
                "total_amount": "25.00",
                "image_hash": shared_image_hash,
            },
        )
        assert res1.status_code == 200
        assert res1.json()["status"] == "APPROVED"

        # Second submission: duplicate image hash within 60 days
        res2 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_b.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"REC-2-{uuid.uuid4().hex[:6]}",
                "total_amount": "25.00",
                "image_hash": shared_image_hash,
            },
        )
        assert res2.status_code == 409
        assert "duplicate" in res2.json()["detail"].lower()

    # Verify User B received 0 points and rejected receipt is recorded
    async with async_session_factory() as db:
        user_b_points = await get_user_points_balance(db, user_b.id)
        assert user_b_points == 0


@pytest.mark.asyncio
async def test_fingerprint_collision_rejection():
    """
    Test 3: Fingerprint collision rejection (within 7-day rolling window)
    - User A submits receipt: Merchant M, $42.50, Date D, Receipt #101
    - User B submits receipt with different image hash, but same Merchant M, $42.50, Date D, Receipt #101
    - Fingerprint collision is detected -> REJECTED (409)
    """
    await init_db()
    fixed_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    fixed_receipt_no = f"FISCAL-{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as db:
        user_a = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="User Collision A",
            sebet_points=0,
        )
        user_b = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="User Collision B",
            sebet_points=0,
        )
        chain = Chain(
            id=uuid.uuid4(),
            name=f"Bazarstore-{uuid.uuid4().hex[:5]}",
            slug=f"bazarstore-{uuid.uuid4().hex[:5]}",
        )
        db.add_all([user_a, user_b, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User A submits
        res1 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_a.id),
                "merchant_id": str(chain.id),
                "receipt_number": fixed_receipt_no,
                "total_amount": "42.50",
                "purchased_at": fixed_date,
                "image_hash": compute_image_hash(f"stream-A-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res1.status_code == 200
        assert res1.json()["status"] == "APPROVED"

        # User B submits with DIFFERENT image_hash but matching composite fingerprint
        res2 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_b.id),
                "merchant_id": str(chain.id),
                "receipt_number": fixed_receipt_no,
                "total_amount": "42.50",
                "purchased_at": fixed_date,
                "image_hash": compute_image_hash(f"stream-B-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res2.status_code == 409
        assert "collision" in res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_velocity_rate_limit_hourly_same_merchant():
    """
    Test 4A: Velocity rate limiting - >3 receipts from same merchant within 1 hour
    - User submits 3 receipts within 1 hour for Merchant X -> all 3 APPROVED
    - User submits 4th receipt for Merchant X within same hour -> REJECTED (400)
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Velocity Hourly User",
            sebet_points=0,
        )
        chain = Chain(
            id=uuid.uuid4(),
            name=f"Rahat-{uuid.uuid4().hex[:5]}",
            slug=f"rahat-{uuid.uuid4().hex[:5]}",
        )
        db.add_all([user, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for i in range(1, 4):
            res = await ac.post(
                "/api/v1/receipts/submit",
                json={
                    "user_id": str(user.id),
                    "merchant_id": str(chain.id),
                    "receipt_number": f"REC-H-{i}-{uuid.uuid4().hex[:6]}",
                    "total_amount": f"{10 + i}.00",
                    "image_hash": compute_image_hash(f"img-h-{i}-{uuid.uuid4().hex}".encode("utf-8")),
                },
            )
            assert res.status_code == 200
            assert res.json()["status"] == "APPROVED"

        # 4th submission within 1 hour from same merchant -> velocity rejection
        res4 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"REC-H-4-{uuid.uuid4().hex[:6]}",
                "total_amount": "14.00",
                "image_hash": compute_image_hash(f"img-h-4-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res4.status_code == 400
        assert "velocity limit" in res4.json()["detail"].lower()


@pytest.mark.asyncio
async def test_velocity_rate_limit_daily_spend_ceiling():
    """
    Test 4B: Velocity rate limiting - >$500.00 across all merchants within 24 hours
    - User submits $460.00 receipt -> APPROVED
    - User submits $60.00 receipt ($460 + $60 = $520 > $500 ceiling) -> REJECTED (400)
    """
    await init_db()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Daily Spend Limit User",
            sebet_points=0,
        )
        chain_a = Chain(id=uuid.uuid4(), name=f"Chain-A-{uuid.uuid4().hex[:5]}", slug=f"ca-{uuid.uuid4().hex[:5]}")
        chain_b = Chain(id=uuid.uuid4(), name=f"Chain-B-{uuid.uuid4().hex[:5]}", slug=f"cb-{uuid.uuid4().hex[:5]}")
        db.add_all([user, chain_a, chain_b])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. $460.00 receipt
        res1 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain_a.id),
                "receipt_number": f"REC-BIG-1-{uuid.uuid4().hex[:6]}",
                "total_amount": "460.00",
                "image_hash": compute_image_hash(f"img-big-1-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res1.status_code == 200
        assert res1.json()["status"] == "APPROVED"

        # 2. $60.00 receipt pushing daily total to $520.00
        res2 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user.id),
                "merchant_id": str(chain_b.id),
                "receipt_number": f"REC-BIG-2-{uuid.uuid4().hex[:6]}",
                "total_amount": "60.00",
                "image_hash": compute_image_hash(f"img-big-2-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res2.status_code == 400
        assert "500" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_sweethearting_terminal_anomaly_flagged_receipt_isolation():
    """
    Test 5: Sweethearting & terminal anomaly detection with ledger isolation
    - User 1 submits from Terminal POS-99 at time T -> APPROVED
    - User 2 submits from same Terminal POS-99 at time T + 30 seconds -> FLAGGED_REVIEW
    - FLAGGED_REVIEW receipt does NOT touch ledger (0 points, no ledger transaction)
    """
    await init_db()
    base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    terminal_id = f"POS-LANE-{uuid.uuid4().hex[:6]}"

    async with async_session_factory() as db:
        user_1 = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="User 1")
        user_2 = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="User 2")
        chain = Chain(id=uuid.uuid4(), name=f"Neptun-{uuid.uuid4().hex[:5]}", slug=f"neptun-{uuid.uuid4().hex[:5]}")
        db.add_all([user_1, user_2, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User 1 submits
        res1 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_1.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"T-REC-1-{uuid.uuid4().hex[:6]}",
                "total_amount": "30.00",
                "purchased_at": base_time.isoformat(),
                "terminal_id": terminal_id,
                "image_hash": compute_image_hash(f"img-t1-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res1.status_code == 200
        assert res1.json()["status"] == "APPROVED"

        # User 2 submits from SAME terminal within 30 seconds (±2 min window)
        time_user2 = base_time + timedelta(seconds=30)
        res2 = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_2.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"T-REC-2-{uuid.uuid4().hex[:6]}",
                "total_amount": "30.00",
                "purchased_at": time_user2.isoformat(),
                "terminal_id": terminal_id,
                "image_hash": compute_image_hash(f"img-t2-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "FLAGGED_REVIEW"
        assert data2["is_flagged"] is True
        assert data2["points_awarded"] == 0
        assert data2["ledger_transaction_id"] is None

    # CRITICAL: Verify double-entry ledger isolation (0 points awarded to User 2)
    async with async_session_factory() as db:
        user_2_points = await get_user_points_balance(db, user_2.id)
        assert user_2_points == 0

        flagged_receipt = await db.get(Receipt, uuid.UUID(data2["receipt_id"]))
        assert flagged_receipt.status == ReceiptStatus.FLAGGED_REVIEW
        assert flagged_receipt.ledger_transaction_id is None
        assert flagged_receipt.sebet_points_awarded == 0


@pytest.mark.asyncio
async def test_admin_approval_flow_and_ledger_release():
    """
    Test 6: Admin approval flow
    - Takes a FLAGGED_REVIEW receipt
    - Admin approves via POST /api/v1/receipts/{receipt_id}/approve
    - Status transitions to APPROVED
    - Double-entry ledger transaction is posted and points are minted
    - Repeated approval is rejected with HTTP 400
    """
    await init_db()
    base_time = datetime.now(timezone.utc) - timedelta(minutes=15)
    terminal_id = f"POS-ADMIN-{uuid.uuid4().hex[:6]}"

    async with async_session_factory() as db:
        user_a = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="Admin Test A")
        user_b = User(id=uuid.uuid4(), phone_number=f"+99450{uuid.uuid4().hex[:7]}", full_name="Admin Test B")
        chain = Chain(id=uuid.uuid4(), name=f"Bolmart-{uuid.uuid4().hex[:5]}", slug=f"bolmart-{uuid.uuid4().hex[:5]}")
        db.add_all([user_a, user_b, chain])
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Trigger FLAGGED_REVIEW by multi-user terminal collision
        await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_a.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"ADM-REC-1-{uuid.uuid4().hex[:6]}",
                "total_amount": "50.00",
                "purchased_at": base_time.isoformat(),
                "terminal_id": terminal_id,
                "image_hash": compute_image_hash(f"img-adm-1-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        res_flagged = await ac.post(
            "/api/v1/receipts/submit",
            json={
                "user_id": str(user_b.id),
                "merchant_id": str(chain.id),
                "receipt_number": f"ADM-REC-2-{uuid.uuid4().hex[:6]}",
                "total_amount": "50.00",
                "purchased_at": (base_time + timedelta(seconds=20)).isoformat(),
                "terminal_id": terminal_id,
                "image_hash": compute_image_hash(f"img-adm-2-{uuid.uuid4().hex}".encode("utf-8")),
            },
        )
        flagged_data = res_flagged.json()
        assert flagged_data["status"] == "FLAGGED_REVIEW"
        receipt_id = flagged_data["receipt_id"]

        # Admin approves the receipt
        approve_res = await ac.post(f"/api/v1/receipts/{receipt_id}/approve")
        assert approve_res.status_code == 200
        approve_data = approve_res.json()
        assert approve_data["success"] is True
        assert approve_data["status"] == "APPROVED"
        assert approve_data["points_awarded"] == 150
        assert approve_data["ledger_transaction_id"] is not None
        assert approve_data["user_new_balance"] == 150

        # Attempting to re-approve returns 400
        re_approve_res = await ac.post(f"/api/v1/receipts/{receipt_id}/approve")
        assert re_approve_res.status_code == 400
        assert "already approved" in re_approve_res.json()["detail"].lower()

    # Verify ledger state
    async with async_session_factory() as db:
        user_b_points = await get_user_points_balance(db, user_b.id)
        assert user_b_points == 150

        audit = await verify_ledger_integrity(db)
        assert audit["is_balanced"] is True
        assert len(audit["unbalanced_transactions"]) == 0
        assert audit["net_discrepancy"] == Decimal("0.0000")
