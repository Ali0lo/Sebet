import base64
import hashlib
import uuid
from decimal import Decimal
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import (
    Receipt,
    ReceiptItem,
    ReceiptStatus,
    Store,
    Product,
    StorePrice,
    User,
    Chain,
)
from app.schemas.receipt import (
    ParsedReceiptOut,
    ParsedLineItemOut,
    SampleReceiptOut,
    ReceiptSubmitRequest,
    ReceiptSubmitResponse,
    ReceiptApproveResponse,
)
from app.schemas.retail_media import BrandBoostInfo
from app.services.ocr_service import (
    AzerbaijaniReceiptParser,
    SAMPLE_BAKU_RECEIPTS,
)
from app.services.receipt_fraud_service import (
    compute_image_hash,
    compute_composite_fingerprint,
    evaluate_receipt_fraud,
)
from app.services.ledger_service import (
    record_earn_transaction,
    get_user_points_balance,
)
from app.services.retail_media_service import (
    evaluate_receipt_brand_boost,
    apply_brand_conversion,
)

router = APIRouter(prefix="/receipts", tags=["receipts"])


async def resolve_user(db: AsyncSession, user_id: Optional[uuid.UUID]) -> User:
    """Helper to resolve a user or retrieve/create a default demo user."""
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


async def process_receipt_text_and_save(
    text: str,
    image_url: str,
    user_id: Optional[uuid.UUID],
    db: AsyncSession,
    image_bytes: Optional[bytes] = None,
) -> ParsedReceiptOut:
    # 1. Fetch all products for canonical matching
    prod_stmt = select(Product)
    prod_res = await db.execute(prod_stmt)
    products = prod_res.scalars().all()
    canonical_prods = [
        {"id": p.id, "canonical_name": p.canonical_name, "brand": p.brand}
        for p in products
    ]

    # 2. Run parser
    parsed = AzerbaijaniReceiptParser.parse_full_receipt(text, canonical_prods)

    # 3. Match store branch via VÖEN and Obyekt Kodu
    matched_store = None
    if parsed.voen:
        store_stmt = select(Store).options(selectinload(Store.chain)).where(Store.voen == parsed.voen)
        if parsed.obyekt_kodu:
            store_stmt = store_stmt.where(Store.obyekt_kodu == parsed.obyekt_kodu)
        store_res = await db.execute(store_stmt)
        matched_store = store_res.scalars().first()

    # If not found by obyekt kodu, try just by voen
    if not matched_store and parsed.voen:
        store_stmt = select(Store).options(selectinload(Store.chain)).where(Store.voen == parsed.voen)
        store_res = await db.execute(store_stmt)
        matched_store = store_res.scalars().first()

    # 4. Create receipt record
    now = datetime.now(timezone.utc)
    purchased_dt = parsed.receipt_date or now
    points_to_award = 50
    amount_dec = Decimal(str(parsed.total_amount or 0.0)).quantize(Decimal("0.0001"))

    img_hash = compute_image_hash(image_bytes) if image_bytes else compute_image_hash(text.encode("utf-8"))
    chain_id = matched_store.chain_id if (matched_store and matched_store.chain_id) else None
    composite_fp = compute_composite_fingerprint(
        merchant_id=chain_id,
        total_amount=amount_dec,
        purchased_at=purchased_dt,
        receipt_number=parsed.fiscal_id,
    )

    receipt_obj = Receipt(
        user_id=user_id,
        merchant_id=chain_id,
        receipt_number=parsed.fiscal_id,
        image_url=image_url,
        fiscal_id=parsed.fiscal_id,
        voen=parsed.voen,
        obyekt_kodu=parsed.obyekt_kodu,
        matched_store_id=matched_store.id if matched_store else None,
        receipt_date=purchased_dt,
        purchased_at=purchased_dt,
        total_amount=amount_dec,
        image_hash=img_hash,
        composite_fingerprint=composite_fp,
        status=ReceiptStatus.APPROVED,
        raw_ocr_text=parsed.raw_text,
        processing_status="PROCESSED",
        sebet_points_awarded=points_to_award,
    )
    db.add(receipt_obj)
    await db.flush()

    # 5. Add line items & update store prices crowdsourced from receipt
    line_items_out = []
    for it in parsed.items:
        r_item = ReceiptItem(
            receipt_id=receipt_obj.id,
            raw_line_text=it.raw_name,
            matched_product_id=it.matched_product_id,
            quantity=it.quantity,
            unit_price=it.unit_price,
            total_price=it.total_price,
            confidence_score=it.confidence_score,
        )
        db.add(r_item)

        line_items_out.append(
            ParsedLineItemOut(
                raw_name=it.raw_name,
                quantity=it.quantity,
                unit_price=it.unit_price,
                total_price=it.total_price,
                matched_product_id=it.matched_product_id,
                matched_product_name=it.matched_product_name,
                confidence_score=it.confidence_score,
            )
        )

        # Update store prices with crowdsourced price
        if matched_store and it.matched_product_id:
            sp = StorePrice(
                product_id=it.matched_product_id,
                store_id=matched_store.id,
                price=it.unit_price,
                is_promo=False,
                in_stock=True,
                source_type="receipt_ocr",
                confidence_score=0.98,
                recorded_at=now,
            )
            db.add(sp)

    # 6. Award SebEt points to user if user exists
    user_stmt = select(User)
    user_res = await db.execute(user_stmt)
    demo_user = user_res.scalars().first()
    if demo_user:
        demo_user.sebet_points += points_to_award

    await db.commit()

    return ParsedReceiptOut(
        id=receipt_obj.id,
        fiscal_id=parsed.fiscal_id,
        voen=parsed.voen,
        obyekt_kodu=parsed.obyekt_kodu,
        matched_store_id=matched_store.id if matched_store else None,
        store_name=matched_store.branch_name if matched_store else "Baku Supermarket Branch",
        chain_name=matched_store.chain.name if matched_store else "Supermarket",
        chain_color=matched_store.chain.color if matched_store else "#10B981",
        receipt_date=receipt_obj.receipt_date,
        total_amount=float(amount_dec),
        items=line_items_out,
        processing_status="PROCESSED",
        sebet_points_awarded=points_to_award,
        raw_ocr_text=parsed.raw_text,
        message=f"Receipt verified! +{points_to_award} Sebet Points awarded!",
    )


@router.post("/submit", response_model=ReceiptSubmitResponse)
async def submit_receipt(
    payload: ReceiptSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submits a receipt through the deduplication and anti-fraud pipeline:
    1. Validates duplicate images within 60 days.
    2. Checks composite fingerprint collision within 7 days for the same merchant.
    3. Enforces velocity rate limits:
       - <=3 receipts per merchant per hour
       - <=$500.00 total spend across all merchants in 24 hours
    4. Detects sweethearting / terminal anomalies (multiple distinct users within ±2 min).
    5. Only approved receipts touch the double-entry ledger clearinghouse to mint loyalty points.
    """
    # 1. Resolve User
    user = await resolve_user(db, payload.user_id)

    # 2. Resolve Merchant / Chain
    merchant_name = payload.merchant_name or "Merchant"
    merchant_id = payload.merchant_id

    if merchant_id:
        chain = await db.get(Chain, merchant_id)
        if chain:
            merchant_name = chain.name
    elif payload.merchant_name:
        stmt = select(Chain).where(Chain.name.ilike(payload.merchant_name.strip()))
        chain = (await db.execute(stmt)).scalars().first()
        if chain:
            merchant_id = chain.id
            merchant_name = chain.name

    # 3. Timestamp & Amount Normalization
    purchased_at = payload.purchased_at or datetime.now(timezone.utc)
    total_amount = Decimal(str(payload.total_amount)).quantize(Decimal("0.0001"))

    # 4. Compute Image Hash & Composite Fingerprint
    if payload.image_hash:
        image_hash = payload.image_hash.strip().lower()
    elif payload.image_base64:
        try:
            image_bytes = base64.b64decode(payload.image_base64)
            image_hash = compute_image_hash(image_bytes)
        except Exception:
            image_hash = hashlib.sha256(payload.image_base64.encode("utf-8")).hexdigest()
    else:
        # Fallback deterministic hash based on submission data
        fallback_seed = f"{user.id}:{merchant_id}:{total_amount}:{payload.receipt_number or uuid.uuid4().hex}"
        image_hash = hashlib.sha256(fallback_seed.encode("utf-8")).hexdigest()

    composite_fingerprint = compute_composite_fingerprint(
        merchant_id=merchant_id,
        total_amount=total_amount,
        purchased_at=purchased_at,
        receipt_number=payload.receipt_number,
    )

    # 5. Run Fraud & Deduplication Pipeline
    eval_result = await evaluate_receipt_fraud(
        db=db,
        user_id=user.id,
        merchant_id=merchant_id,
        total_amount=total_amount,
        purchased_at=purchased_at,
        image_hash=image_hash,
        composite_fingerprint=composite_fingerprint,
        terminal_id=payload.terminal_id,
    )

    # 6. Branch on Evaluation Outcome
    if eval_result.is_rejected:
        # Record rejected receipt for audit trail
        rejected_receipt = Receipt(
            user_id=user.id,
            merchant_id=merchant_id,
            receipt_number=payload.receipt_number,
            total_amount=total_amount,
            purchased_at=purchased_at,
            image_hash=image_hash,
            composite_fingerprint=composite_fingerprint,
            status=ReceiptStatus.REJECTED,
            rejection_reason=eval_result.reason,
            terminal_id=payload.terminal_id,
            image_url=payload.image_url or "",
            raw_ocr_text=payload.raw_ocr_text,
            processing_status="FAILED",
            sebet_points_awarded=0,
        )
        db.add(rejected_receipt)
        await db.commit()

        # Choose HTTP 409 Conflict for duplicate/collision, 400 Bad Request for velocity/other
        is_conflict = (
            "duplicate" in (eval_result.reason or "").lower()
            or "collision" in (eval_result.reason or "").lower()
        )
        status_code = 409 if is_conflict else 400
        raise HTTPException(status_code=status_code, detail=eval_result.reason)

    elif eval_result.is_flagged:
        # Mark FLAGGED_REVIEW: completely isolated from the double-entry ledger
        flagged_receipt = Receipt(
            user_id=user.id,
            merchant_id=merchant_id,
            receipt_number=payload.receipt_number,
            total_amount=total_amount,
            purchased_at=purchased_at,
            image_hash=image_hash,
            composite_fingerprint=composite_fingerprint,
            status=ReceiptStatus.FLAGGED_REVIEW,
            rejection_reason=eval_result.reason,
            terminal_id=payload.terminal_id,
            image_url=payload.image_url or "",
            raw_ocr_text=payload.raw_ocr_text,
            processing_status="PENDING",
            sebet_points_awarded=0,
            ledger_transaction_id=None,
        )
        db.add(flagged_receipt)
        await db.commit()

        return ReceiptSubmitResponse(
            success=True,
            receipt_id=flagged_receipt.id,
            status=flagged_receipt.status.value,
            is_flagged=True,
            is_rejected=False,
            rejection_reason=eval_result.reason,
            points_awarded=0,
            ledger_transaction_id=None,
            total_amount=total_amount,
            message="Qəbz şübhəli əməliyyat kimi qeydə alındı və moderator yoxlanışına göndərildi.",
        )

    else:
        # Approved: persist receipt and record double-entry earn transaction
        approved_receipt = Receipt(
            user_id=user.id,
            merchant_id=merchant_id,
            receipt_number=payload.receipt_number,
            total_amount=total_amount,
            purchased_at=purchased_at,
            image_hash=image_hash,
            composite_fingerprint=composite_fingerprint,
            status=ReceiptStatus.APPROVED,
            rejection_reason=None,
            terminal_id=payload.terminal_id,
            image_url=payload.image_url or "",
            raw_ocr_text=payload.raw_ocr_text,
            processing_status="PROCESSED",
        )
        db.add(approved_receipt)
        await db.flush()

        # Check for Brand-Sponsored SKU Multipliers
        brand_boost_data = await evaluate_receipt_brand_boost(
            db=db,
            line_items=payload.line_items,
            raw_text=payload.raw_ocr_text,
            total_amount=total_amount,
            base_earn_rate=payload.earn_rate or Decimal("0.03"),
        )

        brand_bonus_points = 0
        brand_bonus_usd = Decimal("0.0000")
        brand_campaign_id = None
        brand_name_str = None
        brand_boost_info = None

        if brand_boost_data:
            brand_bonus_points = brand_boost_data["bonus_points"]
            brand_bonus_usd = brand_boost_data["bonus_usd"]
            brand_campaign_id = brand_boost_data["campaign_id"]
            brand_name_str = brand_boost_data["brand_name"]
            brand_boost_info = BrandBoostInfo(
                campaign_id=brand_boost_data["campaign_id"],
                brand_name=brand_boost_data["brand_name"],
                campaign_title=brand_boost_data["campaign_title"],
                multiplier=brand_boost_data["multiplier"],
                matched_keywords=brand_boost_data["matched_keywords"],
                bonus_points=brand_boost_data["bonus_points"],
                bonus_usd=float(brand_boost_data["bonus_usd"]),
            )

        tx, points_awarded, merchant_debit, platform_fee = await record_earn_transaction(
            db=db,
            user_id=user.id,
            purchase_amount=total_amount,
            merchant_id=merchant_id,
            merchant_name=merchant_name,
            earn_rate=payload.earn_rate or Decimal("0.03"),
            reference_id=f"RECEIPT-{approved_receipt.id}",
            description=f"Receipt earn: {payload.receipt_number or str(approved_receipt.id)[:8]}",
            brand_bonus_points=brand_bonus_points,
            brand_bonus_usd=brand_bonus_usd,
            brand_campaign_id=brand_campaign_id,
            brand_name=brand_name_str,
        )

        # If brand boost was applied, record the conversion in retail media engine
        if brand_campaign_id and brand_bonus_usd > Decimal("0.0000"):
            await apply_brand_conversion(
                db=db,
                campaign_id=brand_campaign_id,
                user_id=user.id,
                receipt_id=approved_receipt.id,
                bonus_usd=brand_bonus_usd,
                metadata={"receipt_number": payload.receipt_number, "merchant_name": merchant_name},
            )

        approved_receipt.ledger_transaction_id = tx.id
        approved_receipt.sebet_points_awarded = points_awarded
        await db.commit()

        base_points = points_awarded - brand_bonus_points
        msg = f"Qəbz təsdiqləndi! +{points_awarded} bal balansınıza əlavə edildi."
        if brand_boost_info:
            msg += f" ({brand_boost_info.brand_name} {brand_boost_info.multiplier:g}x bonusu: +{brand_boost_info.bonus_points} bal daxil)"

        return ReceiptSubmitResponse(
            success=True,
            receipt_id=approved_receipt.id,
            status=approved_receipt.status.value,
            is_flagged=False,
            is_rejected=False,
            rejection_reason=None,
            points_awarded=points_awarded,
            base_points=base_points,
            bonus_points=brand_bonus_points,
            brand_boost=brand_boost_info,
            ledger_transaction_id=tx.id,
            total_amount=total_amount,
            message=msg,
        )


@router.post("/{receipt_id}/approve", response_model=ReceiptApproveResponse)
async def approve_flagged_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin approval endpoint for releasing receipts from FLAGGED_REVIEW:
    - Validates receipt is in FLAGGED_REVIEW status.
    - Transitions receipt to APPROVED.
    - Posts the balanced double-entry earn transaction in the clearinghouse.
    - Mints loyalty points for the user.
    """
    receipt = await db.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found.")

    if receipt.status == ReceiptStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Receipt is already approved.")

    if receipt.status != ReceiptStatus.FLAGGED_REVIEW:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve receipt with status '{receipt.status.value}'. Only FLAGGED_REVIEW receipts can be released.",
        )

    # Resolve user
    user = await resolve_user(db, receipt.user_id)

    # Resolve merchant name
    merchant_name = "Merchant"
    if receipt.merchant_id:
        chain = await db.get(Chain, receipt.merchant_id)
        if chain:
            merchant_name = chain.name

    # Post earn transaction to ledger
    tx, points_awarded, merchant_debit, platform_fee = await record_earn_transaction(
        db=db,
        user_id=user.id,
        purchase_amount=receipt.total_amount,
        merchant_id=receipt.merchant_id,
        merchant_name=merchant_name,
        earn_rate=Decimal("0.03"),
        reference_id=f"RECEIPT-APPROVED-{receipt.id}",
        description=f"Admin released receipt: {receipt.receipt_number or str(receipt.id)[:8]}",
    )

    receipt.status = ReceiptStatus.APPROVED
    receipt.ledger_transaction_id = tx.id
    receipt.sebet_points_awarded = points_awarded
    receipt.processing_status = "PROCESSED"
    receipt.rejection_reason = f"Approved by admin (previously: {receipt.rejection_reason or 'FLAGGED'})"

    await db.commit()

    new_balance = await get_user_points_balance(db, user.id)

    return ReceiptApproveResponse(
        success=True,
        receipt_id=receipt.id,
        status=ReceiptStatus.APPROVED.value,
        points_awarded=points_awarded,
        ledger_transaction_id=tx.id,
        user_id=user.id,
        user_new_balance=new_balance,
        message=f"Qəbz moderator tərəfindən təsdiqləndi! +{points_awarded} bal təqdim edildi.",
    )


@router.post("/upload", response_model=ParsedReceiptOut)
async def upload_receipt(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    mock_sample_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Uploads a camera receipt image, runs OpenCV preprocessing, OCR parsing,
    canonical product matching, and awards SebEt points.
    """
    image_bytes = await file.read()

    # If a sample ID is passed or OCR extracts text
    extracted_text = ""
    if mock_sample_id:
        sample = next((s for s in SAMPLE_BAKU_RECEIPTS if s["id"] == mock_sample_id), None)
        if sample:
            extracted_text = sample["raw_text"]

    if not extracted_text:
        extracted_text = AzerbaijaniReceiptParser.extract_text_from_image(image_bytes)

    user_uuid = None
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            pass

    return await process_receipt_text_and_save(
        text=extracted_text,
        image_url=f"/uploads/receipts/{file.filename}",
        user_id=user_uuid,
        db=db,
        image_bytes=image_bytes,
    )


@router.get("/samples", response_model=List[SampleReceiptOut])
async def get_sample_receipts():
    """
    Returns preset Baku supermarket receipts for 1-click test in the UI.
    """
    return [
        SampleReceiptOut(
            id=s["id"],
            title=s["title"],
            store_name=s["store_name"],
            voen=s["voen"],
            obyekt_kodu=s["obyekt_kodu"],
            total_amount=s["total_amount"],
            raw_text=s["raw_text"],
        )
        for s in SAMPLE_BAKU_RECEIPTS
    ]


@router.post("/parse-sample/{sample_id}", response_model=ParsedReceiptOut)
async def parse_sample_receipt(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Instantly processes one of the preset Baku sample receipts.
    """
    sample = next((s for s in SAMPLE_BAKU_RECEIPTS if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail=f"Sample receipt '{sample_id}' not found.")

    return await process_receipt_text_and_save(
        text=sample["raw_text"],
        image_url=f"/samples/{sample_id}.jpg",
        user_id=None,
        db=db,
    )


@router.get("/{receipt_id}", response_model=ParsedReceiptOut)
async def get_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches receipt details and extracted items.
    """
    stmt = (
        select(Receipt)
        .options(
            selectinload(Receipt.matched_store).selectinload(Store.chain),
            selectinload(Receipt.items).selectinload(ReceiptItem.matched_product),
        )
        .where(Receipt.id == receipt_id)
    )
    res = await db.execute(stmt)
    receipt = res.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    items_out = []
    for it in receipt.items:
        items_out.append(
            ParsedLineItemOut(
                raw_name=it.raw_line_text,
                quantity=it.quantity,
                unit_price=it.unit_price,
                total_price=it.total_price,
                matched_product_id=it.matched_product_id,
                matched_product_name=it.matched_product.canonical_name if it.matched_product else None,
                confidence_score=it.confidence_score or 1.0,
            )
        )

    store = receipt.matched_store
    return ParsedReceiptOut(
        id=receipt.id,
        fiscal_id=receipt.fiscal_id,
        voen=receipt.voen,
        obyekt_kodu=receipt.obyekt_kodu,
        matched_store_id=receipt.matched_store_id,
        store_name=store.branch_name if store else "Baku Branch",
        chain_name=store.chain.name if store else "Supermarket",
        chain_color=store.chain.color if store else "#10B981",
        receipt_date=receipt.receipt_date,
        total_amount=float(receipt.total_amount) if receipt.total_amount is not None else None,
        items=items_out,
        processing_status=receipt.processing_status,
        sebet_points_awarded=receipt.sebet_points_awarded,
        raw_ocr_text=receipt.raw_ocr_text,
        message="Receipt loaded successfully",
    )
