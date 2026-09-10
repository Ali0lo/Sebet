import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.models import Product
from app.core.az_normalizer import fold_az_accents, matches_tokens

logger = logging.getLogger("sebet.recommendations")
router = APIRouter(prefix="/search", tags=["search"])

TRENDING_QUERIES = [
    "Milla Süd",
    "Westgold Kərə Yağı",
    "Ariel Dağ Təravəti",
    "Bizim Süfrə Qatıq",
    "Anchor Kərə Yağı",
    "Azərçay Buket",
    "Fairy Limon",
    "Final Günəbaxan Yağı",
    "Milla Qatıq",
    "Milla Xama",
]

POPULAR_CATEGORIES = [
    {"name": "Süd Məhsulları", "icon": "🥛", "slug": "dairy-eggs"},
    {"name": "Ət & Toyuq", "icon": "🥩", "slug": "meat-poultry"},
    {"name": "Çörək & Un Məmulatları", "icon": "🥖", "slug": "bakery"},
    {"name": "Meyvə & Tərəvəz", "icon": "🍎", "slug": "fruit-veg"},
    {"name": "Əsas Ərzaqlar", "icon": "🥫", "slug": "pantry-cooking"},
    {"name": "Çay & Qəhvə", "icon": "☕", "slug": "tea-coffee"},
    {"name": "Şirniyyat & Qəlyanaltı", "icon": "🍫", "slug": "snacks-sweets"},
    {"name": "İçkilər & Su", "icon": "🧃", "slug": "drinks-water"},
    {"name": "Yuyucu & Təmizlik", "icon": "🧼", "slug": "cleaning-household"},
    {"name": "Şəxsi Qulluq & Gigiyena", "icon": "🧴", "slug": "personal-care-baby"},
]


async def fetch_openai_recommendations(query: str) -> List[str]:
    """
    Calls OpenAI Chat Completions API with a short timeout to generate
    context-aware search terms for Baku supermarkets.
    """
    if not settings.OPENAI_API_KEY:
        return []

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            }
            body = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a search assistant for 'Sebet', a Baku, Azerbaijan grocery price intelligence app. "
                            "Given a partial grocery search query, suggest 4 to 6 relevant supermarket product search terms, "
                            "popular brands, or autocomplete suggestions common in Baku supermarkets (e.g. Bravo, Araz, OBA). "
                            "Respond ONLY with a JSON array of strings, for example: [\"term1\", \"term2\"]."
                        ),
                    },
                    {"role": "user", "content": f"Query: {query}"},
                ],
                "temperature": 0.3,
                "max_tokens": 120,
            }
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=body,
            )
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                if content.startswith("```"):
                    content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                suggestions = json.loads(content)
                if isinstance(suggestions, list):
                    return [str(s) for s in suggestions if s]
    except Exception as e:
        logger.warning(f"OpenAI recommendation call failed/timed out: {e}")

    return []


@router.get("/recommendations")
async def get_search_recommendations(
    q: Optional[str] = Query(None, description="Current search term or prefix"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns AI-assisted and trending grocery search recommendations.
    Uses OpenAI if configured, with instant fallback to catalog matching and curated trends.
    """
    clean_q = q.strip() if q else ""
    suggestions: List[str] = []
    source = "curated_fallback"

    if clean_q:
        if settings.OPENAI_API_KEY:
            ai_suggestions = await fetch_openai_recommendations(clean_q)
            if ai_suggestions:
                suggestions = ai_suggestions
                source = "openai"

        if not suggestions:
            folded_q = fold_az_accents(clean_q.lower())
            for t in TRENDING_QUERIES:
                if folded_q in fold_az_accents(t.lower()) and t not in suggestions:
                    suggestions.append(t)

            stmt = select(Product.canonical_name).limit(40)
            res = await db.execute(stmt)
            names = res.scalars().all()
            for name in names:
                if matches_tokens(clean_q, name) and name not in suggestions:
                    suggestions.append(name)
                if len(suggestions) >= 6:
                    break

    return {
        "query": clean_q,
        "source": source,
        "suggestions": suggestions[:6],
        "trending": TRENDING_QUERIES,
        "categories": POPULAR_CATEGORIES,
    }

