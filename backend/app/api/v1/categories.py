from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Category, Product
from app.schemas.store import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=List[CategoryOut])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """
    Returns category hierarchy with product counts.
    """
    stmt = (
        select(Category, func.count(Product.id).label("prod_count"))
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name_az)
    )
    res = await db.execute(stmt)
    rows = res.all()

    return [
        CategoryOut(
            id=cat.id,
            name_az=cat.name_az,
            name_en=cat.name_en,
            slug=cat.slug,
            icon_name=cat.icon_name,
            product_count=prod_count,
        )
        for cat, prod_count in rows
    ]

