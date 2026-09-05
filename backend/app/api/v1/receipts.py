import uuid
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Receipt, ReceiptItem, Store, Product, StorePrice, User
from app.schemas.receipt import ParsedReceiptOut, ParsedLineItemOut, SampleReceiptOut
from app.services.ocr_service import (
    AzerbaijaniReceiptParser,
    SAMPLE_BAKU_RECEIPTS,
)

router = APIRouter(prefix="/receipts", tags=["receipts"])


async def process_receipt_text_and_save(
    text: str,
    image_url: str,
    user_id: Optional[uuid.UUID],
    db: AsyncSession,
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
    points_to_award = 50

    receipt_obj = Receipt(
        user_id=user_id,
        image_url=image_url,
        fiscal_id=parsed.fiscal_id,
        voen=parsed.voen,
        obyekt_kodu=parsed.obyekt_kodu,
        matched_store_id=matched_store.id if matched_store else None,
        receipt_date=parsed.receipt_date or now,
        total_amount=parsed.total_amount,
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
        receipt_date=parsed.receipt_date or now,
        total_amount=parsed.total_amount,
        items=line_items_out,
        processing_status="PROCESSED",
        sebet_points_awarded=points_to_award,
        raw_ocr_text=parsed.raw_text,
        message=f"Receipt verified! +{points_to_award} SebEt Points awarded!",
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
        total_amount=receipt.total_amount,
        items=items_out,
        processing_status=receipt.processing_status,
        sebet_points_awarded=receipt.sebet_points_awarded,
        raw_ocr_text=receipt.raw_ocr_text,
        message="Receipt loaded successfully",
    )

