import hmac
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, Tuple
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chain import Chain
from app.models.user import User
from app.models.voucher import RedemptionVoucher, RedemptionVoucherStatus
from app.services.ledger_service import (
    get_user_points_balance,
    record_redeem_transaction,
    InsufficientPointsError,
    POINTS_PER_DOLLAR,
)


def ensure_utc(dt: datetime) -> datetime:
    """Ensures datetime is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_voucher_signature(
    voucher_code: str,
    user_id: uuid.UUID,
    merchant_id: uuid.UUID,
    points_amount: int,
    expires_at: datetime,
) -> str:
    """
    Generates an HMAC-SHA256 cryptographic signature to verify voucher authenticity
    and prevent tampering with points amounts, target merchant, or expiration.
    """
    secret = settings.SECRET_KEY.encode("utf-8")
    normalized_expires = ensure_utc(expires_at).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = f"{voucher_code}:{user_id}:{merchant_id}:{points_amount}:{normalized_expires}".encode("utf-8")
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def verify_voucher_signature(
    voucher_code: str,
    user_id: uuid.UUID,
    merchant_id: uuid.UUID,
    points_amount: int,
    expires_at: datetime,
    provided_signature: str,
) -> bool:
    """
    Verifies that the voucher payload has not been tampered with.
    """
    expected = generate_voucher_signature(
        voucher_code=voucher_code,
        user_id=user_id,
        merchant_id=merchant_id,
        points_amount=points_amount,
        expires_at=expires_at,
    )
    return hmac.compare_digest(expected, provided_signature)


async def create_redemption_voucher(
    db: AsyncSession,
    user_id: uuid.UUID,
    merchant_id: uuid.UUID,
    points_amount: int,
) -> RedemptionVoucher:
    """
    Creates a dynamic, 10-minute cryptographically signed redemption voucher:
    1. Validates that the user has sufficient points balance in the clearinghouse.
    2. Validates that the target merchant exists.
    3. Generates short-lived voucher with HMAC signature.
    """
    if points_amount <= 0:
        raise HTTPException(status_code=400, detail="Xal məbləği 0-dan böyük olmalıdır.")

    # 1. Verify merchant exists
    merchant = await db.get(Chain, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found.")

    # 2. Check user points balance in double-entry ledger
    user_points = await get_user_points_balance(db, user_id)
    if user_points < points_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Kifayət qədər bal yoxdur! Tələb olunan: {points_amount} bal, Mövcud balansınız: {user_points} bal.",
        )

    # 3. Generate unique voucher code & expiration (10 minutes)
    code = f"SEBET-VCH-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=10)
    usd_value = (Decimal(points_amount) / Decimal("100")).quantize(Decimal("0.0001"))

    # 4. Generate cryptographic signature
    signature = generate_voucher_signature(
        voucher_code=code,
        user_id=user_id,
        merchant_id=merchant_id,
        points_amount=points_amount,
        expires_at=expires_at,
    )

    voucher = RedemptionVoucher(
        voucher_code=code,
        user_id=user_id,
        merchant_id=merchant_id,
        points_amount=points_amount,
        usd_value=usd_value,
        status=RedemptionVoucherStatus.ACTIVE,
        signature=signature,
        created_at=now,
        expires_at=expires_at,
    )
    db.add(voucher)
    await db.commit()
    await db.refresh(voucher)
    return voucher


async def get_voucher_by_code(
    db: AsyncSession,
    voucher_code: str,
) -> RedemptionVoucher:
    """
    Retrieves a voucher by code, automatically marking it EXPIRED if time window has elapsed.
    """
    stmt = select(RedemptionVoucher).where(RedemptionVoucher.voucher_code == voucher_code.strip())
    voucher = (await db.execute(stmt)).scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail=f"Voucher '{voucher_code}' not found.")

    now = datetime.now(timezone.utc)
    if voucher.status == RedemptionVoucherStatus.ACTIVE and ensure_utc(now) > ensure_utc(voucher.expires_at):
        voucher.status = RedemptionVoucherStatus.EXPIRED
        await db.commit()
        await db.refresh(voucher)

    return voucher


async def claim_redemption_voucher(
    db: AsyncSession,
    voucher_code: str,
    current_merchant_id: uuid.UUID,
    current_merchant_name: str,
    is_admin: bool = False,
    cashier_notes: Optional[str] = None,
) -> dict:
    """
    Claims and burns a redemption voucher at in-store checkout:
    1. Validates voucher existence and signature.
    2. Validates expiration (returns HTTP 410 if expired).
    3. Enforces tenant scoping: verifying that current_merchant matches voucher.merchant_id.
    4. Invokes ledger_service.record_redeem_transaction() to execute double-entry settlement.
    5. Marks voucher CLAIMED.
    """
    voucher = await get_voucher_by_code(db, voucher_code)

    now = datetime.now(timezone.utc)
    if ensure_utc(now) > ensure_utc(voucher.expires_at) or voucher.status == RedemptionVoucherStatus.EXPIRED:
        raise HTTPException(
            status_code=410,
            detail="Voucher has expired. Customer must generate a fresh voucher.",
        )

    if voucher.status == RedemptionVoucherStatus.CLAIMED:
        raise HTTPException(
            status_code=400,
            detail="Voucher has already been claimed.",
        )

    if voucher.status != RedemptionVoucherStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail=f"Voucher cannot be claimed with status '{voucher.status.value}'.",
        )

    # Cryptographic integrity check
    if not verify_voucher_signature(
        voucher_code=voucher.voucher_code,
        user_id=voucher.user_id,
        merchant_id=voucher.merchant_id,
        points_amount=voucher.points_amount,
        expires_at=voucher.expires_at,
        provided_signature=voucher.signature,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid cryptographic voucher signature. Voucher may be counterfeit or tampered.",
        )

    # Scoped Merchant Authorization Check
    if voucher.merchant_id != current_merchant_id and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: This voucher was issued for a different supermarket and cannot be claimed by your store.",
        )

    # Execute double-entry clearinghouse settlement
    try:
        tx, merchant_net, platform_fee, code = await record_redeem_transaction(
            db=db,
            user_id=voucher.user_id,
            points_to_redeem=voucher.points_amount,
            merchant_id=current_merchant_id,
            merchant_name=current_merchant_name,
            servicing_fee_rate=Decimal("0.05"),
            reference_id=voucher.voucher_code,
            description=f"Checkout burn: {voucher.voucher_code} at {current_merchant_name}",
        )
    except InsufficientPointsError as ipe:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ipe))

    # Mark voucher as claimed
    voucher.status = RedemptionVoucherStatus.CLAIMED
    voucher.claimed_at = now
    voucher.redeemed_by_merchant_id = current_merchant_id
    voucher.ledger_transaction_id = tx.id
    voucher.cashier_notes = cashier_notes
    await db.commit()

    user_remaining = await get_user_points_balance(db, voucher.user_id)

    return {
        "success": True,
        "voucher_code": voucher.voucher_code,
        "merchant_id": current_merchant_id,
        "merchant_name": current_merchant_name,
        "points_redeemed": voucher.points_amount,
        "gross_discount_usd": voucher.usd_value,
        "platform_servicing_fee_usd": platform_fee,
        "merchant_net_reimbursement_usd": merchant_net,
        "ledger_transaction_id": tx.id,
        "user_remaining_points": user_remaining,
        "claimed_at": now,
        "message": f"Kupon uğurla təsdiqləndi! Müştəriyə ${voucher.usd_value:.2f} endirim tətbiq edildi. Mağazaya ödəniləcək xalis məbləğ: ${merchant_net:.3f}.",
    }
