import os
import sys
from pathlib import Path
import uuid
import asyncio
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./sebet.db"
os.environ["ENVIRONMENT"] = "testing"

from app.main import app
from app.core.database import async_session_factory, init_db
from app.models.user import User
from app.models.ledger import (
    LedgerTransaction,
    LedgerEntry,
    LedgerAccount,
    AccountCategory,
    TransactionType,
    EntryDirection,
)
from app.services.ledger_service import (
    record_earn_transaction,
    record_redeem_transaction,
    get_user_points_balance,
    get_account_balance,
    verify_ledger_integrity,
    assert_balanced_entries,
    UnbalancedTransactionError,
    InsufficientPointsError,
)


@pytest.mark.asyncio
async def test_earn_transaction_exact_accounting():
    """
    Context test:
    - User earns points at Merchant A on $50 purchase with 3% rate:
      - User receives 150 points ($1.50 credit).
      - Merchant A is debited $1.80 ($1.50 point liability + $0.30 platform clearing fee).
      - Platform retains $0.30 revenue.
    - Sum(Debits) == Sum(Credits) == $1.80
    """
    await init_db()
    async with async_session_factory() as db:
        # Create test user
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Test Earn User",
            sebet_points=0,
        )
        db.add(user)
        await db.commit()

        # Execute Earn
        tx, points_awarded, merchant_debit, platform_fee = await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=Decimal("50.00"),
            merchant_name="Merchant A",
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.30"),
            description="$50 purchase at Merchant A",
        )
        await db.commit()

        # 1. Assert return values
        assert points_awarded == 150
        assert merchant_debit == Decimal("1.8000")
        assert platform_fee == Decimal("0.3000")

        # 2. Query entries and verify exact double-entry balance
        entries = (
            await db.execute(
                db.query(LedgerEntry).filter(LedgerEntry.transaction_id == tx.id)
                if hasattr(db, "query")
                else LedgerEntry.__table__.select().where(LedgerEntry.transaction_id == tx.id)
            )
        ).fetchall()

        debit_entries = [e for e in entries if e.direction == EntryDirection.DEBIT.value or e.direction == EntryDirection.DEBIT]
        credit_entries = [e for e in entries if e.direction == EntryDirection.CREDIT.value or e.direction == EntryDirection.CREDIT]

        assert len(debit_entries) == 1
        assert len(credit_entries) == 2

        # Debits sum to $1.80
        total_debits = sum(Decimal(str(e.amount)) for e in debit_entries)
        assert total_debits == Decimal("1.8000")

        # Credits sum to $1.80 ($1.50 user liability + $0.30 platform revenue)
        total_credits = sum(Decimal(str(e.amount)) for e in credit_entries)
        assert total_credits == Decimal("1.8000")
        assert total_debits == total_credits

        # 3. Verify user's point balance
        user_points = await get_user_points_balance(db, user.id)
        assert user_points == 150


@pytest.mark.asyncio
async def test_redeem_transaction_exact_accounting():
    """
    Context test:
    - User redeems 150 points at Merchant B:
      - User is debited 150 points ($1.50 liability).
      - Merchant B receives cash reimbursement of $1.50 minus a 5% servicing fee ($1.425 net).
      - Platform records $0.075 redemption fee revenue.
    - Sum(Debits) == Sum(Credits) == $1.50
    """
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Test Redeem User",
            sebet_points=0,
        )
        db.add(user)
        await db.commit()

        # First give user 200 points via earn ($66.67 at 3%)
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=Decimal("66.6667"),
            merchant_name="Merchant A",
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.30"),
        )
        await db.commit()

        initial_balance = await get_user_points_balance(db, user.id)
        assert initial_balance == 200

        # Now redeem 150 points at Merchant B
        tx, merchant_net, platform_fee, voucher_code = await record_redeem_transaction(
            db=db,
            user_id=user.id,
            points_to_redeem=150,
            merchant_name="Merchant B",
            servicing_fee_rate=Decimal("0.05"),
        )
        await db.commit()

        # 1. Assert return values
        assert merchant_net == Decimal("1.4250")
        assert platform_fee == Decimal("0.0750")
        assert voucher_code.startswith("SEBET-")

        # 2. Verify remaining points
        remaining_points = await get_user_points_balance(db, user.id)
        assert remaining_points == 50  # 200 - 150 = 50

        # 3. Query entries and verify exact double-entry balance
        entries = (
            await db.execute(
                LedgerEntry.__table__.select().where(LedgerEntry.transaction_id == tx.id)
            )
        ).fetchall()

        debit_entries = [e for e in entries if e.direction == EntryDirection.DEBIT.value or e.direction == EntryDirection.DEBIT]
        credit_entries = [e for e in entries if e.direction == EntryDirection.CREDIT.value or e.direction == EntryDirection.CREDIT]

        assert len(debit_entries) == 1  # User debited $1.50
        assert len(credit_entries) == 2  # Merchant B credited $1.425, Platform credited $0.075

        total_debits = sum(Decimal(str(e.amount)) for e in debit_entries)
        total_credits = sum(Decimal(str(e.amount)) for e in credit_entries)

        assert total_debits == Decimal("1.5000")
        assert total_credits == Decimal("1.5000")
        assert total_debits == total_credits


@pytest.mark.asyncio
async def test_points_cannot_be_created_out_of_thin_air():
    """
    Requirement 2:
    Ensure points cannot be created out of thin air (every credit has an offsetting debit).
    """
    # 1. Test assert_balanced_entries fails on unbalanced set
    fake_tx_id = uuid.uuid4()
    fake_acc_id = uuid.uuid4()

    unbalanced_entries = [
        LedgerEntry(
            transaction_id=fake_tx_id,
            account_id=fake_acc_id,
            direction=EntryDirection.CREDIT,
            amount=Decimal("1.5000"),
            points_amount=150,
        ),
        # Missing or unequal debit
        LedgerEntry(
            transaction_id=fake_tx_id,
            account_id=fake_acc_id,
            direction=EntryDirection.DEBIT,
            amount=Decimal("1.0000"),
        ),
    ]

    with pytest.raises(UnbalancedTransactionError) as exc_info:
        assert_balanced_entries(unbalanced_entries)

    assert "Double-entry violation" in str(exc_info.value)


@pytest.mark.asyncio
async def test_insufficient_points_rejection():
    """
    Verify that a user cannot redeem more points than they hold.
    """
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Poor User",
            sebet_points=0,
        )
        db.add(user)
        await db.commit()

        # User has 0 points, attempts to redeem 50 points
        with pytest.raises(InsufficientPointsError) as exc:
            await record_redeem_transaction(
                db=db,
                user_id=user.id,
                points_to_redeem=50,
                merchant_name="Merchant B",
            )

        assert "Kifayət qədər bal yoxdur" in str(exc.value)


@pytest.mark.asyncio
async def test_concurrent_redemption_race_condition_protection():
    """
    Requirement 3: Implement ACID transactions to prevent race conditions during redemption.
    Simulate two concurrent redemptions attempting to spend the same points simultaneously.
    """
    user_id = uuid.uuid4()
    async with async_session_factory() as db:
        user = User(
            id=user_id,
            phone_number=f"+99450{uuid.uuid4().hex[:7]}",
            full_name="Race Condition User",
            sebet_points=0,
        )
        db.add(user)
        await db.commit()

        # Fund user with exactly 150 points
        await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=Decimal("50.00"),
            merchant_name="Merchant A",
            earn_rate=Decimal("0.03"),
            platform_fee=Decimal("0.30"),
        )
        await db.commit()

    # Function to attempt redemption in a separate session
    async def try_redeem():
        async with async_session_factory() as session:
            try:
                await record_redeem_transaction(
                    db=session,
                    user_id=user_id,
                    points_to_redeem=150,
                    merchant_name="Merchant B",
                )
                await session.commit()
                return True
            except (InsufficientPointsError, Exception) as e:
                await session.rollback()
                return False

    # Launch two simultaneous redemption attempts
    results = await asyncio.gather(try_redeem(), try_redeem())

    # Exactly one must succeed, and one must fail
    success_count = sum(1 for r in results if r is True)
    failure_count = sum(1 for r in results if r is False)

    assert success_count == 1, f"Expected exactly 1 success, got {success_count}"
    assert failure_count == 1, f"Expected exactly 1 failure, got {failure_count}"

    # Verify final balance is 0, NEVER negative
    async with async_session_factory() as db:
        final_balance = await get_user_points_balance(db, user_id)
        assert final_balance == 0


@pytest.mark.asyncio
async def test_clearinghouse_audit_integrity():
    """
    Audit report verifies total system balance across all transactions.
    """
    async with async_session_factory() as db:
        audit = await verify_ledger_integrity(db)
        assert audit["is_balanced"] is True
        assert audit["net_discrepancy"] == Decimal("0.0000")
        assert len(audit["unbalanced_transactions"]) == 0


@pytest.mark.asyncio
async def test_ledger_api_endpoints():
    """
    Test the FastAPI endpoints for earn, redeem, and audit.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Earn endpoint
        earn_res = await ac.post(
            "/api/v1/ledger/earn",
            json={
                "purchase_amount": "50.00",
                "earn_rate": "0.03",
                "platform_fee": "0.30",
                "merchant_name": "Merchant A",
            },
        )
        assert earn_res.status_code == 200
        earn_data = earn_res.json()
        assert earn_data["success"] is True
        assert earn_data["points_awarded"] == 150
        assert earn_data["merchant_debit_amount"] == "1.8000"
        assert earn_data["platform_clearing_fee"] == "0.3000"

        # 2. Redeem endpoint
        redeem_res = await ac.post(
            "/api/v1/ledger/redeem",
            json={
                "points_to_redeem": 150,
                "merchant_name": "Merchant B",
                "servicing_fee_rate": "0.05",
            },
        )
        assert redeem_res.status_code == 200
        redeem_data = redeem_res.json()
        assert redeem_data["success"] is True
        assert redeem_data["points_redeemed"] == 150
        assert redeem_data["merchant_reimbursement_net"] == "1.4250"
        assert redeem_data["platform_servicing_fee"] == "0.0750"

        # 3. Audit endpoint
        audit_res = await ac.get("/api/v1/ledger/audit")
        assert audit_res.status_code == 200
        audit_data = audit_res.json()
        assert audit_data["is_balanced"] is True
        assert audit_data["net_discrepancy"] == "0.0000"

        # 4. Transactions list endpoint
        txs_res = await ac.get("/api/v1/ledger/transactions")
        assert txs_res.status_code == 200
        txs_data = txs_res.json()
        assert len(txs_data) >= 2
