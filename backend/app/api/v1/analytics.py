import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_merchant, verify_merchant_access, MerchantContext
from app.schemas.analytics import (
    MerchantSummaryMetricsOut,
    MerchantBenchmarkOut,
    MerchantCoreMetrics,
    RawTransactionOut,
)
from app.services.analytics_service import (
    get_merchant_summary_metrics,
    get_category_benchmark_metrics,
    get_cross_shopping_affinities,
    get_merchant_raw_transactions,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/merchant/me/summary", response_model=MerchantSummaryMetricsOut)
async def get_my_summary(
    current_merchant: MerchantContext = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated merchant's own business performance metrics:
    - Total revenue captured via app
    - Total points issued
    - Unique customer count
    - Average basket size
    - 30-day repeat customer rate
    """
    return await get_merchant_summary_metrics(db, current_merchant.merchant_id)


@router.get("/merchant/me/benchmark", response_model=MerchantBenchmarkOut)
async def get_my_benchmark(
    current_merchant: MerchantContext = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated merchant's performance metrics side-by-side with
    the k-anonymized category benchmark (enforcing K_ANONYMITY_THRESHOLD = 5).
    If category density < 5, benchmark is suppressed with benchmark_available: false.
    Includes top-3 cross-shopping category affinities (anonymized category names only).
    """
    # 1. Fetch merchant summary
    summary = await get_merchant_summary_metrics(db, current_merchant.merchant_id)

    # 2. Fetch category benchmark with k-anonymity guarantee
    available, benchmark, msg, count = await get_category_benchmark_metrics(
        db, current_merchant.category
    )

    # 3. Fetch cross-shopping affinities (only high-level categories)
    affinities = await get_cross_shopping_affinities(
        db, current_merchant.merchant_id, current_merchant.category, top_n=3
    )

    merchant_core = MerchantCoreMetrics(
        average_basket_size=summary.average_basket_size,
        average_points_earned_per_transaction=summary.average_points_earned_per_transaction,
        repeat_customer_rate=summary.repeat_customer_rate,
    )

    return MerchantBenchmarkOut(
        merchant_id=current_merchant.merchant_id,
        merchant_name=current_merchant.name,
        category=current_merchant.category,
        benchmark_available=available,
        message=msg,
        merchant_metrics=merchant_core,
        category_benchmark=benchmark,
        cross_shopping_affinities=affinities,
    )


@router.get("/merchant/transactions", response_model=List[RawTransactionOut])
async def get_merchant_transactions_query(
    merchant_id: Optional[uuid.UUID] = Query(None),
    current_merchant: MerchantContext = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves raw transactions for a merchant.
    Strict tenant isolation:
    If a merchant provides a target merchant_id in query parameters that doesn't match
    their authenticated ID, and is not an admin, returns HTTP 403 Forbidden.
    """
    target_id = await verify_merchant_access(merchant_id=merchant_id, current_merchant=current_merchant)
    return await get_merchant_raw_transactions(db, target_id)


@router.get("/merchant/{merchant_id}/transactions", response_model=List[RawTransactionOut])
async def get_merchant_transactions_path(
    merchant_id: uuid.UUID,
    current_merchant: MerchantContext = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves raw transactions for a merchant via path parameter.
    Strict tenant isolation:
    Prevent path tampering; accessing another merchant's transactions returns HTTP 403 Forbidden.
    """
    target_id = await verify_merchant_access(merchant_id=merchant_id, current_merchant=current_merchant)
    return await get_merchant_raw_transactions(db, target_id)
