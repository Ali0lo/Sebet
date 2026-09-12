import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt, ReceiptStatus
from app.models.chain import Chain
from app.schemas.analytics import (
    MerchantSummaryMetricsOut,
    MerchantCoreMetrics,
    CategoryBenchmarkMetricsOut,
    CrossShoppingAffinityOut,
    MerchantBenchmarkOut,
    RawTransactionOut,
)

# Strict k-anonymity privacy threshold
K_ANONYMITY_THRESHOLD = 5


async def get_merchant_summary_metrics(
    db: AsyncSession,
    merchant_id: uuid.UUID,
) -> MerchantSummaryMetricsOut:
    """
    Computes a merchant's private summary metrics:
    - Total revenue captured via app
    - Total points issued
    - Unique customer count
    - Total transactions
    - Average basket size
    - Average points earned per transaction
    - 30-day repeat customer rate (users with >= 2 visits in the last 30 days)
    """
    chain = await db.get(Chain, merchant_id)
    merchant_name = chain.name if chain else "Merchant"
    merchant_category = getattr(chain, "category", "Grocery") or "Grocery"

    # All approved receipts for this merchant
    stmt = select(
        func.coalesce(func.sum(Receipt.total_amount), Decimal("0.0000")),
        func.coalesce(func.sum(Receipt.sebet_points_awarded), 0),
        func.count(Receipt.id),
        func.count(distinct(Receipt.user_id)),
    ).where(
        Receipt.merchant_id == merchant_id,
        Receipt.status == ReceiptStatus.APPROVED,
    )
    result = (await db.execute(stmt)).first()

    total_revenue = Decimal(str(result[0] or "0.0000")).quantize(Decimal("0.0001"))
    total_points = int(result[1] or 0)
    total_tx = int(result[2] or 0)
    unique_customers = int(result[3] or 0)

    avg_basket = (
        (total_revenue / Decimal(str(total_tx))).quantize(Decimal("0.0001"))
        if total_tx > 0
        else Decimal("0.0000")
    )
    avg_points = (
        round(float(total_points) / total_tx, 2)
        if total_tx > 0
        else 0.0
    )

    # 30-day repeat customer rate
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)
    repeat_stmt = (
        select(Receipt.user_id, func.count(Receipt.id))
        .where(
            Receipt.merchant_id == merchant_id,
            Receipt.status == ReceiptStatus.APPROVED,
            Receipt.user_id.is_not(None),
            Receipt.created_at >= cutoff_30d,
        )
        .group_by(Receipt.user_id)
    )
    user_tx_counts = (await db.execute(repeat_stmt)).all()
    total_30d_users = len(user_tx_counts)
    repeat_users = sum(1 for row in user_tx_counts if row[1] >= 2)

    repeat_rate = (
        round((repeat_users / total_30d_users) * 100.0, 1)
        if total_30d_users > 0
        else 0.0
    )

    return MerchantSummaryMetricsOut(
        merchant_id=merchant_id,
        merchant_name=merchant_name,
        category=merchant_category,
        total_revenue=total_revenue,
        total_points_issued=total_points,
        unique_customer_count=unique_customers,
        total_transactions=total_tx,
        average_basket_size=avg_basket,
        average_points_earned_per_transaction=avg_points,
        repeat_customer_rate=repeat_rate,
    )


async def get_category_benchmark_metrics(
    db: AsyncSession,
    category: str,
) -> Tuple[bool, Optional[CategoryBenchmarkMetricsOut], str, int]:
    """
    Computes k-anonymized category benchmark metrics.
    Enforces K_ANONYMITY_THRESHOLD = 5:
    If fewer than 5 distinct participating merchants exist in the category,
    the benchmark is suppressed to prevent competitive reverse-engineering.
    """
    # 1. Count distinct active participating merchants in this category with approved activity
    active_merchants_stmt = (
        select(func.count(distinct(Receipt.merchant_id)))
        .join(Chain, Chain.id == Receipt.merchant_id)
        .where(
            Chain.category == category,
            Chain.is_active == True,
            Receipt.status == ReceiptStatus.APPROVED,
        )
    )
    distinct_count = (await db.execute(active_merchants_stmt)).scalar() or 0

    # Strict k-anonymity check
    if distinct_count < K_ANONYMITY_THRESHOLD:
        return (
            False,
            None,
            "Insufficient category density to generate benchmark without compromising merchant privacy.",
            distinct_count,
        )

    # 2. Compute category-level aggregates across all participating merchants
    cat_summary_stmt = (
        select(
            func.coalesce(func.sum(Receipt.total_amount), Decimal("0.0000")),
            func.coalesce(func.sum(Receipt.sebet_points_awarded), 0),
            func.count(Receipt.id),
        )
        .join(Chain, Chain.id == Receipt.merchant_id)
        .where(
            Chain.category == category,
            Chain.is_active == True,
            Receipt.status == ReceiptStatus.APPROVED,
        )
    )
    cat_res = (await db.execute(cat_summary_stmt)).first()
    cat_total_rev = Decimal(str(cat_res[0] or "0.0000"))
    cat_total_pts = int(cat_res[1] or 0)
    cat_total_tx = int(cat_res[2] or 0)

    cat_avg_basket = (
        (cat_total_rev / Decimal(str(cat_total_tx))).quantize(Decimal("0.0001"))
        if cat_total_tx > 0
        else Decimal("0.0000")
    )
    cat_avg_points = (
        round(float(cat_total_pts) / cat_total_tx, 2)
        if cat_total_tx > 0
        else 0.0
    )

    # Category repeat rate in the last 30 days
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)
    cat_repeat_stmt = (
        select(Receipt.user_id, func.count(Receipt.id))
        .join(Chain, Chain.id == Receipt.merchant_id)
        .where(
            Chain.category == category,
            Chain.is_active == True,
            Receipt.status == ReceiptStatus.APPROVED,
            Receipt.user_id.is_not(None),
            Receipt.created_at >= cutoff_30d,
        )
        .group_by(Receipt.user_id)
    )
    user_counts = (await db.execute(cat_repeat_stmt)).all()
    total_users_30d = len(user_counts)
    repeat_users_30d = sum(1 for r in user_counts if r[1] >= 2)
    cat_repeat_rate = (
        round((repeat_users_30d / total_users_30d) * 100.0, 1)
        if total_users_30d > 0
        else 0.0
    )

    benchmark = CategoryBenchmarkMetricsOut(
        category=category,
        k_anonymity_threshold=K_ANONYMITY_THRESHOLD,
        participating_merchants_count=distinct_count,
        average_basket_size=cat_avg_basket,
        average_points_earned_per_transaction=cat_avg_points,
        repeat_customer_rate=cat_repeat_rate,
    )

    return (True, benchmark, "Category benchmark successfully generated.", distinct_count)


async def get_cross_shopping_affinities(
    db: AsyncSession,
    merchant_id: uuid.UUID,
    merchant_category: str,
    top_n: int = 3,
) -> List[CrossShoppingAffinityOut]:
    """
    Computes top-N cross-shopping affinities:
    Percentage of this merchant's customers who also shopped at merchants in OTHER categories.
    Under NO circumstances are rival chain IDs, store names, or competitor records exposed.
    """
    # 1. Fetch distinct users who shopped at this merchant
    user_stmt = select(distinct(Receipt.user_id)).where(
        Receipt.merchant_id == merchant_id,
        Receipt.status == ReceiptStatus.APPROVED,
        Receipt.user_id.is_not(None),
    )
    user_rows = (await db.execute(user_stmt)).scalars().all()
    user_ids = [u for u in user_rows if u is not None]
    total_customers = len(user_ids)

    if total_customers == 0:
        return []

    # 2. Query other categories visited by these customers
    aff_stmt = (
        select(Chain.category, func.count(distinct(Receipt.user_id)))
        .join(Chain, Chain.id == Receipt.merchant_id)
        .where(
            Receipt.user_id.in_(user_ids),
            Receipt.status == ReceiptStatus.APPROVED,
            Chain.category != merchant_category,
            Chain.category.is_not(None),
        )
        .group_by(Chain.category)
    )
    aff_rows = (await db.execute(aff_stmt)).all()

    affinities = []
    for cat_name, overlap_count in aff_rows:
        if not cat_name:
            continue
        pct = round((overlap_count / total_customers) * 100.0, 1)
        affinities.append(
            CrossShoppingAffinityOut(
                category=cat_name,
                affinity_percentage=pct,
                description=f"{pct}% of your customers also visited {cat_name} merchants",
            )
        )

    # Sort descending by affinity percentage and take top_n
    affinities.sort(key=lambda a: a.affinity_percentage, reverse=True)
    return affinities[:top_n]


async def get_merchant_raw_transactions(
    db: AsyncSession,
    merchant_id: uuid.UUID,
    limit: int = 50,
) -> List[RawTransactionOut]:
    """
    Retrieves raw transactions strictly scoped to a single merchant tenant.
    """
    stmt = (
        select(Receipt)
        .where(Receipt.merchant_id == merchant_id)
        .order_by(Receipt.purchased_at.desc())
        .limit(limit)
    )
    receipts = (await db.execute(stmt)).scalars().all()

    return [
        RawTransactionOut(
            id=r.id,
            receipt_number=r.receipt_number,
            total_amount=r.total_amount,
            purchased_at=r.purchased_at,
            sebet_points_awarded=r.sebet_points_awarded,
            status=r.status.value,
            merchant_id=r.merchant_id,
        )
        for r in receipts
    ]
