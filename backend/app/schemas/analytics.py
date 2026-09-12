from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MerchantCoreMetrics(BaseModel):
    average_basket_size: Decimal
    average_points_earned_per_transaction: float
    repeat_customer_rate: float

    model_config = ConfigDict(from_attributes=True)


class MerchantSummaryMetricsOut(BaseModel):
    merchant_id: UUID
    merchant_name: str
    category: str
    total_revenue: Decimal
    total_points_issued: int
    unique_customer_count: int
    total_transactions: int
    average_basket_size: Decimal
    average_points_earned_per_transaction: float
    repeat_customer_rate: float

    model_config = ConfigDict(from_attributes=True)


class CategoryBenchmarkMetricsOut(BaseModel):
    category: str
    k_anonymity_threshold: int = 5
    participating_merchants_count: int
    average_basket_size: Decimal
    average_points_earned_per_transaction: float
    repeat_customer_rate: float

    model_config = ConfigDict(from_attributes=True)


class CrossShoppingAffinityOut(BaseModel):
    category: str
    affinity_percentage: float
    description: str

    model_config = ConfigDict(from_attributes=True)


class MerchantBenchmarkOut(BaseModel):
    merchant_id: UUID
    merchant_name: str
    category: str
    benchmark_available: bool
    message: str
    merchant_metrics: MerchantCoreMetrics
    category_benchmark: Optional[CategoryBenchmarkMetricsOut] = None
    cross_shopping_affinities: List[CrossShoppingAffinityOut] = []

    model_config = ConfigDict(from_attributes=True)


class RawTransactionOut(BaseModel):
    id: UUID
    receipt_number: Optional[str] = None
    total_amount: Decimal
    purchased_at: datetime
    sebet_points_awarded: int
    status: str
    merchant_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)
