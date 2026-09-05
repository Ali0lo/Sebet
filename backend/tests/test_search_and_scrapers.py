import os
import sys
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./sebet.db"
os.environ["ENVIRONMENT"] = "testing"

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from app.main import app
from app.core.az_normalizer import fold_az_accents, matches_tokens
from app.services.scraper_service import SCRAPERS, run_all_scrapers


@pytest.mark.asyncio
async def test_flexible_azerbaijani_search():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. 'sud' must find 'Milla Süd'
        res1 = await ac.get("/api/v1/products/search?q=sud")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["total"] > 0
        names1 = [p["canonical_name"].lower() for p in data1["items"]]
        assert any("süd" in n or "sud" in n for n in names1)

        # 2. 'corek' must find 'Çörək'
        res2 = await ac.get("/api/v1/products/search?q=corek")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["total"] > 0
        names2 = [p["canonical_name"].lower() for p in data2["items"]]
        assert any("çörə" in n or "corek" in n for n in names2)

        # 3. 'kere yagi' must find 'Westgold' and 'Anchor'
        res3 = await ac.get("/api/v1/products/search?q=kere yagi")
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["total"] >= 2
        brands3 = [p["brand"].lower() for p in data3["items"]]
        assert "westgold" in brands3 or "anchor" in brands3

        # 4. Multi-word out of order: 'sud milla'
        res4 = await ac.get("/api/v1/products/search?q=sud milla")
        assert res4.status_code == 200
        data4 = res4.json()
        assert data4["total"] > 0
        assert any("milla" in p["brand"].lower() for p in data4["items"])


@pytest.mark.asyncio
async def test_all_seven_chains_present():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Check a standard SKU (Milla Süd) has prices in 7 chains
        res = await ac.get("/api/v1/products/4760083300124")
        assert res.status_code == 200
        data = res.json()
        chain_slugs = {p["chain_slug"] for p in data["prices"]}
        for required_chain in ["bravo", "araz", "oba", "bazarstore", "almarket", "neptun", "spar"]:
            assert required_chain in chain_slugs


@pytest.mark.asyncio
async def test_scraper_service_registry():
    assert len(SCRAPERS) == 7
    assert "neptun" in SCRAPERS
    assert "almarket" in SCRAPERS
    assert "spar" in SCRAPERS
    assert "bravo" in SCRAPERS


@pytest.mark.asyncio
async def test_nearby_stores_outside_baku():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Sumqayıt coordinates
        res = await ac.get("/api/v1/stores/nearby?latitude=40.5855&longitude=49.6317&radius_km=5")
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0
