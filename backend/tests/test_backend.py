import pytest
from app.services.basket_optimizer import BasketOptimizer
from app.services.ocr_service import AzerbaijaniReceiptParser, SAMPLE_BAKU_RECEIPTS


def test_receipt_metadata_extraction():
    sample = SAMPLE_BAKU_RECEIPTS[0]
    meta = AzerbaijaniReceiptParser.extract_fiscal_metadata(sample["raw_text"])

    assert meta["voen"] == "1401564751"
    assert meta["obyekt_kodu"] == "0101"
    assert meta["total_amount"] == 33.34
    assert meta["fiscal_id"] is not None


def test_receipt_line_items_parsing():
    sample = SAMPLE_BAKU_RECEIPTS[0]
    items = AzerbaijaniReceiptParser.parse_line_items(sample["raw_text"])

    assert len(items) == 5
    first_item = items[0]
    assert "MILLA" in first_item.raw_name.upper()
    assert first_item.quantity == 1.0
    assert first_item.unit_price == 2.39
    assert first_item.total_price == 2.39


def test_basket_optimizer_logic():
    # Setup test basket items: Milk, Butter, Detergent
    p_milk = "prod-milk-uuid"
    p_butter = "prod-butter-uuid"
    p_detergent = "prod-detergent-uuid"

    basket = [
        {"product_id": p_milk, "canonical_name": "Milla Milk 1L", "quantity": 2},
        {"product_id": p_butter, "canonical_name": "Westgold Butter 200g", "quantity": 1},
        {"product_id": p_detergent, "canonical_name": "Ariel 3kg", "quantity": 1},
    ]

    # Store 1: OBA 28 May (lat: 40.3805, lon: 49.8460) - cheap milk and butter, expensive/no promo detergent
    # Store 2: Bravo 28 Mall (lat: 40.3798, lon: 49.8475) - within 200m! cheap detergent promo, expensive milk/butter
    # Store 3: Distant store (lat: 40.4500, lon: 49.9500)
    stores = [
        {
            "store_id": "store-oba",
            "branch_name": "OBA 28 May",
            "neighborhood": "28 May",
            "chain_name": "OBA",
            "chain_slug": "oba",
            "chain_color": "#009640",
            "address": "Fuzuli 42",
            "lat": 40.3805,
            "lon": 49.8460,
            "prices": {
                p_milk: 2.10,       # 2 * 2.10 = 4.20
                p_butter: 4.90,     # 1 * 4.90 = 4.90
                p_detergent: 10.50, # 1 * 10.50 = 10.50 -> Total OBA = 19.60
            },
        },
        {
            "store_id": "store-bravo",
            "branch_name": "Bravo 28 Mall",
            "neighborhood": "28 May",
            "chain_name": "Bravo",
            "chain_slug": "bravo",
            "chain_color": "#007A3D",
            "address": "28 Mall",
            "lat": 40.3798,
            "lon": 49.8475,
            "prices": {
                p_milk: 2.35,       # 2 * 2.35 = 4.70
                p_butter: 5.20,     # 1 * 5.20 = 5.20
                p_detergent: 8.50,  # 1 * 8.50 = 8.50 -> Total Bravo = 18.40 (Cheapest single store)
            },
        },
    ]

    user_coords = (40.3800, 49.8470)  # Near 28 May
    res = BasketOptimizer.optimize(
        basket_items=basket,
        stores_inventory=stores,
        user_coords=user_coords,
        max_walking_distance_m=600.0,
    )

    assert res["best_single_store"] is not None
    assert res["best_single_store"]["store_id"] == "store-bravo"
    assert res["best_single_store"]["total_cost"] == 18.40

    # Split trip:
    # Buy milk (2 * 2.10 = 4.20) at OBA
    # Buy butter (1 * 4.90 = 4.90) at OBA
    # Buy detergent (1 * 8.50 = 8.50) at Bravo
    # Split Total = 4.20 + 4.90 + 8.50 = 17.60
    # Savings = 18.40 - 17.60 = 0.80 AZN
    assert res["best_split_store"] is not None
    assert res["best_split_store"]["total_cost"] == 17.60
    assert res["best_split_store"]["savings_vs_single_azn"] == 0.80
    assert res["best_split_store"]["distance_between_stores_m"] < 300
    # Because savings is 0.80 < 1.50 AZN threshold, split is NOT viable
    assert res["is_split_viable"] is False
    assert res["best_split_store"]["is_split_viable"] is False
    assert res["best_split_store"]["primary_store"]["store_id"] == "store-oba"
    assert res["best_split_store"]["secondary_store"]["store_id"] == "store-bravo"


def test_basket_optimizer_viable_split():
    p1 = "prod-1"
    p2 = "prod-2"
    basket = [
        {"product_id": p1, "quantity": 1, "canonical_name": "Coffee"},
        {"product_id": p2, "quantity": 1, "canonical_name": "Olive Oil"},
    ]
    stores = [
        {
            "store_id": "store-araz",
            "branch_name": "Araz - Sahil",
            "chain_name": "Araz",
            "chain_slug": "araz",
            "lat": 40.3700,
            "lon": 49.8400,
            "prices": {p1: 15.00, p2: 20.00},  # Single store total = 35.00
        },
        {
            "store_id": "store-bravo",
            "branch_name": "Bravo - Sahil",
            "chain_name": "Bravo",
            "chain_slug": "bravo",
            "lat": 40.3710,
            "lon": 49.8410,  # ~135m away
            "prices": {p1: 22.00, p2: 12.00},  # Single store total = 34.00 (cheapest baseline)
        },
    ]
    # Split: p1 at Araz (15.00), p2 at Bravo (12.00) -> Split total = 27.00
    # Savings = 34.00 - 27.00 = 7.00 AZN (>= 1.50 AZN threshold)
    user_coords = (40.3705, 49.8405)
    res = BasketOptimizer.optimize(
        basket_items=basket,
        stores_inventory=stores,
        user_coords=user_coords,
        max_walking_distance_m=750.0,
    )

    assert res["is_split_viable"] is True
    assert res["best_single_store"]["store_id"] == "store-bravo"
    assert res["best_single_store"]["total_cost"] == 34.00
    assert res["best_split_store"] is not None
    assert res["best_split_store"]["is_split_viable"] is True
    assert res["best_split_store"]["total_cost"] == 27.00
    assert res["best_split_store"]["savings_azn"] == 7.00
    assert res["best_split_store"]["walking_distance_meters"] < 300
    assert res["best_split_store"]["primary_store"] is not None
    assert res["best_split_store"]["secondary_store"] is not None

