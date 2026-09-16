"""
SebEt — Bakı Supermarket Qiymət Müqayisəsi & Ağıllı Səbət Optimizatoru
Streamlit Cloud Interactive Web Application
"""

import math
import os
import time
from typing import List, Dict, Any, Tuple
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

import sebet_data

if "points" not in st.session_state:
    st.session_state.points = 250

# -----------------------------------------------------------------------------
# 1. Page Configuration & Theme
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Sebet — Ağıllı Səbət & Qiymət Müqayisəsi",
    page_icon="🛒",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .main-header {
        background: linear-gradient(135deg, #1e4d2b 0%, #10b981 100%);
        padding: 24px 32px;
        border-radius: 20px;
        color: white;
        margin-bottom: 24px;
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.25);
    }
    .header-badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-bottom: 8px;
    }
    .metric-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 18px 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .store-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        padding: 20px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .store-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        color: white;
    }
    .promo-tag {
        background: #fee2e2;
        color: #dc2626;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
    }
    .savings-badge {
        background: #dcfce7;
        color: #15803d;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 800;
        font-size: 14px;
        display: inline-block;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# -----------------------------------------------------------------------------
# 2. Helper Functions & Distance Computation
# -----------------------------------------------------------------------------
def calculate_distance_meters(c1: Tuple[float, float], c2: Tuple[float, float]) -> float:
    """Calculates distance between coordinates in meters using haversine formula."""
    lat1, lon1 = math.radians(c1[0]), math.radians(c1[1])
    lat2, lon2 = math.radians(c2[0]), math.radians(c2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371000.0 * c


def get_effective_price(product: Dict[str, Any], chain_slug: str) -> float:
    """Returns promo price if available, otherwise variation or base price."""
    promo = product.get("promo")
    if promo and promo.get("chain") == chain_slug:
        return float(promo["promo_price"])
    if chain_slug in product.get("variations", {}):
        return float(product["variations"][chain_slug])
    return float(product.get("base_price", 0.0))


def render_map(
    df: pd.DataFrame,
    lat: str = "lat",
    lon: str = "lon",
    hover_name: str = None,
    color: str = None,
    size: str = None,
    hover_data: list = None,
    zoom: float = 12.0,
    height: int = 380,
):
    """Renders map using px.scatter_map (Plotly 7+) or px.scatter_mapbox (Plotly 5/6), with st.map fallback."""
    try:
        kwargs = dict(lat=lat, lon=lon, zoom=zoom, height=height)
        if hover_name:
            kwargs["hover_name"] = hover_name
        if color:
            kwargs["color"] = color
        if size:
            kwargs["size"] = size
        if hover_data:
            kwargs["hover_data"] = hover_data

        if hasattr(px, "scatter_map"):
            fig = px.scatter_map(df, **kwargs)
            fig.update_layout(
                map_style="open-street-map",
                margin={"r": 0, "t": 0, "l": 0, "b": 0},
                legend=dict(yanchor="top", y=0.98, xanchor="left", x=0.02, bgcolor="rgba(255,255,255,0.8)"),
            )
            st.plotly_chart(fig, use_container_width=True)
            return
        elif hasattr(px, "scatter_mapbox"):
            fig = px.scatter_mapbox(df, **kwargs)
            fig.update_layout(
                mapbox_style="carto-positron",
                margin={"r": 0, "t": 0, "l": 0, "b": 0},
                legend=dict(yanchor="top", y=0.98, xanchor="left", x=0.02, bgcolor="rgba(255,255,255,0.8)"),
            )
            st.plotly_chart(fig, use_container_width=True)
            return
    except Exception:
        pass

    # Fallback to standard streamlit map
    st.map(df[[lat, lon]], zoom=int(zoom))


# -----------------------------------------------------------------------------
# 3. Data Preparation & Caching
# -----------------------------------------------------------------------------
@st.cache_data
def load_all_data():
    chains = {c["slug"]: c for c in sebet_data.CHAINS_DATA}
    categories = {c["slug"]: c for c in sebet_data.CATEGORIES_DATA}
    products = sebet_data.PRODUCTS_DATA
    stores = sebet_data.STORES_DATA

    # Pre-build store inventory
    stores_inventory = []
    for idx, s in enumerate(stores):
        c = chains.get(s["chain_slug"], {"name": s["chain_slug"].title(), "color": "#10B981"})
        prices = {}
        for p in products:
            prices[p["barcode"]] = get_effective_price(p, s["chain_slug"])
        stores_inventory.append({
            "store_id": idx,
            "branch_name": s["branch_name"],
            "neighborhood": s["neighborhood"],
            "chain_name": c["name"],
            "chain_slug": s["chain_slug"],
            "chain_color": c.get("color", "#10b981"),
            "address": s["address"],
            "lat": s["latitude"],
            "lon": s["longitude"],
            "prices": prices,
        })

    return chains, categories, products, stores, stores_inventory


CHAINS, CATEGORIES, PRODUCTS, STORES, STORES_INVENTORY = load_all_data()

# -----------------------------------------------------------------------------
# 4. Optimization Engine (Single Baseline vs 2-Store Split)
# -----------------------------------------------------------------------------
def run_basket_optimization(
    basket_items: List[Dict[str, Any]],
    user_coords: Tuple[float, float],
    max_walking_m: float = 750.0,
) -> Dict[str, Any]:
    if not basket_items:
        return {"is_split_viable": False, "single": None, "split": None}

    total_skus = len(basket_items)

    # Filter local stores reachable from user
    annotated_stores = []
    for s in STORES_INVENTORY:
        dist_m = calculate_distance_meters(user_coords, (s["lat"], s["lon"]))
        annotated_stores.append({**s, "dist_from_user_m": dist_m})

    reach_limit = max(max_walking_m * 3.0, 3000.0)
    local_stores = [s for s in annotated_stores if s["dist_from_user_m"] <= reach_limit]
    if len(local_stores) < 2:
        annotated_stores.sort(key=lambda s: s["dist_from_user_m"])
        local_stores = annotated_stores[:10]

    # Step 1: Single store baseline
    single_candidates = []
    for s in local_stores:
        cost = 0.0
        covered = 0
        items_detail = []
        for it in basket_items:
            b_code = it["barcode"]
            qty = float(it.get("quantity", 1.0))
            p = s["prices"].get(b_code)
            if p is not None and p > 0:
                covered += 1
                item_tot = round(p * qty, 2)
                cost += item_tot
                items_detail.append({
                    "barcode": b_code,
                    "name": it["canonical_name"],
                    "unit_price": p,
                    "quantity": qty,
                    "unit": it.get("unit", "ədəd"),
                    "total": item_tot,
                })

        coverage = covered / total_skus if total_skus > 0 else 0.0
        if coverage >= 0.6:  # at least 60% coverage
            dist_km = round(s["dist_from_user_m"] / 1000.0, 2)
            single_candidates.append({
                **s,
                "total_cost": round(cost, 2),
                "coverage_pct": round(coverage * 100, 1),
                "distance_km": dist_km,
                "items": items_detail,
                "missing": total_skus - covered,
            })

    single_candidates.sort(key=lambda x: (
        0 if x["coverage_pct"] >= 99.9 else 1,
        x["total_cost"],
        x["distance_km"],
    ))
    baseline = single_candidates[0] if single_candidates else None

    # Step 2: 2-Store Split within walking distance
    best_split = None
    min_split_cost = float("inf")

    for i in range(len(local_stores)):
        for j in range(i + 1, len(local_stores)):
            s1 = local_stores[i]
            s2 = local_stores[j]
            store_dist = calculate_distance_meters((s1["lat"], s1["lon"]), (s2["lat"], s2["lon"]))
            if store_dist > max_walking_m:
                continue

            split_cost = 0.0
            s1_items = []
            s2_items = []
            both_cover = True

            for it in basket_items:
                b_code = it["barcode"]
                qty = float(it.get("quantity", 1.0))
                name = it["canonical_name"]
                unit = it.get("unit", "ədəd")

                p1 = s1["prices"].get(b_code)
                p2 = s2["prices"].get(b_code)

                if (p1 is None or p1 <= 0) and (p2 is None or p2 <= 0):
                    both_cover = False
                    break

                if p1 is not None and p1 > 0 and (p2 is None or p2 <= 0 or p1 <= p2):
                    cost = round(p1 * qty, 2)
                    split_cost += cost
                    s1_items.append({
                        "barcode": b_code,
                        "name": name,
                        "unit_price": p1,
                        "quantity": qty,
                        "unit": unit,
                        "total": cost,
                        "savings_vs_other": round((p2 - p1) * qty, 2) if (p2 and p2 > p1) else 0.0,
                    })
                else:
                    cost = round(p2 * qty, 2)
                    split_cost += cost
                    s2_items.append({
                        "barcode": b_code,
                        "name": name,
                        "unit_price": p2,
                        "quantity": qty,
                        "unit": unit,
                        "total": cost,
                        "savings_vs_other": round((p1 - p2) * qty, 2) if (p1 and p1 > p2) else 0.0,
                    })

            if both_cover and len(s1_items) > 0 and len(s2_items) > 0 and split_cost < min_split_cost:
                min_split_cost = split_cost
                best_split = {
                    "s1": s1,
                    "s2": s2,
                    "s1_items": s1_items,
                    "s2_items": s2_items,
                    "total_cost": round(split_cost, 2),
                    "walking_meters": round(store_dist),
                }

    # Step 3: Check viability
    is_split_viable = False
    if best_split and baseline:
        savings = round(baseline["total_cost"] - best_split["total_cost"], 2)
        if savings >= 0.15:
            is_split_viable = True
            best_split["savings_azn"] = savings
            best_split["savings_pct"] = round((savings / baseline["total_cost"]) * 100, 1)

    return {
        "is_split_viable": is_split_viable,
        "single": baseline,
        "split": best_split,
    }


# -----------------------------------------------------------------------------
# 5. App State Initialization
# -----------------------------------------------------------------------------
if "basket" not in st.session_state:
    # Initialize with default popular breakfast basket
    st.session_state.basket = [
        {"barcode": PRODUCTS[0]["barcode"], "canonical_name": PRODUCTS[0]["canonical_name"], "brand": PRODUCTS[0]["brand"], "quantity": 2.0, "unit": "liter", "cat_slug": PRODUCTS[0]["cat_slug"]},
        {"barcode": PRODUCTS[4]["barcode"], "canonical_name": PRODUCTS[4]["canonical_name"], "brand": PRODUCTS[4]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[4]["cat_slug"]},
        {"barcode": PRODUCTS[10]["barcode"], "canonical_name": PRODUCTS[10]["canonical_name"], "brand": PRODUCTS[10]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[10]["cat_slug"]},
        {"barcode": PRODUCTS[11]["barcode"], "canonical_name": PRODUCTS[11]["canonical_name"], "brand": PRODUCTS[11]["brand"], "quantity": 2.0, "unit": "piece", "cat_slug": PRODUCTS[11]["cat_slug"]},
        {"barcode": PRODUCTS[28]["barcode"], "canonical_name": PRODUCTS[28]["canonical_name"], "brand": PRODUCTS[28]["brand"], "quantity": 1.5, "unit": "kg", "cat_slug": PRODUCTS[28]["cat_slug"]},
    ]

# -----------------------------------------------------------------------------
# 6. Sidebar Controls
# -----------------------------------------------------------------------------
with st.sidebar:
    st.image(
        "frontend/public/sebet-logo-banner.png" if os.path.exists("frontend/public/sebet-logo-banner.png") else "https://raw.githubusercontent.com/Ali0lo/Sebet/main/frontend/public/logo-light.png",
        use_container_width=True,
    )
    dark_mode = st.toggle("🌙 Qaranlıq Rejim (Dark Mode)", value=False, key="dark_mode_toggle")

    st.markdown("### 📍 Bakı Məkanı & Radius")

    LOCATION_PRESETS = {
        "28 May / Nəsimi": (40.3798, 49.8475),
        "Yasamal / Elmlər": (40.3745, 49.8130),
        "Nərimanov": (40.4024, 49.8712),
        "Xırdalan": (40.4505, 49.7540),
        "Sumqayıt": (40.5855, 49.6317),
        "Gəncə": (40.6828, 46.3606),
    }

    selected_loc_name = st.selectbox(
        "Yaşadığınız ərazi:",
        list(LOCATION_PRESETS.keys()) + ["Xüsusi Koordinatlar..."],
        index=0,
    )

    if selected_loc_name == "Xüsusi Koordinatlar...":
        col_lat, col_lon = st.columns(2)
        with col_lat:
            user_lat = st.number_input("Enlik (Lat)", value=40.3798, format="%.4f")
        with col_lon:
            user_lon = st.number_input("Uzunluq (Lon)", value=49.8475, format="%.4f")
        user_coords = (user_lat, user_lon)
    else:
        user_coords = LOCATION_PRESETS[selected_loc_name]

    max_walking_dist = st.slider(
        "🚶 Piyada məsafə limiti (metr):",
        min_value=200,
        max_value=1500,
        value=750,
        step=50,
        help="2 market arasındakı maksimum gəzinti məsafəsi. Bakıda adətən 750 metr (7-9 dəqiqə) optimaldır.",
    )

    pts = st.session_state.get("points", 250)
    card_bg = "#1e293b" if dark_mode else "#f1f5f9"
    card_text = "#f8fafc" if dark_mode else "#0f172a"
    sub_text = "#94a3b8" if dark_mode else "#64748b"

    st.markdown("---")
    st.markdown(
        f"""
        <div style="background: {card_bg}; padding: 12px; border-radius: 12px; font-size: 13px; border: 1px solid rgba(148, 163, 184, 0.2);">
            <div style="font-weight: 700; color: {card_text}; margin-bottom: 4px;">👤 Müştəri Profili (Demo)</div>
            <div style="color: {sub_text};">Sebet Xalları: <b style="color: #10b981;">{pts} Xal</b> (= {pts / 100:.2f} ₼)</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("---")
    st.markdown(
        """
        <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
            <b>SebEt Baku Grocery Intelligence</b><br/>
            Real-time price dispersion engine for Baku supermarkets: Bravo, Araz, OBA, Bazarstore, Al Market, Neptun, Spar.<br/>
            <a href="https://github.com/Ali0lo/Sebet" target="_blank" style="color: #10b981; text-decoration: none; font-weight: 600;">GitHub Repository ↗</a>
        </div>
        """,
        unsafe_allow_html=True,
    )

if dark_mode:
    st.markdown(
        """
        <style>
        .stApp {
            background-color: #0b1120 !important;
            color: #f1f5f9 !important;
        }
        section[data-testid="stSidebar"] {
            background-color: #0f172a !important;
            border-right: 1px solid #1e293b !important;
        }
        .store-card, .metric-card, div[data-testid="stExpander"] {
            background-color: #1e293b !important;
            border-color: #334155 !important;
            color: #f1f5f9 !important;
        }
        div[data-testid="stMetricValue"] {
            color: #34d399 !important;
        }
        div[data-testid="stMetricLabel"] {
            color: #94a3b8 !important;
        }
        .stMarkdown p, .stMarkdown span, .stMarkdown div, h1, h2, h3, h4, h5, h6 {
            color: #f8fafc !important;
        }
        .main-header {
            background: linear-gradient(135deg, #064e3b 0%, #047857 100%) !important;
            box-shadow: 0 10px 25px -5px rgba(4, 120, 87, 0.4) !important;
        }
        input, select, textarea, div[data-baseweb="select"] {
            background-color: #1e293b !important;
            color: #f8fafc !important;
            border-color: #475569 !important;
        }
        .stDataFrame {
            background-color: #1e293b !important;
        }
        div[data-testid="stExpander"] summary {
            background-color: #1e293b !important;
            color: #f1f5f9 !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

# -----------------------------------------------------------------------------
# 7. Main Hero Banner
# -----------------------------------------------------------------------------
st.markdown(
    """
    <div class="main-header">
        <div class="header-badge">🚀 Canlı Qiymət & Marşrut Optimizatoru</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: white;">SebEt — Bakının Ağıllı Səbət Platforması</h1>
        <p style="margin: 6px 0 0 0; opacity: 0.92; font-size: 15px; font-weight: 400; max-width: 820px;">
            Bakının 7 aparıcı supermarket şəbəkəsində (Bravo, Araz, OBA, Bazarstore, Al Market, Neptun, Spar) real vaxtda qiymət fərqlərini müqayisə edin və piyada məsafədə 2-market marşrutu ilə qənaət edin.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------------------------------------------------------
# 8. Main Tabs Layout
# -----------------------------------------------------------------------------
tab_optimizer, tab_comparison, tab_flyers, tab_scan, tab_analytics, tab_loyalty, tab_about = st.tabs([
    "🧺 Ağıllı Səbət (Smart Basket)",
    "🔍 Qiymət Müqayisəsi (Matrix)",
    "📰 Həftəlik Bukletlər (Flyers)",
    "🧾 Qəbz Skanı & Keşbek (OCR)",
    "📊 Bazar Analitikası (Analytics)",
    "🎁 Keşbek & Loyallıq",
    "ℹ️ Texniki Memarlıq (About)",
])

# =============================================================================
# TAB 1: AĞILLI SƏBƏT (SMART BASKET OPTIMIZER)
# =============================================================================
with tab_optimizer:
    col_basket_mgr, col_optimizer_view = st.columns([1, 1.4], gap="large")

    with col_basket_mgr:
        st.markdown("### 🛒 Səbətiniz")

        # Quick preset buttons
        st.markdown("<div style='font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 6px;'>⚡ Hazır Səbət Şablonları:</div>", unsafe_allow_html=True)
        col_p1, col_p2, col_p3 = st.columns(3)
        with col_p1:
            if st.button("🍳 Səhər Yeməyi", key="preset_breakfast", use_container_width=True):
                st.session_state.basket = [
                    {"barcode": PRODUCTS[0]["barcode"], "canonical_name": PRODUCTS[0]["canonical_name"], "brand": PRODUCTS[0]["brand"], "quantity": 2.0, "unit": "liter", "cat_slug": PRODUCTS[0]["cat_slug"]},
                    {"barcode": PRODUCTS[4]["barcode"], "canonical_name": PRODUCTS[4]["canonical_name"], "brand": PRODUCTS[4]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[4]["cat_slug"]},
                    {"barcode": PRODUCTS[10]["barcode"], "canonical_name": PRODUCTS[10]["canonical_name"], "brand": PRODUCTS[10]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[10]["cat_slug"]},
                    {"barcode": PRODUCTS[11]["barcode"], "canonical_name": PRODUCTS[11]["canonical_name"], "brand": PRODUCTS[11]["brand"], "quantity": 2.0, "unit": "piece", "cat_slug": PRODUCTS[11]["cat_slug"]},
                ]
                st.rerun()

        with col_p2:
            if st.button("🥗 Meyvə & Tərəvəz", key="preset_produce", use_container_width=True):
                st.session_state.basket = [
                    {"barcode": PRODUCTS[28]["barcode"], "canonical_name": PRODUCTS[28]["canonical_name"], "brand": PRODUCTS[28]["brand"], "quantity": 2.0, "unit": "kg", "cat_slug": PRODUCTS[28]["cat_slug"]},
                    {"barcode": PRODUCTS[29]["barcode"], "canonical_name": PRODUCTS[29]["canonical_name"], "brand": PRODUCTS[29]["brand"], "quantity": 1.5, "unit": "kg", "cat_slug": PRODUCTS[29]["cat_slug"]},
                    {"barcode": PRODUCTS[30]["barcode"], "canonical_name": PRODUCTS[30]["canonical_name"], "brand": PRODUCTS[30]["brand"], "quantity": 3.0, "unit": "kg", "cat_slug": PRODUCTS[30]["cat_slug"]},
                    {"barcode": PRODUCTS[32]["barcode"], "canonical_name": PRODUCTS[32]["canonical_name"], "brand": PRODUCTS[32]["brand"], "quantity": 1.5, "unit": "kg", "cat_slug": PRODUCTS[32]["cat_slug"]},
                ]
                st.rerun()

        with col_p3:
            if st.button("🏠 Ailəvi Həftəlik", key="preset_family", use_container_width=True):
                st.session_state.basket = [
                    {"barcode": PRODUCTS[15]["barcode"], "canonical_name": PRODUCTS[15]["canonical_name"], "brand": PRODUCTS[15]["brand"], "quantity": 2.0, "unit": "kg", "cat_slug": PRODUCTS[15]["cat_slug"]},
                    {"barcode": PRODUCTS[19]["barcode"], "canonical_name": PRODUCTS[19]["canonical_name"], "brand": PRODUCTS[19]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[19]["cat_slug"]},
                    {"barcode": PRODUCTS[22]["barcode"], "canonical_name": PRODUCTS[22]["canonical_name"], "brand": PRODUCTS[22]["brand"], "quantity": 2.0, "unit": "piece", "cat_slug": PRODUCTS[22]["cat_slug"]},
                    {"barcode": PRODUCTS[23]["barcode"], "canonical_name": PRODUCTS[23]["canonical_name"], "brand": PRODUCTS[23]["brand"], "quantity": 3.0, "unit": "piece", "cat_slug": PRODUCTS[23]["cat_slug"]},
                    {"barcode": PRODUCTS[43]["barcode"], "canonical_name": PRODUCTS[43]["canonical_name"], "brand": PRODUCTS[43]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[43]["cat_slug"]},
                ]
                st.rerun()

        # Add Product Selector
        with st.expander("➕ Yeni Məhsul Əlavə Et", expanded=False):
            f_cat = st.selectbox(
                "Kateqoriya:",
                ["Bütün Kateqoriyalar"] + [c["name_az"] for c in CATEGORIES.values()],
                key="basket_cat_filter",
            )
            f_search = st.text_input("Məhsul axtarışı:", key="basket_prod_search", placeholder="Məs: Süd, Yağ, Çay...")

            avail_prods = PRODUCTS
            if f_cat != "Bütün Kateqoriyalar":
                cat_slug = next((c["slug"] for c in CATEGORIES.values() if c["name_az"] == f_cat), None)
                if cat_slug:
                    avail_prods = [p for p in avail_prods if p["cat_slug"] == cat_slug]

            if f_search:
                s_lower = f_search.lower()
                avail_prods = [p for p in avail_prods if s_lower in p["canonical_name"].lower() or s_lower in p["brand"].lower()]

            if avail_prods:
                prod_names = [f"{p['canonical_name']} ({p.get('pack_size', '')})" for p in avail_prods]
                selected_idx = st.selectbox("Məhsul seçin:", range(len(avail_prods)), format_func=lambda i: prod_names[i], key="basket_sel_prod")
                sel_prod = avail_prods[selected_idx]

                is_kg = sel_prod.get("unit") == "kg"
                if is_kg:
                    new_qty = st.number_input("Çəki (kq):", min_value=0.2, max_value=20.0, value=1.0, step=0.5, key="new_qty_kg")
                else:
                    new_qty = st.number_input("Say (ədəd):", min_value=1.0, max_value=50.0, value=1.0, step=1.0, key="new_qty_count")

                if st.button("Səbətə Əlavə Et", key="btn_add_to_basket", type="primary", use_container_width=True):
                    existing = next((item for item in st.session_state.basket if item["barcode"] == sel_prod["barcode"]), None)
                    if existing:
                        existing["quantity"] = round(existing["quantity"] + new_qty, 1)
                    else:
                        st.session_state.basket.append({
                            "barcode": sel_prod["barcode"],
                            "canonical_name": sel_prod["canonical_name"],
                            "brand": sel_prod["brand"],
                            "quantity": new_qty,
                            "unit": sel_prod.get("unit", "ədəd"),
                            "cat_slug": sel_prod["cat_slug"],
                        })
                    st.rerun()
            else:
                st.info("Axtarışa uyğun məhsul tapılmadı.")

        # Display Current Basket Table
        if not st.session_state.basket:
            st.info("Səbətiniz boşdur. Yuxarıdakı şablonlardan birini seçin və ya məhsul əlavə edin.")
        else:
            st.markdown(f"**Səbətdəki Məhsullar ({len(st.session_state.basket)} növ):**")
            for idx, item in enumerate(st.session_state.basket):
                c_name, c_minus, c_qty, c_plus, c_del = st.columns([3, 0.6, 1.2, 0.6, 0.6])
                unit_label = "kq" if item.get("unit") == "kg" else "ədəd"
                step = 0.5 if item.get("unit") == "kg" else 1.0
                min_val = 0.5 if item.get("unit") == "kg" else 1.0

                with c_name:
                    st.markdown(f"**{item['canonical_name']}**")
                with c_minus:
                    if st.button("➖", key=f"minus_{idx}"):
                        if item["quantity"] > min_val:
                            item["quantity"] = round(item["quantity"] - step, 1)
                            st.rerun()
                with c_qty:
                    st.markdown(f"<div style='text-align: center; padding-top: 6px; font-weight: 700;'>{item['quantity']} {unit_label}</div>", unsafe_allow_html=True)
                with c_plus:
                    if st.button("➕", key=f"plus_{idx}"):
                        item["quantity"] = round(item["quantity"] + step, 1)
                        st.rerun()
                with c_del:
                    if st.button("🗑️", key=f"del_{idx}"):
                        st.session_state.basket.pop(idx)
                        st.rerun()

            if st.button("Səbəti Təmizlə", key="clear_basket_btn", use_container_width=True):
                st.session_state.basket = []
                st.rerun()

    # Right Column: Optimization Output
    with col_optimizer_view:
        st.markdown("### ⚡ Ağıllı Səbət Nəticəsi")

        if not st.session_state.basket:
            st.info("Zəhmət olmasa, optimallaşdırma aparmaq üçün səbətinizə məhsul əlavə edin.")
        else:
            opt_res = run_basket_optimization(
                st.session_state.basket,
                user_coords=user_coords,
                max_walking_m=float(max_walking_dist),
            )

            single = opt_res["single"]
            split = opt_res["split"]
            is_split_viable = opt_res["is_split_viable"]

            if not single:
                st.warning("Seçilmiş ərazidə bu məhsulları tam əhatə edən market tapılmadı. Zəhmət olmasa radiusu artırın.")
            else:
                # Top metrics banner
                single_cost = single["total_cost"]
                split_cost = split["total_cost"] if (split and is_split_viable) else single_cost
                savings_azn = split["savings_azn"] if (split and is_split_viable) else 0.0
                savings_pct = split["savings_pct"] if (split and is_split_viable) else 0.0

                m_col1, m_col2, m_col3 = st.columns(3)
                with m_col1:
                    st.metric(
                        label="🏪 Tək Ən Ucuz Market",
                        value=f"{single_cost:.2f} ₼",
                        delta=f"{single['branch_name']}",
                        delta_color="off",
                    )
                with m_col2:
                    st.metric(
                        label="⚡ Ağıllı Səbət (2-Market)",
                        value=f"{split_cost:.2f} ₼",
                        delta=f"-{savings_azn:.2f} ₼ ({savings_pct}%)" if is_split_viable else "Eyni qiymət",
                        delta_color="normal" if is_split_viable else "off",
                    )
                with m_col3:
                    walk_m = split["walking_meters"] if (split and is_split_viable) else 0
                    walk_min = round(walk_m / 80)  # ~80 meters/minute
                    st.metric(
                        label="🚶 Gəzinti Məsafəsi",
                        value=f"{walk_m} m" if is_split_viable else "0 m",
                        delta=f"~{walk_min} dəqiqə piyada" if is_split_viable else "Tək market",
                        delta_color="off",
                    )

                st.markdown("---")

                # Comparison Cards Side by Side
                card_col1, card_col2 = st.columns(2)

                with card_col1:
                    st.markdown(
                        f"""
                        <div class="store-card" style="border-top: 4px solid {single['chain_color']};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span class="store-badge" style="background: {single['chain_color']};">{single['chain_name']}</span>
                                <span style="font-size: 12px; color: #64748b;">📍 {single['distance_km']} km məsafə</span>
                            </div>
                            <h4 style="margin: 0 0 4px 0;">{single['branch_name']}</h4>
                            <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">{single['address']}</p>
                            <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">
                                Cəmi: {single['total_cost']:.2f} ₼
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
                    with st.expander("Məhsul siyahısı (Tək Market)", expanded=False):
                        single_df = pd.DataFrame([
                            {
                                "Məhsul": it["name"],
                                "Miqdar": f"{it['quantity']} {it.get('unit', '')}",
                                "Qiymət": f"{it['unit_price']:.2f} ₼",
                                "Məbləğ": f"{it['total']:.2f} ₼",
                            }
                            for it in single["items"]
                        ])
                        st.dataframe(single_df, hide_index=True, use_container_width=True)

                with card_col2:
                    if is_split_viable and split:
                        s1 = split["s1"]
                        s2 = split["s2"]
                        st.markdown(
                            f"""
                            <div class="store-card" style="border-top: 4px solid #10b981; background: #f0fdf4;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span class="savings-badge">✨ {split['savings_azn']:.2f} ₼ Qənaət ({split['savings_pct']}%)</span>
                                    <span style="font-size: 12px; color: #15803d; font-weight: 700;">🚶 {split['walking_meters']}m aralı</span>
                                </div>
                                <h4 style="margin: 0 0 4px 0; color: #166534;">1. {s1['branch_name']} + 2. {s2['branch_name']}</h4>
                                <div style="font-size: 20px; font-weight: 800; color: #15803d; margin-bottom: 12px;">
                                    Cəmi: {split['total_cost']:.2f} ₼ <span style="font-size: 14px; text-decoration: line-through; color: #94a3b8;">{single['total_cost']:.2f} ₼</span>
                                </div>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )

                        with st.expander(f"🛒 1-ci Market: {s1['branch_name']} ({len(split['s1_items'])} məhsul)", expanded=True):
                            s1_df = pd.DataFrame([
                                {
                                    "Məhsul": it["name"],
                                    "Say/Çəki": f"{it['quantity']} {it.get('unit', '')}",
                                    "Qiymət": f"{it['unit_price']:.2f} ₼",
                                    "Məbləğ": f"{it['total']:.2f} ₼",
                                }
                                for it in split["s1_items"]
                            ])
                            st.dataframe(s1_df, hide_index=True, use_container_width=True)

                        with st.expander(f"🛒 2-ci Market: {s2['branch_name']} ({len(split['s2_items'])} məhsul)", expanded=True):
                            s2_df = pd.DataFrame([
                                {
                                    "Məhsul": it["name"],
                                    "Say/Çəki": f"{it['quantity']} {it.get('unit', '')}",
                                    "Qiymət": f"{it['unit_price']:.2f} ₼",
                                    "Məbləğ": f"{it['total']:.2f} ₼",
                                }
                                for it in split["s2_items"]
                            ])
                            st.dataframe(s2_df, hide_index=True, use_container_width=True)
                    else:
                        st.info("ℹ️ Seçilmiş piyada radiusunda qiymət fərqi 0.15 ₼-dən az olduğu üçün tək marketdən alış-veriş etmək ən optimal qərardır.")


# =============================================================================
# TAB 2: QİYMƏT MÜQAYİSƏSİ (PRICE COMPARISON MATRIX)
# =============================================================================
with tab_comparison:
    st.markdown("### 🔍 Bakı Supermarketlərində Canlı Qiymətlər")
    st.markdown("7 böyük supermarket şəbəkəsində cari rəf qiymətləri və endirim kampaniyaları.")

    col_cat, col_srch = st.columns([1, 2])
    with col_cat:
        cat_options = ["Bütün Kateqoriyalar"] + [c["name_az"] for c in CATEGORIES.values()]
        selected_cat_name = st.selectbox("Kateqoriya üzrə filtr:", cat_options)

    with col_srch:
        search_query = st.text_input("Açar sözlə axtarış (məs: Süd, Yağ, Çay, Ariel...):", value="")

    # Filter products
    filtered_products = PRODUCTS
    if selected_cat_name != "Bütün Kateqoriyalar":
        matching_slug = next((c["slug"] for c in CATEGORIES.values() if c["name_az"] == selected_cat_name), None)
        if matching_slug:
            filtered_products = [p for p in filtered_products if p["cat_slug"] == matching_slug]

    if search_query:
        q = search_query.lower()
        filtered_products = [p for p in filtered_products if q in p["canonical_name"].lower() or q in p["brand"].lower()]

    st.markdown(f"**Göstərilir: {len(filtered_products)} məhsul**")

    # Build Comparison DataFrame
    chain_keys = ["bravo", "araz", "oba", "bazarstore", "almarket", "neptun", "spar"]
    chain_headers = {
        "bravo": "Bravo",
        "araz": "Araz",
        "oba": "OBA",
        "bazarstore": "Bazarstore",
        "almarket": "Al Market",
        "neptun": "Neptun",
        "spar": "Spar",
    }

    matrix_rows = []
    for p in filtered_products:
        row = {
            "Məhsul": p["canonical_name"],
            "Qablaşdırma": p.get("pack_size", "-"),
            "Kateqoriya": CATEGORIES.get(p["cat_slug"], {}).get("name_az", p["cat_slug"]),
        }
        prices = [get_effective_price(p, c_key) for c_key in chain_keys]
        min_p = min(prices)
        row["Ən Ucuz (₼)"] = f"{min_p:.2f} ₼"

        for c_key in chain_keys:
            eff_p = get_effective_price(p, c_key)
            diff = eff_p - min_p
            label = f"{eff_p:.2f} ₼"
            if diff == 0:
                label += " ⭐"
            row[chain_headers[c_key]] = label
        matrix_rows.append(row)

    if matrix_rows:
        matrix_df = pd.DataFrame(matrix_rows)
        st.dataframe(matrix_df, use_container_width=True, height=420)
    else:
        st.info("Axtarışa uyğun məhsul tapılmadı.")

    st.markdown("---")
    st.markdown("#### 📊 Tək Məhsul üzrə Dərin Müqayisə Qrafiki")
    chart_prod_names = [f"{p['canonical_name']} ({p.get('pack_size', '')})" for p in filtered_products]
    if chart_prod_names:
        chart_sel_idx = st.selectbox("Müqayisə ediləcək məhsulu seçin:", range(len(filtered_products)), format_func=lambda i: chart_prod_names[i])
        chart_p = filtered_products[chart_sel_idx]

        chart_data = []
        for c_key in chain_keys:
            p_val = get_effective_price(chart_p, c_key)
            is_promo = (chart_p.get("promo") and chart_p["promo"].get("chain") == c_key)
            chart_data.append({
                "Şəbəkə": chain_headers[c_key],
                "Qiymət (₼)": p_val,
                "Rəng": CHAINS[c_key].get("color", "#10b981"),
                "Kampaniya": "Endirimli Qiymət 🔥" if is_promo else "Standart Qiymət",
            })
        chart_df = pd.DataFrame(chart_data)

        min_val = chart_df["Qiymət (₼)"].min()
        max_val = chart_df["Qiymət (₼)"].max()
        spread_pct = round(((max_val - min_val) / min_val) * 100, 1)

        c_img, c_chart = st.columns([1, 2.5])
        with c_img:
            img_path = f"frontend/public{chart_p.get('image_url', '')}"
            if os.path.exists(img_path):
                st.image(img_path, caption=chart_p["canonical_name"], use_container_width=True)
            elif chart_p.get("image_url", "").startswith("http"):
                st.image(chart_p["image_url"], caption=chart_p["canonical_name"], use_container_width=True)
            else:
                st.markdown(f"### 🛒\n**{chart_p['canonical_name']}**")
            st.metric(
                label="Maksimum Qiymət Fərqi",
                value=f"+{max_val - min_val:.2f} ₼",
                delta=f"{spread_pct}% fərq",
                delta_color="inverse",
            )

        with c_chart:
            fig_bar = px.bar(
                chart_df,
                x="Şəbəkə",
                y="Qiymət (₼)",
                color="Şəbəkə",
                color_discrete_map={row["Şəbəkə"]: row["Rəng"] for _, row in chart_df.iterrows()},
                text="Qiymət (₼)",
                title=f"{chart_p['canonical_name']} — Şəbəkələr üzrə Qiymət Dağılımı",
            )
            fig_bar.update_traces(texttemplate='%{text:.2f} ₼', textposition='outside')
            fig_bar.update_layout(
                yaxis_range=[0, max_val * 1.2],
                showlegend=False,
                margin=dict(t=40, b=20, l=20, r=20),
            )
            st.plotly_chart(fig_bar, use_container_width=True)


# =============================================================================
# TAB 3: BAZAR ANALİTİKASI (MARKET ANALYTICS)
# TAB 3: HƏFTƏLİK BUKLETLƏR (WEEKLY FLYERS)
# =============================================================================
with tab_flyers:
    st.markdown("### 📰 Bakı Supermarketlərinin Həftəlik Endirim Bukletləri")
    st.markdown("Bravo, Araz, OBA və Bazarstore-un rəsmi çap olunmuş və rəqəmsal kataloqları.")

    flyer_cols = st.columns(3)
    sample_flyers = [
        {
            "chain": "Bravo",
            "title": "Bravo Hypermarket Həftənin Fürsətləri",
            "dates": "10 Sentyabr - 23 Sentyabr 2026",
            "color": "#74b826",
            "discount": "40%-dək",
            "highlights": ["Ariel 7kg - 21.99 ₼", "Westgold Kərə Yağı - 3.89 ₼", "Final Yağ 5L - 14.50 ₼"],
        },
        {
            "chain": "Araz",
            "title": "Araz Supermarket Qənaət Festivalı",
            "dates": "12 Sentyabr - 20 Sentyabr 2026",
            "color": "#E30613",
            "discount": "35%-dək",
            "highlights": ["Milla Süd 1L - 2.19 ₼", "Bizim Tarla Basmati Düyü - 3.99 ₼", "Azərçay Buket 250g - 4.10 ₼"],
        },
        {
            "chain": "OBA",
            "title": "OBA Market Cibinizə Qənaət Bukleti",
            "dates": "08 Sentyabr - 22 Sentyabr 2026",
            "color": "#009640",
            "discount": "50%-dək",
            "highlights": ["Milla Qatıq 1kg - 2.25 ₼", "Gədəbəy Kartofu 1kq - 0.79 ₼", "Sirab 1.5L - 0.75 ₼"],
        },
    ]

    for idx, fl in enumerate(sample_flyers):
        with flyer_cols[idx % 3]:
            st.markdown(
                f"""
                <div class="store-card" style="border-top: 4px solid {fl['color']}; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="store-badge" style="background: {fl['color']};">{fl['chain']}</span>
                        <span class="promo-tag">🔥 {fl['discount']}</span>
                    </div>
                    <h4 style="margin: 4px 0 2px 0;">{fl['title']}</h4>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">📅 {fl['dates']}</p>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Seçilmiş Təkliflər:</div>
                        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #1e293b;">
                            {''.join(f'<li>{h}</li>' for h in fl['highlights'])}
                        </ul>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
            if st.button(f"📄 Bukletə Bax ({fl['chain']})", key=f"flyer_btn_{idx}", use_container_width=True):
                st.success(f"{fl['chain']} bukletindəki bütün endirimlər qiymət bazamıza daxil edilib.")


# =============================================================================
# TAB 4: QƏBZ SKANI & KEŞBEK (RECEIPT OCR SIMULATOR)
# =============================================================================
with tab_scan:
    st.markdown("### 🧾 Elektron Kassa Qəbzlərinin Skanı & Keşbek")
    st.markdown("Supermarket qəbzlərini skan edərək xərclədiyiniz məbləğdən avtomatik **1% - 2% Sebet xalı (keşbek)** qazanın.")

    c_sc1, c_sc2 = st.columns([1.1, 1], gap="large")

    SAMPLE_RECEIPTS = [
        {
            "id": "rec_bravo",
            "store": "Bravo 28 Mall",
            "chain": "Bravo",
            "color": "#74b826",
            "voen": "1401564751",
            "fiscal_id": "AZ14015647510101-92810",
            "date": "2026-09-14 17:42",
            "total": 24.65,
            "cashback": 25,
            "items": [
                {"name": "Milla Süd 2.5% 1L", "price": 2.39, "qty": 2},
                {"name": "Westgold Kərə Yağı 200g", "price": 3.95, "qty": 1},
                {"name": "Ariel Yuyucu Toz 3kg", "price": 15.92, "qty": 1},
            ],
        },
        {
            "id": "rec_araz",
            "store": "Araz Nərimanov",
            "chain": "Araz",
            "color": "#E30613",
            "voen": "1500843211",
            "fiscal_id": "AZ15008432110202-44129",
            "date": "2026-09-15 11:20",
            "total": 14.85,
            "cashback": 15,
            "items": [
                {"name": "Zavod Çörəyi 500g", "price": 0.65, "qty": 2},
                {"name": "Mərcan Toyuq 1kq", "price": 5.95, "qty": 1.5},
                {"name": "Azərçay Buket 250g", "price": 4.60, "qty": 1},
            ],
        },
        {
            "id": "rec_oba",
            "store": "OBA Yasamal",
            "chain": "OBA",
            "color": "#009640",
            "voen": "1701928374",
            "fiscal_id": "AZ17019283740303-10294",
            "date": "2026-09-15 20:05",
            "total": 9.40,
            "cashback": 10,
            "items": [
                {"name": "Milla Qatıq 1kg", "price": 2.35, "qty": 1},
                {"name": "Gədəbəy Kartofu 1kq", "price": 0.85, "qty": 2.5},
                {"name": "Sirab Mineral Su 1.5L", "price": 0.80, "qty": 2},
            ],
        },
    ]

    if "active_rec_idx" not in st.session_state:
        st.session_state.active_rec_idx = 0

    with c_sc1:
        st.markdown("#### 📸 Qəbz Seçimi və Skan")

        # Fast 1-click sample selector pills
        st.markdown("<div style='font-size: 13px; font-weight: 600; margin-bottom: 6px;'>Sürətli Nümunə Qəbzlər:</div>", unsafe_allow_html=True)
        btn_cols = st.columns(3)
        for b_idx, s_rec in enumerate(SAMPLE_RECEIPTS):
            with btn_cols[b_idx]:
                if st.button(f"{s_rec['chain']}\n{s_rec['total']:.2f} ₼", key=f"quick_rec_{b_idx}", use_container_width=True):
                    st.session_state.active_rec_idx = b_idx
                    st.session_state["scanned_receipt"] = s_rec

        active_rec = SAMPLE_RECEIPTS[st.session_state.active_rec_idx]

        st.markdown("---")
        upload_tab1, upload_tab2 = st.tabs(["📁 Şəkil Yüklə", "📷 Kamera ilə Çək"])
        with upload_tab1:
            up_file = st.file_uploader("Qəbzin fotosunu seçin (JPG/PNG):", type=["jpg", "jpeg", "png"], key="rec_uploader")
            if up_file:
                st.image(up_file, caption="Yüklənmiş Qəbz", width=220)
        with upload_tab2:
            cam_pic = st.camera_input("Kamera ilə qəbzin fotosunu çəkin:", key="rec_cam")
            if cam_pic:
                st.image(cam_pic, caption="Çəkilmiş Qəbz", width=220)

        if st.button("🚀 Qəbzi OCR Skan Et & Keşbek Qazan", key="scan_receipt_btn", type="primary", use_container_width=True):
            with st.spinner("🔍 Qəbz OCR mühərriki işə salınır, fiskal şifrə və VÖEN oxunur..."):
                time.sleep(0.4)
            st.session_state["scanned_receipt"] = active_rec
            st.session_state.points = st.session_state.get("points", 250) + active_rec["cashback"]
            st.success(f"🎉 Qəbz təsdiqləndi! +{active_rec['cashback']} Sebet xalı balansınıza əlavə edildi.")
            st.toast(f"+{active_rec['cashback']} Sebet Xalı qazanıldı!")

    with c_sc2:
        st.markdown("#### 📑 Tanınmış E-Kassa Qəbzi")
        rec_data = st.session_state.get("scanned_receipt", active_rec)

        rec_bg = "#1e293b" if dark_mode else "#ffffff"
        rec_border = "#475569" if dark_mode else "#cbd5e1"
        rec_text = "#f8fafc" if dark_mode else "#0f172a"
        rec_sub = "#94a3b8" if dark_mode else "#64748b"

        items_html = "".join([
            f"<div style='display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; color:{rec_text};'>"
            f"<span>{it['name']} x{it['qty']}</span>"
            f"<span style='font-weight:700;'>{(it['price']*it['qty']):.2f} ₼</span>"
            f"</div>"
            for it in rec_data['items']
        ])

        st.markdown(
            f"""
            <div style="background: {rec_bg}; border: 2px dashed {rec_border}; border-radius: 14px; padding: 22px; font-family: 'Courier New', Courier, monospace; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <div style="text-align: center; font-size: 11px; letter-spacing: 0.1em; color: {rec_sub}; margin-bottom: 2px;">AZƏRBAYCAN RESPUBLİKASI DVX</div>
                <div style="text-align: center; font-weight: 800; font-size: 16px; margin-bottom: 4px; color: {rec_text};">{rec_data['store'].upper()}</div>
                <div style="text-align: center; font-size: 11px; color: {rec_sub}; margin-bottom: 12px;">VÖEN: {rec_data['voen']}</div>
                <div style="border-top: 1px dashed {rec_border}; margin-bottom: 12px;"></div>
                <div style="font-size: 11px; color: {rec_sub}; margin-bottom: 4px;">Fiskal İD: <b style="color: {rec_text};">{rec_data['fiscal_id']}</b></div>
                <div style="font-size: 11px; color: {rec_sub}; margin-bottom: 12px;">Tarix/Saat: <b style="color: {rec_text};">{rec_data['date']}</b></div>
                <div style="border-top: 1px dashed {rec_border}; margin-bottom: 12px;"></div>
                <div style="font-size: 11px; font-weight: 700; color: {rec_sub}; margin-bottom: 6px;">MƏHSUL / ÇƏKİ & SAY / MƏBLƏĞ:</div>
                {items_html}
                <div style="border-top: 2px dashed {rec_border}; margin: 14px 0 10px 0;"></div>
                <div style="display:flex; justify-content:space-between; font-weight:800; font-size:17px; color: {rec_text};">
                    <span>YEKUN:</span>
                    <span style="color: #10b981;">{rec_data['total']:.2f} ₼</span>
                </div>
                <div style="text-align: center; font-size: 11px; color: {rec_sub}; margin-top: 8px;">ƏDV DÖVLƏT BÜDCƏSİNƏ ÖDƏNİLMİŞDİR</div>
                <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; padding: 10px; border-radius: 8px; font-weight: 800; font-size: 13px; text-align: center; margin-top: 14px;">
                    ✨ Qazanılan Keşbek: +{rec_data['cashback']} Sebet Xalı (= {rec_data['cashback']/100:.2f} ₼)
                </div>
                <div style="text-align: center; margin-top: 12px; font-size: 18px; letter-spacing: 4px; color: {rec_sub};">
                    ||| | |||| || ||||| | |||
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


# =============================================================================
# TAB 5: BAZAR ANALİTİKASI (MARKET ANALYTICS)
# =============================================================================
with tab_analytics:
    st.markdown("### 📊 Bakı Ərzaq Bazarının Analitik Göstəriciləri")

    col_an1, col_an2 = st.columns(2)

    with col_an1:
        st.markdown("#### 🏆 Şəbəkələrin Qiymət İndeksi (Ucuzluq Reytinqi)")
        # Calculate aggregate basket cost across all 53 products
        chain_totals = []
        for c_key in chain_keys:
            tot = sum(get_effective_price(p, c_key) for p in PRODUCTS)
            chain_totals.append({
                "Şəbəkə": chain_headers[c_key],
                "Ümumi Səbət Dəyəri (₼)": round(tot, 2),
                "Rəng": CHAINS[c_key].get("color", "#10b981"),
            })
        totals_df = pd.DataFrame(chain_totals).sort_values("Ümumi Səbət Dəyəri (₼)")
        base_min = totals_df["Ümumi Səbət Dəyəri (₼)"].min()
        totals_df["İndeks (%)"] = totals_df["Ümumi Səbət Dəyəri (₼)"].apply(lambda x: round((x / base_min) * 100, 1))

        fig_index = px.bar(
            totals_df,
            x="Şəbəkə",
            y="Ümumi Səbət Dəyəri (₼)",
            color="Şəbəkə",
            color_discrete_map={r["Şəbəkə"]: r["Rəng"] for _, r in totals_df.iterrows()},
            text="Ümumi Səbət Dəyəri (₼)",
        )
        fig_index.update_traces(texttemplate='%{text:.2f} ₼', textposition='outside')
        fig_index.update_layout(showlegend=False, yaxis_range=[0, totals_df["Ümumi Səbət Dəyəri (₼)"].max() * 1.15])
        st.plotly_chart(fig_index, use_container_width=True)

    with col_an2:
        st.markdown("#### 📍 Bakı & Regionlar üzrə Market Şəbəkəsi (53 Filial)")
        store_map_df = pd.DataFrame([
            {
                "Filial": s["branch_name"],
                "Şəbəkə": s["chain_slug"].title(),
                "Ərazi": s["neighborhood"],
                "lat": s["latitude"],
                "lon": s["longitude"],
            }
            for s in STORES
        ])
        render_map(
            store_map_df,
            lat="lat",
            lon="lon",
            color="Şəbəkə",
            hover_name="Filial",
            hover_data=["Ərazi"],
            zoom=10.5,
            height=370,
        )

    st.markdown("---")
    st.markdown("#### ⚡ Ən Böyük Qiymət Fərqi Olan Top 5 Məhsul")
    dispersion_list = []
    for p in PRODUCTS:
        all_prices = [get_effective_price(p, c_key) for c_key in chain_keys]
        p_min = min(all_prices)
        p_max = max(all_prices)
        spread = p_max - p_min
        spread_pct = round((spread / p_min) * 100, 1)
        dispersion_list.append({
            "Məhsul": p["canonical_name"],
            "Ən Aşağı Qiymət": f"{p_min:.2f} ₼",
            "Ən Yuxarı Qiymət": f"{p_max:.2f} ₼",
            "Fərq (₼)": round(spread, 2),
            "Fərq (%)": spread_pct,
        })
    disp_df = pd.DataFrame(dispersion_list).sort_values("Fərq (%)", ascending=False).head(5)
    st.dataframe(disp_df, hide_index=True, use_container_width=True)


# =============================================================================
# TAB 4: LOYALLIQ & RETAIL MEDIA (CASHBACK & BRAND BOOST)
# =============================================================================
with tab_loyalty:
    st.markdown("### 🎁 Sebet Loyallıq & Retail Media Şəbəkəsi")
    st.markdown("İstehlakçılar üçün avtomatlaşdırılmış keşbek və FMCG brendləri üçün rəqəmsal reklam platforması.")

    col_user, col_media = st.columns(2, gap="large")

    with col_user:
        st.markdown("#### 💳 İstifadəçi Keşbek Balansı")
        st.markdown(
            """
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">SEBET PLATINUM CARD</div>
                <div style="font-size: 28px; font-weight: 800; margin: 12px 0 4px 0; color: #10b981;">250 Xal</div>
                <div style="font-size: 14px; color: #cbd5e1;">Real Dəyəri: <b>2.50 AZN</b> Keşbek</div>
                <div style="margin-top: 20px; font-size: 12px; color: #64748b; font-family: monospace;">•••• •••• •••• 4892</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<br/>", unsafe_allow_html=True)
        st.markdown("##### 🎟️ Xalları Endirim Vayçerinə Çevir")
        voucher_pts = st.slider("İstifadə ediləcək xal miqdarı:", min_value=50, max_value=250, value=100, step=50)
        voucher_val = voucher_pts / 100.0

        if st.button("Endirim Barkodu Yarat", key="create_voucher_btn", type="primary", use_container_width=True):
            st.success(f"Təbriklər! {voucher_val:.2f} AZN dəyərində vayçer aktivləşdirildi.")
            st.code(f"SEBET-AZN-{voucher_val:.2f}-PROMO-8291", language="bash")
            st.caption("Bu barkodu Bravo, Araz və ya OBA kassasında skan edərək dərhal endirim əldə edə bilərsiniz.")

    with col_media:
        st.markdown("#### 📣 FMCG Retail Media & Brand Boost")
        st.markdown("Milla, Westgold, Ariel kimi qlobal və yerli brendlərin xüsusi təklifləri:")

        st.markdown(
            """
            <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 12px;">
                <div style="font-weight: 700; color: #b45309;">🌟 Westgold 82.5% Kərə Yağı — 2x Keşbek</div>
                <div style="font-size: 13px; color: #78350f;">Bu həftə Westgold kərə yağı alan istifadəçilərə hər qutuda <b>+40 Sebet xalı</b> hədiyyə!</div>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #dcfce7; padding: 16px; border-radius: 12px; margin-bottom: 12px;">
                <div style="font-weight: 700; color: #15803d;">🥛 Milla Süd Məhsulları Kampaniyası</div>
                <div style="font-size: 13px; color: #166534;">Səbətinizə 3 ədəd Milla məhsulu əlavə etdikdə avtomatik <b>0.50 AZN dərhal endirim</b> tətbiq olunur.</div>
            </div>
            <div style="background: #eff6ff; border: 1px solid #dbeafe; padding: 16px; border-radius: 12px;">
                <div style="font-weight: 700; color: #1d4ed8;">🧺 Ariel Yuyucu Toz 7kg Eko-Paket</div>
                <div style="font-size: 13px; color: #1e40af;">Həftənin seçilmiş təmizlik məhsulu. Bravo və Bazarstore filiallarında xüsusi qiymət zəmanəti.</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


# =============================================================================
# TAB 5: TEXNİKİ MEMARLIQ & HAQQINDA
# =============================================================================
with tab_about:
    st.markdown("### ℹ️ SebEt Platforması & Texniki Memarlıq")
    st.markdown(
        """
        **SebEt (Ağıllı Səbət)** — Bakı şəhəri üzrə supermarketlərdə ərzaq qiymətlərinin qeyri-şəffaflığını və qiymət dispersiyasını həll edən süni intellekt əsaslı ərzaq kəşfiyyatı və qənaət platformasıdır.

        ---

        #### 🏗️ Sistem Memarlığı
        - **Frontend**: Next.js 15 (App Router, Tailwind CSS, TypeScript, Zustand, Lucide Icons, PWA).
        - **Backend & Alqoritmlər**: FastAPI (Python 3.14), SQLAlchemy, Pydantic, Geopy haversine coğrafi məsafə hesablama motoru.
        - **Ağıllı Səbət Alqoritmi**: Tək ən ucuz market (baseline) və istifadəçinin piyada getmə radiusunda (məs: 750m) 2 market arasında optimal məhsul bölgüsü (split optimization).
        - **Məlumat Mənbələri**: Həftəlik market bukletləri (flyers), elektron qəbzlər (e-kassa OCR) və supermarket e-ticarət qiymət skreyperləri.
        - **İnteraktiv Streamlit Tətbiqi**: Streamlit Community Cloud vasitəsilə 100% serverless və buludda işləyən nümayiş portalı.

        ---

        #### 🔗 Faydalı Keçidlər
        - **GitHub Repository**: [Ali0lo/Sebet](https://github.com/Ali0lo/Sebet)
        - **Əsas Veb Tətbiq**: Next.js 15 PWA (`frontend/`)
        """
    )

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: #94a3b8; font-size: 13px;'>© 2026 SebEt Baku Grocery Intelligence. Bütün hüquqlar qorunur.</div>",
    unsafe_allow_html=True,
)

