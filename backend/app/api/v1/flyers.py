from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Flyer, FlyerItem, Chain
from app.schemas.flyer import FlyerOut, FlyerItemOut

router = APIRouter(prefix="/flyers", tags=["flyers"])


@router.get("/active", response_model=List[FlyerOut])
async def get_active_flyers(db: AsyncSession = Depends(get_db)):
    """
    Lists all active weekly promotional flyers from Araz, OBA, Bravo, and Bazarstore.
    """
    stmt = (
        select(Flyer)
        .options(
            selectinload(Flyer.chain),
            selectinload(Flyer.items),
        )
        .order_by(Flyer.created_at.desc())
    )
    res = await db.execute(stmt)
    flyers = res.scalars().all()

    out = []
    for fl in flyers:
        items_out = [
            FlyerItemOut(
                id=it.id,
                product_id=it.product_id,
                title=it.title,
                discount_price=it.discount_price,
                original_price=it.original_price,
                discount_percent=it.discount_percent,
                image_url=it.image_url,
                badge_text=it.badge_text,
            )
            for it in fl.items
        ]
        out.append(
            FlyerOut(
                id=fl.id,
                chain_name=fl.chain.name,
                chain_slug=fl.chain.slug,
                chain_color=fl.chain.color or "#10B981",
                title=fl.title,
                start_date=fl.start_date,
                end_date=fl.end_date,
                pdf_url=fl.pdf_url,
                cover_image_url=fl.cover_image_url,
                items=items_out,
            )
        )
    return out

