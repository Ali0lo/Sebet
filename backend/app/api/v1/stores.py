import uuid
import logging
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, Query
from geopy.distance import geodesic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Store, Chain
from app.schemas.store import StoreOut

logger = logging.getLogger("sebet.stores")
router = APIRouter(prefix="/stores", tags=["stores"])


def detect_chain_info(name: str):
    n = name.lower()
    if "bravo" in n:
        return "Bravo", "bravo", "#74b826"
    if "araz" in n:
        return "Araz", "araz", "#E30613"
    if "oba" in n:
        return "OBA", "oba", "#009640"
    if "bazarstore" in n:
        return "Bazarstore", "bazarstore", "#D01026"
    if "al market" in n or "almarket" in n:
        return "Al Market", "almarket", "#00539B"
    if "neptun" in n:
        return "Neptun", "neptun", "#008CD2"
    if "spar" in n:
        return "Spar", "spar", "#007A3D"
    return name, "supermarket", "#10B981"


@router.get("/nearby", response_model=List[StoreOut])
async def get_nearby_stores(
    latitude: float = Query(40.3798, description="User latitude"),
    longitude: float = Query(49.8475, description="User longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: AsyncSession = Depends(get_db),
):
    """
    Locates supermarket branches within a specified radius.
    If local database has fewer than 3 stores nearby, queries OpenStreetMap / global database dynamically.
    """
    stmt = (
        select(Store)
        .where(Store.is_active.is_(True))
        .options(selectinload(Store.chain))
    )
    res = await db.execute(stmt)
    stores = res.scalars().all()

    user_coords = (latitude, longitude)
    nearby: List[StoreOut] = []

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

    # If user is outside central Baku or near a location with few seeded stores, query OpenStreetMap Overpass
    if len(nearby) < 3:
        try:
            radius_m = min(int(radius_km * 1000), 10000)
            overpass_q = f"""
            [out:json][timeout:3];
            (
              node["shop"~"supermarket|convenience"](around:{radius_m},{latitude},{longitude});
              way["shop"~"supermarket|convenience"](around:{radius_m},{latitude},{longitude});
            );
            out center 15;
            """
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(
                    "https://overpass-api.de/api/interpreter",
                    data=overpass_q,
                    headers={"User-Agent": "SebEtBakuGroceryPriceIntelligence/1.0"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    for el in elements:
                        lat = el.get("lat") or el.get("center", {}).get("lat")
                        lon = el.get("lon") or el.get("center", {}).get("lon")
                        if not lat or not lon:
                            continue

                        tags = el.get("tags", {})
                        raw_name = tags.get("name") or tags.get("brand") or tags.get("operator") or "Yaxın Ərzaq Marketi"
                        chain_name, chain_slug, chain_color = detect_chain_info(raw_name)
                        address = tags.get("addr:street", "") or tags.get("addr:city", "") or "Ərazi üzrə filial"

                        dist = geodesic(user_coords, (lat, lon)).km
                        # Avoid duplicates
                        if any(abs(n.latitude - lat) < 0.001 and abs(n.longitude - lon) < 0.001 for n in nearby):
                            continue

                        nearby.append(
                            StoreOut(
                                id=uuid.uuid4(),
                                branch_name=raw_name,
                                neighborhood=tags.get("addr:suburb") or "Məkan Ətrafı",
                                chain_name=chain_name,
                                chain_slug=chain_slug,
                                chain_color=chain_color,
                                voen=None,
                                obyekt_kodu=None,
                                address=address,
                                latitude=lat,
                                longitude=lon,
                                distance_km=round(dist, 2),
                            )
                        )
        except Exception as e:
            logger.warning(f"Overpass dynamic nearby query skipped: {e}")

    nearby.sort(key=lambda s: s.distance_km or float("inf"))
    return nearby

