import math
import logging
from typing import List, Dict, Any, Tuple

try:
    from geopy.distance import geodesic
except ImportError:
    class FakeGeodesic:
        def __init__(self, c1, c2):
            lat1, lon1 = math.radians(c1[0]), math.radians(c1[1])
            lat2, lon2 = math.radians(c2[0]), math.radians(c2[1])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            self.meters = 6371000 * c
            self.km = self.meters / 1000.0

    def geodesic(c1, c2):
        return FakeGeodesic(c1, c2)

logger = logging.getLogger("sebet.optimizer")


class BasketOptimizer:
    @staticmethod
    def optimize(
        basket_items: List[Dict[str, Any]],  # [{"product_id": UUID, "canonical_name": str, "brand": str, "quantity": float}]
        stores_inventory: List[Dict[str, Any]],  # [{"store_id": UUID, "branch_name": str, "neighborhood": str, "chain_name": str, "chain_slug": str, "chain_color": str, "address": str, "lat": float, "lon": float, "prices": {product_id: float}}]
        user_coords: Tuple[float, float],
        max_walking_distance_m: float = 600.0,
    ) -> Dict[str, Any]:
        """
        Computes:
        1. Single-Store Minimum Cost (s_best with >= 75% coverage).
        2. Dual-Store Split Optimization (s1, s2 within max_walking_distance_m).
        """
        if not basket_items or not stores_inventory:
            return {
                "basket_count": len(basket_items),
                "best_single_store": None,
                "best_split_store": None,
                "all_single_stores": [],
            }

        total_skus = len(basket_items)
        single_store_results = []

        for store in stores_inventory:
            store_id = store["store_id"]
            total_cost = 0.0
            available_items = 0
            item_breakdown = []
            store_prices = store["prices"]

            for b_item in basket_items:
                pid = b_item["product_id"]
                qty = b_item["quantity"]
                price = store_prices.get(pid)

                if price is not None and price > 0:
                    item_total = round(price * qty, 2)
                    total_cost += item_total
                    available_items += 1
                    item_breakdown.append({
                        "product_id": pid,
                        "product_name": b_item.get("canonical_name", "Unknown Product"),
                        "brand": b_item.get("brand"),
                        "quantity": qty,
                        "unit_price": round(price, 2),
                        "total_price": item_total,
                    })

            coverage = available_items / total_skus if total_skus > 0 else 0
            dist_km = round(
                geodesic(user_coords, (store["lat"], store["lon"])).km, 2
            )

            # Accept stores with at least 50% coverage, prioritising >= 75%
            if coverage >= 0.5:
                single_store_results.append({
                    "store_id": store_id,
                    "branch_name": store["branch_name"],
                    "neighborhood": store.get("neighborhood", "Baku"),
                    "chain_name": store["chain_name"],
                    "chain_slug": store["chain_slug"],
                    "chain_color": store.get("chain_color", "#10B981"),
                    "address": store["address"],
                    "latitude": store["lat"],
                    "longitude": store["lon"],
                    "total_cost": round(total_cost, 2),
                    "coverage_pct": round(coverage * 100, 1),
                    "distance_km": dist_km,
                    "items": item_breakdown,
                    "missing_items_count": total_skus - available_items,
                })

        # Rank single stores: first by highest coverage (>=75%), then by lowest total cost, then by distance
        single_store_results.sort(
            key=lambda s: (
                0 if s["coverage_pct"] >= 75 else 1,
                s["total_cost"],
                s["distance_km"],
            )
        )

        best_single = single_store_results[0] if single_store_results else None

        # Dual-Store Split Optimization
        best_split = None
        min_split_cost = float("inf")

        for i, s1 in enumerate(stores_inventory):
            for s2 in stores_inventory[i + 1 :]:
                store_dist_m = geodesic(
                    (s1["lat"], s1["lon"]), (s2["lat"], s2["lon"])
                ).meters

                if store_dist_m > max_walking_distance_m:
                    continue

                split_cost = 0.0
                split_items_s1 = []
                split_items_s2 = []
                fully_covered = True

                for b_item in basket_items:
                    pid = b_item["product_id"]
                    qty = b_item["quantity"]
                    name = b_item.get("canonical_name", "Product")
                    brand = b_item.get("brand")

                    p1 = s1["prices"].get(pid)
                    p2 = s2["prices"].get(pid)

                    # If neither store has the item, skip this pair
                    if p1 is None and p2 is None:
                        fully_covered = False
                        break

                    # Pick cheaper store
                    if p1 is not None and (p2 is None or p1 <= p2):
                        item_cost = round(p1 * qty, 2)
                        split_cost += item_cost
                        split_items_s1.append({
                            "product_id": pid,
                            "product_name": name,
                            "brand": brand,
                            "quantity": qty,
                            "unit_price": round(p1, 2),
                            "total_price": item_cost,
                        })
                    else:
                        item_cost = round(p2 * qty, 2)
                        split_cost += item_cost
                        split_items_s2.append({
                            "product_id": pid,
                            "product_name": name,
                            "brand": brand,
                            "quantity": qty,
                            "unit_price": round(p2, 2),
                            "total_price": item_cost,
                        })

                # Check if this split is valid and both stores are used
                if (
                    fully_covered
                    and len(split_items_s1) > 0
                    and len(split_items_s2) > 0
                    and split_cost < min_split_cost
                ):
                    min_split_cost = split_cost
                    single_benchmark = best_single["total_cost"] if best_single else split_cost
                    savings = round(single_benchmark - split_cost, 2)
                    savings_pct = (
                        round((savings / single_benchmark) * 100, 1)
                        if single_benchmark > 0
                        else 0.0
                    )

                    best_split = {
                        "store_1": {
                            "store_id": s1["store_id"],
                            "branch_name": s1["branch_name"],
                            "chain_name": s1["chain_name"],
                            "chain_slug": s1["chain_slug"],
                            "chain_color": s1.get("chain_color", "#10B981"),
                            "address": s1["address"],
                            "latitude": s1["lat"],
                            "longitude": s1["lon"],
                            "subtotal": round(sum(it["total_price"] for it in split_items_s1), 2),
                            "items": split_items_s1,
                        },
                        "store_2": {
                            "store_id": s2["store_id"],
                            "branch_name": s2["branch_name"],
                            "chain_name": s2["chain_name"],
                            "chain_slug": s2["chain_slug"],
                            "chain_color": s2.get("chain_color", "#10B981"),
                            "address": s2["address"],
                            "latitude": s2["lat"],
                            "longitude": s2["lon"],
                            "subtotal": round(sum(it["total_price"] for it in split_items_s2), 2),
                            "items": split_items_s2,
                        },
                        "total_cost": round(split_cost, 2),
                        "distance_between_stores_m": round(store_dist_m, 0),
                        "savings_vs_single_azn": max(0.0, savings),
                        "savings_percent": max(0.0, savings_pct),
                    }

        return {
            "basket_count": total_skus,
            "best_single_store": best_single,
            "best_split_store": best_split,
            "all_single_stores": single_store_results[:5],
        }
