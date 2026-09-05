import os
import sys
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport

# Set database to local seeded sqlite before importing app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./sebet.db"
os.environ["ENVIRONMENT"] = "testing"

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "Baku" in data["city"]


@pytest.mark.asyncio
async def test_product_search_and_barcode():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Search for Milla
        res = await ac.get("/api/v1/products/search?q=Milla")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] > 0
        first_item = data["items"][0]
        assert "milla" in first_item["canonical_name"].lower()
        assert len(first_item["prices"]) > 0

        # Barcode lookup
        barcode = "4760083300124"
        res_bc = await ac.get(f"/api/v1/products/{barcode}")
        assert res_bc.status_code == 200
        bc_data = res_bc.json()
        assert bc_data["barcode"] == barcode
        assert bc_data["min_price"] is not None
        assert len(bc_data["prices"]) >= 4  # Bravo, Araz, OBA, Bazarstore


@pytest.mark.asyncio
async def test_basket_optimizer_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Fetch 3 product IDs
        search_res = await ac.get("/api/v1/products/search?page_size=5")
        products = search_res.json()["items"]
        assert len(products) >= 3

        items = [
            {"product_id": products[0]["id"], "quantity": 2.0},
            {"product_id": products[1]["id"], "quantity": 1.0},
            {"product_id": products[2]["id"], "quantity": 1.0},
        ]

        payload = {
            "items": items,
            "latitude": 40.3798,
            "longitude": 49.8475,  # 28 May coordinates
            "max_walking_distance_m": 600.0,
        }

        opt_res = await ac.post("/api/v1/basket/optimize", json=payload)
        assert opt_res.status_code == 200
        opt_data = opt_res.json()
        assert opt_data["basket_count"] == 3
        assert opt_data["best_single_store"] is not None
        assert opt_data["best_single_store"]["total_cost"] > 0


@pytest.mark.asyncio
async def test_sample_receipt_ocr_and_points():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get samples list
        samples_res = await ac.get("/api/v1/receipts/samples")
        assert samples_res.status_code == 200
        samples = samples_res.json()
        assert len(samples) >= 3

        # Parse Bravo sample receipt
        parse_res = await ac.post("/api/v1/receipts/parse-sample/sample-bravo-28mall")
        assert parse_res.status_code == 200
        receipt = parse_res.json()
        assert receipt["voen"] == "1401564751"
        assert receipt["obyekt_kodu"] == "0101"
        assert receipt["sebet_points_awarded"] == 50
        assert len(receipt["items"]) >= 5


@pytest.mark.asyncio
async def test_flyers_and_user_rewards():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Active flyers
        flyers_res = await ac.get("/api/v1/flyers/active")
        assert flyers_res.status_code == 200
        flyers = flyers_res.json()
        assert len(flyers) >= 4

        # User profile
        user_res = await ac.get("/api/v1/users/me")
        assert user_res.status_code == 200
        user = user_res.json()
        assert user["sebet_points"] >= 50

