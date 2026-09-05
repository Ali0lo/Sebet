from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Store, StorePrice, Product, Chain
from app.schemas.basket import BasketOptimizeIn, BasketOptimizeResponse
from app.services.basket_optimizer import BasketOptimizer

router = APIRouter(prefix="/basket", tags=["basket"])


@router.post("/optimize", response_model=BasketOptimizeResponse)
async def optimize_basket(
    payload: BasketOptimizeIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Computes single-store lowest cost vs dual-store walking split within radius.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Basket must contain at least one item.")

    product_ids = [item.product_id for item in payload.items]

    # Fetch canonical product details
    prod_stmt = select(Product).where(Product.id.in_(product_ids))
    prod_res = await db.execute(prod_stmt)
    products_by_id = {p.id: p for p in prod_res.scalars().all()}

    # Fetch all active stores with their latest prices for these products
    store_stmt = (
        select(Store)
        .where(Store.is_active.is_(True))
        .options(
            selectinload(Store.chain),
            selectinload(Store.prices),
        )
    )
    store_res = await db.execute(store_stmt)
    stores = store_res.scalars().all()

    # Structure inventory for optimizer
    stores_inventory = []
    for st in stores:
        # Build price map for relevant products
        prices_map = {}
        for sp in st.prices:
            if sp.product_id in products_by_id and sp.in_stock:
                effective_p = sp.promo_price if (sp.is_promo and sp.promo_price is not None) else sp.price
                prices_map[sp.product_id] = effective_p

        stores_inventory.append({
            "store_id": st.id,
            "branch_name": st.branch_name,
            "neighborhood": st.neighborhood,
            "chain_name": st.chain.name,
            "chain_slug": st.chain.slug,
            "chain_color": st.chain.color or "#10B981",
            "address": st.address,
            "lat": st.latitude,
            "lon": st.longitude,
            "prices": prices_map,
        })

    # Prepare basket item list with names
    basket_items_prepared = []
    for it in payload.items:
        prod = products_by_id.get(it.product_id)
        if prod:
            basket_items_prepared.append({
                "product_id": it.product_id,
                "canonical_name": prod.canonical_name,
                "brand": prod.brand,
                "quantity": it.quantity,
            })

    # Run optimizer algorithm
    optimization_res = BasketOptimizer.optimize(
        basket_items=basket_items_prepared,
        stores_inventory=stores_inventory,
        user_coords=(payload.latitude, payload.longitude),
        max_walking_distance_m=payload.max_walking_distance_m,
    )

    return BasketOptimizeResponse(**optimization_res)

