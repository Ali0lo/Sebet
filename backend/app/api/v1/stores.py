from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from geopy.distance import geodesic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Store, Chain
from app.schemas.store import StoreOut

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("/nearby", response_model=List[StoreOut])
async def get_nearby_stores(
    latitude: float = Query(40.3798, description="User latitude"),
    longitude: float = Query(49.8475, description="User longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: AsyncSession = Depends(get_db),
):
    """
    Locates supermarket branches in Baku within a specified radius.
    """
    stmt = (
        select(Store)
        .where(Store.is_active.is_(True))
        .options(selectinload(Store.chain))
    )
    res = await db.execute(stmt)
    stores = res.scalars().all()

    user_coords = (latitude, longitude)
    nearby = []

    for st in stores:
        dist = geodesic(user_coords, (st.latitude, st.longitude)).km
        if dist <= radius_km:
            nearby.append(
                StoreOut(
                    id=st.id,
                    branch_name=st.branch_name,
                    neighborhood=st.neighborhood,
                    chain_name=st.chain.name,
                    chain_slug=st.chain.slug,
                    chain_color=st.chain.color or "#10B981",
                    voen=st.voen,
                    obyekt_kodu=st.obyekt_kodu,
                    address=st.address,
                    latitude=st.latitude,
                    longitude=st.longitude,
                    distance_km=round(dist, 2),
                )
            )

    nearby.sort(key=lambda s: s.distance_km or float("inf"))
    return nearby

