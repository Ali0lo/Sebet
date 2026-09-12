import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.chain import Chain
from app.models.voucher import RedemptionVoucher, RedemptionVoucherStatus
from app.schemas.redemption import (
    CreateVoucherRequest,
    CreateVoucherResponse,
    ClaimVoucherRequest,
    ClaimVoucherResponse,
    VoucherStatusResponse,
    VoucherPreviewResponse,
)
from app.services.redemption_service import (
    create_redemption_voucher,
    claim_redemption_voucher,
    get_voucher_by_code,
    ensure_utc,
)
from app.api.deps import get_current_merchant, MerchantContext

router = APIRouter(prefix="/redemption", tags=["redemption"])


async def resolve_user(db: AsyncSession, user_id: Optional[uuid.UUID]) -> User:
    """Resolves target user or defaults to the first demo user."""
    if user_id:
        user = await db.get(User, user_id)
        if not user:
            phone_suffix = abs(hash(str(user_id))) % 10000000
            user = User(
                id=user_id,
                phone_number=f"+99450{phone_suffix:07d}",
                full_name=f"User {str(user_id)[:6]}",
                sebet_points=0,
            )
            db.add(user)
            await db.commit()
        return user

    stmt = select(User)
    user = (await db.execute(stmt)).scalars().first()
    if not user:
        user = User(
            phone_number="+994501234567",
            full_name="Demo User",
            sebet_points=0,
        )
        db.add(user)
        await db.commit()
    return user


@router.post("/create-voucher", response_model=CreateVoucherResponse)
async def create_voucher_endpoint(
    payload: CreateVoucherRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a dynamic 10-minute cryptographically signed redemption voucher:
    - Validates user has sufficient balance in double-entry ledger.
    - Locks the voucher scope to target merchant.
    - Generates HMAC-SHA256 signature for cashier verification.
    """
    user = await resolve_user(db, payload.user_id)
    voucher = await create_redemption_voucher(
        db=db,
        user_id=user.id,
        merchant_id=payload.merchant_id,
        points_amount=payload.points_amount,
    )

    merchant = await db.get(Chain, voucher.merchant_id)
    merchant_name = merchant.name if merchant else "Supermarket"

    return CreateVoucherResponse(
        voucher_code=voucher.voucher_code,
        user_id=voucher.user_id,
        merchant_id=voucher.merchant_id,
        merchant_name=merchant_name,
        points_amount=voucher.points_amount,
        usd_value=voucher.usd_value,
        expires_at=voucher.expires_at,
        signature=voucher.signature,
        message=f"{voucher.points_amount} ballıq (${voucher.usd_value:.2f}) kupon yaradıldı. 10 dəqiqə ərzində kassirə təqdim edin.",
    )


@router.post("/claim-voucher", response_model=ClaimVoucherResponse)
async def claim_voucher_endpoint(
    payload: ClaimVoucherRequest,
    current_merchant: MerchantContext = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes in-store cashier burn and double-entry clearinghouse settlement:
    - Validates merchant authentication via X-Merchant-Id header.
    - Verifies voucher has not expired (HTTP 410 if expired).
    - Prevents competitor stores from claiming another merchant's voucher (HTTP 403).
    - Debits customer points liability, credits merchant net reimbursement, credits 5% servicing fee.
    """
    result = await claim_redemption_voucher(
        db=db,
        voucher_code=payload.voucher_code,
        current_merchant_id=current_merchant.merchant_id,
        current_merchant_name=current_merchant.name,
        is_admin=current_merchant.is_admin,
        cashier_notes=payload.cashier_notes,
    )
    return ClaimVoucherResponse(**result)


@router.get("/voucher/{voucher_code}/status", response_model=VoucherStatusResponse)
async def get_voucher_status_endpoint(
    voucher_code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public/consumer polling endpoint to observe when a voucher is burned at checkout.
    """
    voucher = await get_voucher_by_code(db, voucher_code)
    merchant = await db.get(Chain, voucher.merchant_id)
    merchant_name = merchant.name if merchant else "Supermarket"

    now = datetime.now(timezone.utc)
    is_expired = ensure_utc(now) > ensure_utc(voucher.expires_at)

    return VoucherStatusResponse(
        voucher_code=voucher.voucher_code,
        status=voucher.status.value,
        points_amount=voucher.points_amount,
        usd_value=voucher.usd_value,
        merchant_id=voucher.merchant_id,
        merchant_name=merchant_name,
        expires_at=voucher.expires_at,
        claimed_at=voucher.claimed_at,
        is_expired=is_expired,
        ledger_transaction_id=voucher.ledger_transaction_id,
        message="Kupon aktivdir." if voucher.status == RedemptionVoucherStatus.ACTIVE else f"Kupon statusu: {voucher.status.value}",
    )


@router.get("/voucher/{voucher_code}/preview", response_model=VoucherPreviewResponse)
async def preview_voucher_for_cashier(
    voucher_code: str,
    current_merchant: MerchantContext = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """
    Cashier preview endpoint to inspect discount amount and scope before claiming.
    """
    voucher = await get_voucher_by_code(db, voucher_code)
    merchant = await db.get(Chain, voucher.merchant_id)
    merchant_name = merchant.name if merchant else "Supermarket"
    user = await db.get(User, voucher.user_id)
    user_name = user.full_name if user else "Müştəri"

    now = datetime.now(timezone.utc)
    is_valid = voucher.status == RedemptionVoucherStatus.ACTIVE and ensure_utc(now) <= ensure_utc(voucher.expires_at)
    is_match = voucher.merchant_id == current_merchant.merchant_id or current_merchant.is_admin

    gross = voucher.usd_value
    fee = (gross * Decimal("0.05")).quantize(Decimal("0.0001"))
    net = (gross - fee).quantize(Decimal("0.0001"))

    return VoucherPreviewResponse(
        voucher_code=voucher.voucher_code,
        points_amount=voucher.points_amount,
        gross_discount_usd=gross,
        platform_servicing_fee_usd=fee,
        merchant_net_reimbursement_usd=net,
        status=voucher.status.value,
        is_valid=is_valid,
        expires_at=voucher.expires_at,
        merchant_id=voucher.merchant_id,
        merchant_name=merchant_name,
        is_merchant_match=is_match,
        user_name=user_name,
    )
