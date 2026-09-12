import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt, ReceiptStatus


@dataclass
class FraudEvaluationResult:
    status: ReceiptStatus
    reason: Optional[str] = None
    rule_triggered: Optional[str] = None

    @property
    def is_approved(self) -> bool:
        return self.status == ReceiptStatus.APPROVED

    @property
    def is_rejected(self) -> bool:
        return self.status == ReceiptStatus.REJECTED

    @property
    def is_flagged(self) -> bool:
        return self.status == ReceiptStatus.FLAGGED_REVIEW


def compute_image_hash(image_bytes: bytes) -> str:
    """
    Computes a deterministic SHA-256 hex digest of image bytes.
    """
    return hashlib.sha256(image_bytes).hexdigest()


def compute_composite_fingerprint(
    merchant_id: Optional[uuid.UUID | str],
    total_amount: Decimal | float,
    purchased_at: datetime,
    receipt_number: Optional[str] = None,
) -> str:
    """
    Computes a composite fingerprint hash combining:
    merchant_id + normalized total_amount + date(purchased_at) + optional receipt_number.
    """
    m_id_str = str(merchant_id).strip().lower() if merchant_id else "NONE"
    amount_str = f"{Decimal(str(total_amount)):.2f}"
    date_str = purchased_at.strftime("%Y-%m-%d")
    rcpt_str = (receipt_number or "").strip().lower()

    raw_payload = f"{m_id_str}:{amount_str}:{date_str}:{rcpt_str}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()


async def evaluate_receipt_fraud(
    db: AsyncSession,
    user_id: uuid.UUID,
    total_amount: Decimal,
    purchased_at: datetime,
    image_hash: str,
    composite_fingerprint: str,
    merchant_id: Optional[uuid.UUID] = None,
    terminal_id: Optional[str] = None,
    current_receipt_id: Optional[uuid.UUID] = None,
) -> FraudEvaluationResult:
    """
    Executes the anti-fraud and deduplication pipeline:
    1. Duplicate Image Check: Rejects if image_hash was submitted within the last 60 days.
    2. Fingerprint Collision: Rejects if composite_fingerprint matches within 7-day rolling window.
    3. Velocity Rate Limiting:
       - Rejects if >3 receipts from the same merchant within 1 hour for this user.
       - Rejects if user's cumulative receipts within 24 hours exceed $500.00.
    4. Sweethearting & Terminal Anomaly Detection:
       - Flags for review if multiple distinct users submit from the same terminal within ±2 minutes.
    """
    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # Rule 1: Duplicate Image Check (60-day window)
    # -------------------------------------------------------------
    cutoff_60d = now - timedelta(days=60)
    dup_img_stmt = select(Receipt).where(
        Receipt.image_hash == image_hash,
        Receipt.created_at >= cutoff_60d,
    )
    if current_receipt_id:
        dup_img_stmt = dup_img_stmt.where(Receipt.id != current_receipt_id)

    dup_img_result = await db.execute(dup_img_stmt)
    existing_img_receipt = dup_img_result.scalars().first()
    if existing_img_receipt:
        return FraudEvaluationResult(
            status=ReceiptStatus.REJECTED,
            reason="Duplicate receipt image detected within 60 days window.",
            rule_triggered="DUPLICATE_IMAGE_60D",
        )

    # -------------------------------------------------------------
    # Rule 2: Composite Fingerprint Collision Check (7-day window)
    # -------------------------------------------------------------
    cutoff_7d = now - timedelta(days=7)
    fp_stmt = select(Receipt).where(
        Receipt.composite_fingerprint == composite_fingerprint,
        Receipt.created_at >= cutoff_7d,
        Receipt.status.in_([ReceiptStatus.APPROVED, ReceiptStatus.PENDING, ReceiptStatus.FLAGGED_REVIEW]),
    )
    if merchant_id:
        fp_stmt = fp_stmt.where(Receipt.merchant_id == merchant_id)
    if current_receipt_id:
        fp_stmt = fp_stmt.where(Receipt.id != current_receipt_id)

    fp_result = await db.execute(fp_stmt)
    existing_fp_receipt = fp_result.scalars().first()
    if existing_fp_receipt:
        return FraudEvaluationResult(
            status=ReceiptStatus.REJECTED,
            reason="Fingerprint collision detected within 7-day rolling window for this merchant.",
            rule_triggered="FINGERPRINT_COLLISION_7D",
        )

    # -------------------------------------------------------------
    # Rule 3A: Velocity Check - Same Merchant Hourly Limit (>3 in 1hr)
    # -------------------------------------------------------------
    cutoff_1h = now - timedelta(hours=1)
    hourly_stmt = select(func.count(Receipt.id)).where(
        Receipt.user_id == user_id,
        Receipt.created_at >= cutoff_1h,
        Receipt.status != ReceiptStatus.REJECTED,
    )
    if merchant_id:
        hourly_stmt = hourly_stmt.where(Receipt.merchant_id == merchant_id)
    if current_receipt_id:
        hourly_stmt = hourly_stmt.where(Receipt.id != current_receipt_id)

    hourly_count = (await db.execute(hourly_stmt)).scalar() or 0
    if hourly_count >= 3:
        return FraudEvaluationResult(
            status=ReceiptStatus.REJECTED,
            reason="Velocity limit exceeded: maximum 3 receipts per merchant per hour.",
            rule_triggered="VELOCITY_HOURLY_MERCHANT",
        )

    # -------------------------------------------------------------
    # Rule 3B: Velocity Check - 24-Hour Total Spend Ceiling (>$500.00)
    # -------------------------------------------------------------
    cutoff_24h = now - timedelta(hours=24)
    daily_sum_stmt = select(func.coalesce(func.sum(Receipt.total_amount), Decimal("0.0000"))).where(
        Receipt.user_id == user_id,
        Receipt.created_at >= cutoff_24h,
        Receipt.status.in_([ReceiptStatus.APPROVED, ReceiptStatus.PENDING, ReceiptStatus.FLAGGED_REVIEW]),
    )
    if current_receipt_id:
        daily_sum_stmt = daily_sum_stmt.where(Receipt.id != current_receipt_id)

    daily_sum = Decimal(str((await db.execute(daily_sum_stmt)).scalar() or "0.0000"))
    if daily_sum + Decimal(str(total_amount)) > Decimal("500.0000"):
        return FraudEvaluationResult(
            status=ReceiptStatus.REJECTED,
            reason=f"Velocity limit exceeded: cumulative receipts (${daily_sum + Decimal(str(total_amount)):.2f}) exceed $500.00 limit across all merchants within 24 hours.",
            rule_triggered="VELOCITY_DAILY_SPEND_500",
        )

    # -------------------------------------------------------------
    # Rule 4: Sweethearting & Terminal Anomaly Detection (±2 minutes)
    # -------------------------------------------------------------
    if terminal_id:
        min_time = purchased_at - timedelta(minutes=2)
        max_time = purchased_at + timedelta(minutes=2)

        anomaly_stmt = select(Receipt).where(
            Receipt.terminal_id == terminal_id,
            Receipt.user_id != user_id,
            Receipt.purchased_at >= min_time,
            Receipt.purchased_at <= max_time,
            Receipt.status != ReceiptStatus.REJECTED,
        )
        if merchant_id:
            anomaly_stmt = anomaly_stmt.where(Receipt.merchant_id == merchant_id)
        if current_receipt_id:
            anomaly_stmt = anomaly_stmt.where(Receipt.id != current_receipt_id)

        anomaly_result = await db.execute(anomaly_stmt)
        collision = anomaly_result.scalars().first()
        if collision:
            return FraudEvaluationResult(
                status=ReceiptStatus.FLAGGED_REVIEW,
                reason="Sweethearting / terminal anomaly detected: multiple distinct users submitted from the same terminal within ±2 minutes.",
                rule_triggered="SWEETHEARTING_TERMINAL_ANOMALY",
            )

    # -------------------------------------------------------------
    # Clean Receipt: Approved
    # -------------------------------------------------------------
    return FraudEvaluationResult(
        status=ReceiptStatus.APPROVED,
        reason=None,
        rule_triggered=None,
    )

