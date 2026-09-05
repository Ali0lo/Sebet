import sys
import unittest
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from app.services.basket_optimizer import BasketOptimizer
from app.services.ocr_service import AzerbaijaniReceiptParser, SAMPLE_BAKU_RECEIPTS


class TestSebEtCoreServices(unittest.TestCase):
    def test_receipt_metadata_extraction(self):
        sample = SAMPLE_BAKU_RECEIPTS[0]
        meta = AzerbaijaniReceiptParser.extract_fiscal_metadata(sample["raw_text"])

        self.assertEqual(meta["voen"], "1401564751")
        self.assertEqual(meta["obyekt_kodu"], "0101")
        self.assertEqual(meta["total_amount"], 26.50)
        self.assertIsNotNone(meta["fiscal_id"])

    def test_receipt_line_items_parsing(self):
        sample = SAMPLE_BAKU_RECEIPTS[0]
        items = AzerbaijaniReceiptParser.parse_line_items(sample["raw_text"])

        self.assertEqual(len(items), 5)
        first_item = items[0]
        self.assertIn("MILLA", first_item.raw_name.upper())
        self.assertEqual(first_item.quantity, 1.0)
        self.assertEqual(first_item.unit_price, 2.35)
        self.assertEqual(first_item.total_price, 2.35)

    def test_basket_optimizer_logic(self):
        p_milk = "prod-milk-uuid"
        p_butter = "prod-butter-uuid"
        p_detergent = "prod-detergent-uuid"

        basket = [
            {"product_id": p_milk, "canonical_name": "Milla Milk 1L", "quantity": 2},
            {"product_id": p_butter, "canonical_name": "Westgold Butter 200g", "quantity": 1},
            {"product_id": p_detergent, "canonical_name": "Ariel 3kg", "quantity": 1},
        ]

        # Store 1: OBA 28 May (lat: 40.3805, lon: 49.8460)
        # Store 2: Bravo 28 Mall (lat: 40.3798, lon: 49.8475) -> ~180 meters apart!
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

        self.assertIsNotNone(res["best_single_store"])
        self.assertEqual(res["best_single_store"]["store_id"], "store-bravo")
        self.assertEqual(res["best_single_store"]["total_cost"], 18.40)

        # Split trip:
        # Buy milk (2 * 2.10 = 4.20) at OBA
        # Buy butter (1 * 4.90 = 4.90) at OBA
        # Buy detergent (1 * 8.50 = 8.50) at Bravo
        # Split Total = 4.20 + 4.90 + 8.50 = 17.60
        # Savings = 18.40 - 17.60 = 0.80 AZN
        self.assertIsNotNone(res["best_split_store"])
        self.assertEqual(res["best_split_store"]["total_cost"], 17.60)
        self.assertEqual(res["best_split_store"]["savings_vs_single_azn"], 0.80)
        self.assertLess(res["best_split_store"]["distance_between_stores_m"], 300)


if __name__ == "__main__":
    unittest.main()

