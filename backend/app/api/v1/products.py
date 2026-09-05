from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Product, StorePrice, Store, Chain, Category
from app.schemas.product import ProductOut, ProductSearchResponse, StorePriceOut

router = APIRouter(prefix="/products", tags=["products"])


def format_store_price(sp: StorePrice) -> StorePriceOut:
    return StorePriceOut(
        store_id=sp.store_id,
        branch_name=sp.store.branch_name,
        neighborhood=sp.store.neighborhood,
        chain_name=sp.store.chain.name,
        chain_slug=sp.store.chain.slug,
        chain_color=sp.store.chain.color or "#10B981",
        price=sp.price,
        promo_price=sp.promo_price,
        is_promo=sp.is_promo,
        in_stock=sp.in_stock,
        source_type=sp.source_type,
        confidence_score=sp.confidence_score,
        recorded_at=sp.recorded_at,
    )


def format_product_out(product: Product) -> ProductOut:
    prices_out = [format_store_price(sp) for sp in product.prices if sp.in_stock]
    effective_prices = [
        (p.promo_price if p.is_promo and p.promo_price is not None else p.price)
        for p in prices_out
    ]
    min_p = min(effective_prices) if effective_prices else None
    max_p = max(effective_prices) if effective_prices else None

    return ProductOut(
        id=product.id,
        barcode=product.barcode,
        canonical_name=product.canonical_name,
        brand=product.brand,
        category_id=product.category_id,
        category_name=product.category.name_az if product.category else None,
        unit=product.unit,
        pack_size=product.pack_size,
        image_url=product.image_url,
        min_price=round(min_p, 2) if min_p is not None else None,
        max_price=round(max_p, 2) if max_p is not None else None,
        prices=prices_out,
    )


@router.get("/search", response_model=ProductSearchResponse)
async def search_products(
    q: Optional[str] = Query(None, description="Search query by name, brand or barcode"),
    category_id: Optional[UUID] = Query(None, description="Category filter"),
    chain_slug: Optional[str] = Query(None, description="Filter by retail chain"),
    sort_by: str = Query("popularity", description="Sort by: popularity, cheapest, name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Fuzzy text and category search for Baku grocery products.
    """
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.prices).selectinload(StorePrice.store).selectinload(Store.chain),
        )
    )

    if q:
        search_filter = or_(
            Product.canonical_name.ilike(f"%{q}%"),
            Product.brand.ilike(f"%{q}%"),
            Product.barcode.ilike(f"%{q}%"),
        )
        stmt = stmt.where(search_filter)

    if category_id:
        stmt = stmt.where(Product.category_id == category_id)

    # Count total
    count_stmt = select(func.count(Product.id))
    if q:
        count_stmt = count_stmt.where(search_filter)
    if category_id:
        count_stmt = count_stmt.where(Product.category_id == category_id)
    total_count_res = await db.execute(count_stmt)
    total = total_count_res.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await db.execute(stmt)
    products = result.scalars().all()

    items = [format_product_out(p) for p in products]

    if chain_slug:
        # Filter store prices inside product
        for item in items:
            item.prices = [p for p in item.prices if p.chain_slug == chain_slug]

    if sort_by == "cheapest":
        items.sort(key=lambda x: x.min_price or float("inf"))
    elif sort_by == "name":
        items.sort(key=lambda x: x.canonical_name.lower())

    return ProductSearchResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/top-deals", response_model=List[ProductOut])
async def get_top_deals(
    limit: int = Query(8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns top discounted grocery items across Baku supermarkets.
    """
    stmt = (
        select(Product)
        .join(StorePrice, StorePrice.product_id == Product.id)
        .where(StorePrice.is_promo.is_(True))
        .options(
            selectinload(Product.category),
            selectinload(Product.prices).selectinload(StorePrice.store).selectinload(Store.chain),
        )
        .distinct()
        .limit(limit)
    )
    result = await db.execute(stmt)
    products = result.scalars().all()
    return [format_product_out(p) for p in products]


@router.get("/{barcode_or_id}", response_model=ProductOut)
async def get_product_by_barcode_or_id(
    barcode_or_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Barcode lookup returning price comparison across all stores and chains.
    """
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.prices).selectinload(StorePrice.store).selectinload(Store.chain),
        )
    )

    # Check if UUID or Barcode
    try:
        uuid_obj = UUID(barcode_or_id)
        stmt = stmt.where(or_(Product.id == uuid_obj, Product.barcode == barcode_or_id))
    except ValueError:
        stmt = stmt.where(Product.barcode == barcode_or_id)

    result = await db.execute(stmt)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with barcode/id '{barcode_or_id}' was not found in SebEt catalog.",
        )

    return format_product_out(product)

