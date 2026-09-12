import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CreateVoucherRequest(BaseModel):
    user_id: Optional[uuid.UUID] = None
    merchant_id: uuid.UUID
    points_amount: int = Field(..., gt=0, description="Loyalty points to burn (100 pts = $1.00 USD)")


class CreateVoucherResponse(BaseModel):
    voucher_code: str
    user_id: uuid.UUID
    merchant_id: uuid.UUID
    merchant_name: str
    points_amount: int
    usd_value: Decimal
    expires_at: datetime
    signature: str
    message: str

    model_config = ConfigDict(from_attributes=True)


class ClaimVoucherRequest(BaseModel):
    voucher_code: str
    cashier_notes: Optional[str] = None


class ClaimVoucherResponse(BaseModel):
    success: bool
    voucher_code: str
    merchant_id: uuid.UUID
    merchant_name: str
    points_redeemed: int
    gross_discount_usd: Decimal
    platform_servicing_fee_usd: Decimal
    merchant_net_reimbursement_usd: Decimal
    ledger_transaction_id: uuid.UUID
    user_remaining_points: int
    claimed_at: datetime
    message: str

    model_config = ConfigDict(from_attributes=True)


class VoucherStatusResponse(BaseModel):
    voucher_code: str
    status: str
    points_amount: int
    usd_value: Decimal
    merchant_id: uuid.UUID
    merchant_name: str
    expires_at: datetime
    claimed_at: Optional[datetime] = None
    is_expired: bool = False
    ledger_transaction_id: Optional[uuid.UUID] = None
    message: str

    model_config = ConfigDict(from_attributes=True)


class VoucherPreviewResponse(BaseModel):
    voucher_code: str
    points_amount: int
    gross_discount_usd: Decimal
    platform_servicing_fee_usd: Decimal
    merchant_net_reimbursement_usd: Decimal
    status: str
    is_valid: bool
    expires_at: datetime
    merchant_id: uuid.UUID
    merchant_name: str
    is_merchant_match: bool
    user_name: str

    model_config = ConfigDict(from_attributes=True)
