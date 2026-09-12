import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.ledger import AccountCategory, TransactionType, TransactionStatus, EntryDirection


class EarnRequest(BaseModel):
    user_id: Optional[uuid.UUID] = None
    merchant_id: Optional[uuid.UUID] = None
    merchant_name: Optional[str] = "Merchant A"
    purchase_amount: Decimal = Field(default=Decimal("50.00"), gt=0, description="Purchase total in dollars")
    earn_rate: Decimal = Field(default=Decimal("0.03"), gt=0, description="Earn percentage, e.g. 0.03 for 3%")
    platform_fee: Optional[Decimal] = Field(default=Decimal("0.30"), ge=0, description="Fixed platform fee in dollars")
    reference_id: Optional[str] = None
    description: Optional[str] = None


class EarnResponse(BaseModel):
    success: bool = True
    transaction_id: uuid.UUID
    purchase_amount: Decimal
    points_awarded: int
    points_value_usd: Decimal
    merchant_debit_amount: Decimal
    platform_clearing_fee: Decimal
    user_new_points_balance: int
    message: str


class RedeemRequest(BaseModel):
    user_id: Optional[uuid.UUID] = None
    merchant_id: Optional[uuid.UUID] = None
    merchant_name: Optional[str] = "Merchant B"
    points_to_redeem: int = Field(default=150, gt=0, description="Number of points to redeem")
    servicing_fee_rate: Decimal = Field(default=Decimal("0.05"), ge=0, description="Platform servicing fee, e.g. 0.05 for 5%")
    reference_id: Optional[str] = None
    description: Optional[str] = None


class RedeemResponse(BaseModel):
    success: bool = True
    transaction_id: uuid.UUID
    voucher_code: str
    points_redeemed: int
    points_value_usd: Decimal
    merchant_reimbursement_net: Decimal
    platform_servicing_fee: Decimal
    user_remaining_points: int
    message: str


class LedgerEntryOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    account_code: str
    account_name: str
    account_category: AccountCategory
    direction: EntryDirection
    amount: Decimal
    points_amount: Optional[int] = None
    description: Optional[str] = None
    created_at: datetime


class LedgerTransactionOut(BaseModel):
    id: uuid.UUID
    transaction_type: TransactionType
    reference_id: Optional[str] = None
    description: str
    status: TransactionStatus
    posted_at: datetime
    total_amount: Decimal
    entries: List[LedgerEntryOut]


class LedgerAccountBalanceOut(BaseModel):
    account_id: uuid.UUID
    account_code: str
    name: str
    category: AccountCategory
    currency: str
    balance_amount: Decimal
    points_balance: Optional[int] = None


class LedgerAuditReport(BaseModel):
    is_balanced: bool
    total_debits: Decimal
    total_credits: Decimal
    net_discrepancy: Decimal
    total_transactions_count: int
    total_points_in_circulation: int
    total_points_liability_usd: Decimal
    total_merchant_receivables_usd: Decimal
    total_merchant_payables_usd: Decimal
    total_platform_clearing_revenue_usd: Decimal
    total_platform_redemption_revenue_usd: Decimal
    total_platform_revenue_usd: Decimal
    unbalanced_transactions: List[uuid.UUID]

