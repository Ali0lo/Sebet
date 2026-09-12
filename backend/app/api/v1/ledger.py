import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.ledger import LedgerTransaction, LedgerEntry, LedgerAccount
from app.schemas.ledger import (
    EarnRequest,
    EarnResponse,
    RedeemRequest,
    RedeemResponse,
    LedgerAuditReport,
    LedgerTransactionOut,
    LedgerEntryOut,
    LedgerAccountBalanceOut,
)
from app.services.ledger_service import (
    record_earn_transaction,
    record_redeem_transaction,
    verify_ledger_integrity,
    get_user_points_balance,
    get_account_balance,
    get_or_create_user_points_account,
    InsufficientPointsError,
    UnbalancedTransactionError,
    POINTS_PER_DOLLAR,
    DOLLARS_PER_POINT,
)

router = APIRouter(prefix="/ledger", tags=["ledger"])


async def resolve_user(db: AsyncSession, user_id: Optional[uuid.UUID]) -> User:
    """Helper to find user or default to demo user."""
    if user_id:
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        return user

    stmt = select(User)
    user = (await db.execute(stmt)).scalars().first()
    if not user:
        user = User(
            phone_number="+994501234567",
            full_name="Ali Iskandarli",
            sebet_points=0,
        )
        db.add(user)
        await db.commit()
    return user


@router.post("/earn", response_model=EarnResponse)
async def earn_points(payload: EarnRequest, db: AsyncSession = Depends(get_db)):
    """
    Records an earn transaction in the double-entry clearinghouse:
    - User purchase at Merchant A (e.g. $50.00 at 3% earn rate)
    - User credited 150 points ($1.50)
    - Merchant A debited $1.80 ($1.50 liability + $0.30 platform fee)
    - Platform credited $0.30 clearing fee revenue
    """
    user = await resolve_user(db, payload.user_id)

    try:
        tx, points_awarded, merchant_debit, platform_fee = await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=payload.purchase_amount,
            merchant_id=payload.merchant_id,
            merchant_name=payload.merchant_name or "Merchant A",
            earn_rate=payload.earn_rate,
            platform_fee=payload.platform_fee,
            reference_id=payload.reference_id,
            description=payload.description,
        )
        await db.commit()

        new_balance = await get_user_points_balance(db, user.id)

        return EarnResponse(
            success=True,
            transaction_id=tx.id,
            purchase_amount=payload.purchase_amount,
            points_awarded=points_awarded,
            points_value_usd=(points_awarded * DOLLARS_PER_POINT),
            merchant_debit_amount=merchant_debit,
            platform_clearing_fee=platform_fee,
            user_new_points_balance=new_balance,
            message=f"Uğurlu əməliyyat! +{points_awarded} bal balansınıza əlavə edildi.",
        )
    except UnbalancedTransactionError as ute:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ledger Invariant Error: {ute}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_points(payload: RedeemRequest, db: AsyncSession = Depends(get_db)):
    """
    Executes an ACID double-entry points redemption with pessimistic row locking:
    - User debited 150 points ($1.50)
    - Merchant B credited $1.425 cash reimbursement
    - Platform credited $0.075 redemption servicing fee revenue
    """
    user = await resolve_user(db, payload.user_id)

    try:
        tx, merchant_net, platform_fee, voucher_code = await record_redeem_transaction(
            db=db,
            user_id=user.id,
            points_to_redeem=payload.points_to_redeem,
            merchant_id=payload.merchant_id,
            merchant_name=payload.merchant_name or "Merchant B",
            servicing_fee_rate=payload.servicing_fee_rate,
            reference_id=payload.reference_id,
            description=payload.description,
        )
        await db.commit()

        remaining_points = await get_user_points_balance(db, user.id)

        return RedeemResponse(
            success=True,
            transaction_id=tx.id,
            voucher_code=voucher_code,
            points_redeemed=payload.points_to_redeem,
            points_value_usd=(payload.points_to_redeem * DOLLARS_PER_POINT),
            merchant_reimbursement_net=merchant_net,
            platform_servicing_fee=platform_fee,
            user_remaining_points=remaining_points,
            message=f"Təbriklər! {payload.points_to_redeem} bal xərcləndi, kuponunuz hazırdır.",
        )
    except InsufficientPointsError as ipe:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ipe))
    except UnbalancedTransactionError as ute:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ledger Invariant Error: {ute}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit", response_model=LedgerAuditReport)
async def audit_clearinghouse(db: AsyncSession = Depends(get_db)):
    """
    Returns full cryptographic/accounting audit report verifying that:
    - Sum(Debits) == Sum(Credits) for every single transaction.
    - Zero points were created out of thin air.
    - Total points liability matches merchant funding and platform revenue.
    """
    audit = await verify_ledger_integrity(db)
    return LedgerAuditReport(**audit)


@router.get("/balance", response_model=LedgerAccountBalanceOut)
@router.get("/balance/{user_id}", response_model=LedgerAccountBalanceOut)
async def get_user_balance(user_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db)):
    """
    Returns exact user point account balance from the double-entry ledger.
    If user_id is omitted, defaults to the active demo user.
    """
    user = await resolve_user(db, user_id)
    account = await get_or_create_user_points_account(db, user.id)
    balance_amount = await get_account_balance(db, account.id)
    points_balance = int(balance_amount * POINTS_PER_DOLLAR)

    return LedgerAccountBalanceOut(
        account_id=account.id,
        account_code=account.account_code,
        name=account.name,
        category=account.category,
        currency=account.currency,
        balance_amount=balance_amount,
        points_balance=points_balance,
    )


@router.get("/transactions", response_model=List[LedgerTransactionOut])
async def list_transactions(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists recent journal transactions and their double-entry line postings.
    """
    stmt = select(LedgerTransaction).order_by(desc(LedgerTransaction.posted_at)).limit(limit)
    txs = (await db.execute(stmt)).scalars().all()

    results: List[LedgerTransactionOut] = []
    for tx in txs:
        entries_stmt = (
            select(LedgerEntry, LedgerAccount)
            .join(LedgerAccount, LedgerEntry.account_id == LedgerAccount.id)
            .where(LedgerEntry.transaction_id == tx.id)
        )
        entries_res = (await db.execute(entries_stmt)).all()

        entry_outs: List[LedgerEntryOut] = []
        tx_total = Decimal("0.0000")
        for entry, account in entries_res:
            if entry.direction == "DEBIT":
                tx_total += entry.amount
            entry_outs.append(
                LedgerEntryOut(
                    id=entry.id,
                    account_id=entry.account_id,
                    account_code=account.account_code,
                    account_name=account.name,
                    account_category=account.category,
                    direction=entry.direction,
                    amount=entry.amount,
                    points_amount=entry.points_amount,
                    description=entry.description,
                    created_at=entry.created_at,
                )
            )

        results.append(
            LedgerTransactionOut(
                id=tx.id,
                transaction_type=tx.transaction_type,
                reference_id=tx.reference_id,
                description=tx.description,
                status=tx.status,
                posted_at=tx.posted_at,
                total_amount=tx_total,
                entries=entry_outs,
            )
        )

    return results
