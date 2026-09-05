from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


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

