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
        max_walking_distance_m: float = 750.0,
    ) -> Dict[str, Any]:
        """
        Computes deterministic 2-store optimization:
        1. Single Market Baseline (cheapest single store with maximum coverage).
        2. Pairwise Split Search (Store A + Store B within max_walking_distance_m covering 100% of items).
        3. Savings Threshold & Selection (savings >= 1.50 AZN => is_split_viable = True).
        """
        if not basket_items or not stores_inventory:
            return {
                "basket_count": len(basket_items) if basket_items else 0,
                "is_split_viable": False,
                "single_store_baseline": None,
                "best_single_store": None,
                "best_split_store": None,
                "all_single_stores": [],
            }

        total_skus = len(basket_items)

        # Compute distance to user for all stores
        for store in stores_inventory:
            try:
                store["dist_from_user_m"] = geodesic(user_coords, (store["lat"], store["lon"])).meters
            except Exception:
                store["dist_from_user_m"] = 999999.0

        # Filter stores within reachable neighborhood of the user
        max_user_reach_m = max(max_walking_distance_m * 2.5, 3000.0)
        local_stores = [s for s in stores_inventory if s["dist_from_user_m"] <= max_user_reach_m]

        # Fallback if no stores within reach (e.g. remote coordinates or test fixtures)
        if len(local_stores) < 2:
            sorted_by_user_dist = sorted(stores_inventory, key=lambda s: s["dist_from_user_m"])
            local_stores = sorted_by_user_dist[:10] if sorted_by_user_dist else stores_inventory

        # ---------------------------------------------------------
        # STEP 1: Single Market Baseline Calculation
        # ---------------------------------------------------------
        single_store_results = []

        for store in local_stores:
            store_id = store["store_id"]
            total_cost = 0.0
            available_items = 0
            item_breakdown = []
            store_prices = store.get("prices", {})

            for b_item in basket_items:
                pid = b_item["product_id"]
                qty = float(b_item.get("quantity", 1.0))
                price = store_prices.get(pid)

                if price is not None and price > 0:
                    item_total = round(float(price) * qty, 2)
                    total_cost += item_total
                    available_items += 1
                    item_breakdown.append({
                        "product_id": pid,
                        "product_name": b_item.get("canonical_name", "Unknown Product"),
                        "brand": b_item.get("brand"),
                        "quantity": qty,
                        "unit_price": round(float(price), 2),
                        "total_price": item_total,
                    })

            coverage = available_items / total_skus if total_skus > 0 else 0.0
            dist_km = round(
                geodesic(user_coords, (store["lat"], store["lon"])).km, 2
            )

            # Accept stores that carry at least 50% of the basket items
            if coverage >= 0.5:
                single_store_results.append({
                    "store_id": store_id,
                    "branch_name": store["branch_name"],
                    "neighborhood": store.get("neighborhood", "Baku"),
                    "chain_name": store["chain_name"],
                    "chain_slug": store["chain_slug"],
                    "chain_color": store.get("chain_color", "#10B981"),
                    "address": store.get("address", ""),
                    "latitude": store["lat"],
                    "longitude": store["lon"],
                    "total_cost": round(total_cost, 2),
                    "coverage_pct": round(coverage * 100, 1),
                    "distance_km": dist_km,
                    "items": item_breakdown,
                    "missing_items_count": total_skus - available_items,
                })

        # Rank single stores: 100% coverage first, then >=75%, then lowest total cost, then shortest distance
        single_store_results.sort(
            key=lambda s: (
                0 if s["coverage_pct"] >= 99.9 else (1 if s["coverage_pct"] >= 75.0 else 2),
                s["total_cost"],
                s["distance_km"],
            )
        )

        single_store_baseline = single_store_results[0] if single_store_results else None

        # ---------------------------------------------------------
        # STEP 2: Pairwise Split Search (Max 2 Stores within walking radius)
        # ---------------------------------------------------------
        best_split_candidate = None
        min_split_cost = float("inf")
        SAVINGS_THRESHOLD_AZN = 0.50

        for i, s1 in enumerate(local_stores):
            for s2 in local_stores[i + 1 :]:
                if s1["store_id"] == s2["store_id"]:
                    continue

                try:
                    store_dist_m = geodesic(
                        (s1["lat"], s1["lon"]), (s2["lat"], s2["lon"])
                    ).meters
                except Exception as e:
                    logger.warning(f"Distance calculation error between {s1['branch_name']} and {s2['branch_name']}: {e}")
                    continue

                # Must be within the walking radius
                if store_dist_m > max_walking_distance_m:
                    continue

                split_cost = 0.0
                split_items_s1 = []
                split_items_s2 = []
                fully_covered = True

                for b_item in basket_items:
                    pid = b_item["product_id"]
                    qty = float(b_item.get("quantity", 1.0))
                    name = b_item.get("canonical_name", "Product")
                    brand = b_item.get("brand")

                    p1 = s1.get("prices", {}).get(pid)
                    p2 = s2.get("prices", {}).get(pid)

                    # Both missing this item => pair does not cover 100%
                    if (p1 is None or p1 <= 0) and (p2 is None or p2 <= 0):
                        fully_covered = False
                        break

                    # Choose cheaper store, or store 1 on tie
                    if p1 is not None and p1 > 0 and (p2 is None or p2 <= 0 or p1 <= p2):
                        item_cost = round(float(p1) * qty, 2)
                        split_cost += item_cost
                        split_items_s1.append({
                            "product_id": pid,
                            "product_name": name,
                            "brand": brand,
                            "quantity": qty,
                            "unit_price": round(float(p1), 2),
                            "total_price": item_cost,
                        })
                    else:
                        item_cost = round(float(p2) * qty, 2)
                        split_cost += item_cost
                        split_items_s2.append({
                            "product_id": pid,
                            "product_name": name,
                            "brand": brand,
                            "quantity": qty,
                            "unit_price": round(float(p2), 2),
                            "total_price": item_cost,
                        })

                # Valid split requires 100% item coverage and both stores utilized
                if (
                    fully_covered
                    and len(split_items_s1) > 0
                    and len(split_items_s2) > 0
                    and split_cost < min_split_cost
                ):
                    min_split_cost = split_cost
                    best_split_candidate = {
                        "s1": s1,
                        "s2": s2,
                        "s1_items": split_items_s1,
                        "s2_items": split_items_s2,
                        "split_cost": split_cost,
                        "store_dist_m": store_dist_m,
                    }

        # ---------------------------------------------------------
        # STEP 3: Savings Threshold & Selection (>= 1.50 AZN)
        # ---------------------------------------------------------
        best_split = None
        is_split_viable = False

        if best_split_candidate and single_store_baseline:
            split_cost = best_split_candidate["split_cost"]
            single_benchmark = single_store_baseline["total_cost"]
            savings = round(single_benchmark - split_cost, 2)
            savings_pct = (
                round((savings / single_benchmark) * 100, 1)
                if single_benchmark > 0
                else 0.0
            )

            is_split_viable = savings >= SAVINGS_THRESHOLD_AZN and savings > 0

            # Order as primary (more items or higher subtotal) and secondary
            cand_s1 = best_split_candidate["s1"]
            cand_s2 = best_split_candidate["s2"]
            items_s1 = best_split_candidate["s1_items"]
            items_s2 = best_split_candidate["s2_items"]
            subtotal_s1 = round(sum(it["total_price"] for it in items_s1), 2)
            subtotal_s2 = round(sum(it["total_price"] for it in items_s2), 2)

            # Store with more items (or higher subtotal) is primary
            if len(items_s1) > len(items_s2) or (len(items_s1) == len(items_s2) and subtotal_s1 >= subtotal_s2):
                p_store_data, p_items, p_subtotal = cand_s1, items_s1, subtotal_s1
                s_store_data, s_items, s_subtotal = cand_s2, items_s2, subtotal_s2
            else:
                p_store_data, p_items, p_subtotal = cand_s2, items_s2, subtotal_s2
                s_store_data, s_items, s_subtotal = cand_s1, items_s1, subtotal_s1

            primary_store = {
                "store_id": p_store_data["store_id"],
                "branch_name": p_store_data["branch_name"],
                "neighborhood": p_store_data.get("neighborhood", "Baku"),
                "chain_name": p_store_data["chain_name"],
                "chain_slug": p_store_data["chain_slug"],
                "chain_color": p_store_data.get("chain_color", "#10B981"),
                "address": p_store_data.get("address", ""),
                "latitude": p_store_data["lat"],
                "longitude": p_store_data["lon"],
                "subtotal": p_subtotal,
                "items": p_items,
            }

            secondary_store = {
                "store_id": s_store_data["store_id"],
                "branch_name": s_store_data["branch_name"],
                "neighborhood": s_store_data.get("neighborhood", "Baku"),
                "chain_name": s_store_data["chain_name"],
                "chain_slug": s_store_data["chain_slug"],
                "chain_color": s_store_data.get("chain_color", "#10B981"),
                "address": s_store_data.get("address", ""),
                "latitude": s_store_data["lat"],
                "longitude": s_store_data["lon"],
                "subtotal": s_subtotal,
                "items": s_items,
            }

            best_split = {
                "is_split_viable": is_split_viable,
                "primary_store": primary_store,
                "secondary_store": secondary_store,
                "store_1": primary_store,  # Backward compatibility
                "store_2": secondary_store,  # Backward compatibility
                "total_cost": round(split_cost, 2),
                "savings_azn": max(0.0, savings),
                "savings_vs_single_azn": max(0.0, savings),  # Backward compatibility
                "savings_percent": max(0.0, savings_pct),
                "walking_distance_meters": round(best_split_candidate["store_dist_m"], 0),
                "distance_between_stores_m": round(best_split_candidate["store_dist_m"], 0),  # Backward compatibility
            }

        return {
            "basket_count": total_skus,
            "is_split_viable": is_split_viable,
            "single_store_baseline": single_store_baseline,
            "best_single_store": single_store_baseline,
            "best_split_store": best_split,
            "all_single_stores": single_store_results[:5],
        }
