from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ParsedLineItemOut(BaseModel):
    raw_name: str
    quantity: float
    unit_price: float
    total_price: float
    matched_product_id: Optional[UUID] = None
    matched_product_name: Optional[str] = None
    confidence_score: float = 1.0


class ParsedReceiptOut(BaseModel):
    id: UUID
    fiscal_id: Optional[str] = None
    voen: Optional[str] = None
    obyekt_kodu: Optional[str] = None
    matched_store_id: Optional[UUID] = None
    store_name: Optional[str] = None
    chain_name: Optional[str] = None
    chain_color: Optional[str] = None
    receipt_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    items: List[ParsedLineItemOut] = []
    processing_status: str
    sebet_points_awarded: int
    raw_ocr_text: Optional[str] = None
    message: str = "Receipt processed successfully"

    model_config = ConfigDict(from_attributes=True)


class SampleReceiptOut(BaseModel):
    id: str
    title: str
    store_name: str
    voen: str
    obyekt_kodu: str
    total_amount: float
    raw_text: str


from app.schemas.retail_media import BrandBoostInfo


class ReceiptSubmitRequest(BaseModel):
    user_id: Optional[UUID] = None
    merchant_id: Optional[UUID] = None
    merchant_name: Optional[str] = None
    receipt_number: Optional[str] = None
    total_amount: Decimal = Field(..., gt=0)
    purchased_at: Optional[datetime] = None
    image_hash: Optional[str] = None
    image_base64: Optional[str] = None
    terminal_id: Optional[str] = None
    image_url: Optional[str] = None
    raw_ocr_text: Optional[str] = None
    earn_rate: Optional[Decimal] = Decimal("0.03")
    line_items: Optional[List[Dict[str, Any]]] = None


class ReceiptSubmitResponse(BaseModel):
    success: bool
    receipt_id: UUID
    status: str
    is_flagged: bool = False
    is_rejected: bool = False
    rejection_reason: Optional[str] = None
    points_awarded: int = 0
    base_points: Optional[int] = None
    bonus_points: Optional[int] = 0
    brand_boost: Optional[BrandBoostInfo] = None
    ledger_transaction_id: Optional[UUID] = None
    total_amount: Decimal
    message: str

    model_config = ConfigDict(from_attributes=True)


class ReceiptApproveResponse(BaseModel):
    success: bool
    receipt_id: UUID
    status: str
    points_awarded: int
    ledger_transaction_id: UUID
    user_id: UUID
    user_new_balance: int
    message: str

    model_config = ConfigDict(from_attributes=True)
