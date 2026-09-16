"""
SebEt — Bakı Supermarket Qiymət Müqayisəsi & Ağıllı Səbət Optimizatoru
Streamlit Cloud Interactive Web Application
"""

import math
import os
import time
import textwrap
from typing import List, Dict, Any, Tuple
import urllib.parse
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

try:
    from streamlit_js_eval import get_geolocation
    HAS_GEO = True
except ImportError:
    HAS_GEO = False

import sebet_data
import user_db

# Initialize SQLite user database
user_db.init_user_db()

if "user_authenticated" not in st.session_state:
    st.session_state.user_authenticated = False
if "current_user" not in st.session_state:
    st.session_state.current_user = None

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

# Dark Mode State (checked early from session state, default to True)
dark_mode = bool(st.session_state.get("dark_mode_toggle", True))

# Shared Theme Variables
card_bg = "#1e293b" if dark_mode else "#ffffff"
card_border = "#334155" if dark_mode else "#e2e8f0"
card_text = "#f8fafc" if dark_mode else "#0f172a"
sub_text = "#94a3b8" if dark_mode else "#64748b"

if dark_mode:
    custom_css = """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :root, [data-testid="stAppViewContainer"], .stApp {
        --text-color: #f8fafc !important;
        --background-color: #0b1120 !important;
        --secondary-background-color: #1e293b !important;
        --primary-color: #10b981 !important;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    html, body, [class*="css"], .stApp {
        background-color: #0b1120 !important;
        color: #f8fafc !important;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    [data-testid="stAppViewContainer"] {
        background-color: #0b1120 !important;
        color: #f8fafc !important;
    }

    [data-testid="stHeader"] {
        background-color: rgba(11, 17, 32, 0.95) !important;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #0f172a !important;
        border-right: 1px solid #1e293b !important;
    }
    section[data-testid="stSidebar"] * {
        color: #f8fafc;
    }
    section[data-testid="stSidebar"] label,
    section[data-testid="stSidebar"] [data-testid="stWidgetLabel"] p,
    section[data-testid="stSidebar"] [data-testid="stWidgetLabel"] span {
        color: #cbd5e1 !important;
        font-weight: 600 !important;
    }

    /* Headings & Text */
    h1, h2, h3, h4, h5, h6 {
        color: #f8fafc !important;
    }
    p, span, label, li {
        color: #e2e8f0;
    }
    .stMarkdown, .stMarkdown p, .stMarkdown span, .stMarkdown li, .stMarkdown strong {
        color: #f1f5f9 !important;
    }
    .stMarkdown h1, .stMarkdown h2, .stMarkdown h3, .stMarkdown h4, .stMarkdown h5, .stMarkdown h6 {
        color: #f8fafc !important;
    }
    .stCaption, [data-testid="stCaptionContainer"] p {
        color: #94a3b8 !important;
    }

    /* Widget Labels */
    label[data-testid="stWidgetLabel"],
    label[data-testid="stWidgetLabel"] p,
    label[data-testid="stWidgetLabel"] span {
        color: #f8fafc !important;
        font-weight: 600 !important;
    }

    /* Tabs Styling */
    button[data-baseweb="tab"] {
        background-color: transparent !important;
        border: none !important;
        border-bottom: 2px solid transparent !important;
        box-shadow: none !important;
    }
    button[data-baseweb="tab"] p,
    button[data-baseweb="tab"] div,
    button[data-baseweb="tab"] span {
        color: #94a3b8 !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        background-color: transparent !important;
    }
    button[data-baseweb="tab"]:hover p,
    button[data-baseweb="tab"]:hover span {
        color: #34d399 !important;
    }
    button[data-baseweb="tab"][aria-selected="true"] {
        border-bottom: 2px solid #10b981 !important;
    }
    button[data-baseweb="tab"][aria-selected="true"] p,
    button[data-baseweb="tab"][aria-selected="true"] span {
        color: #10b981 !important;
        font-weight: 700 !important;
    }
    div[data-baseweb="tab-highlight"] {
        background-color: #10b981 !important;
    }
    div[data-baseweb="tab-border"] {
        background-color: #334155 !important;
    }

    /* Inputs & Form Controls */
    input, textarea, [data-baseweb="input"], [data-baseweb="input"] input {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border-color: #475569 !important;
        -webkit-text-fill-color: #f8fafc !important;
    }
    input::placeholder, textarea::placeholder {
        color: #64748b !important;
        -webkit-text-fill-color: #64748b !important;
    }

    /* Selectbox */
    div[data-baseweb="select"] {
        background-color: #1e293b !important;
        border-color: #475569 !important;
    }
    div[data-baseweb="select"] * {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }
    div[data-baseweb="select"] svg {
        fill: #f8fafc !important;
    }

    /* Selectbox Dropdown Menu (Popover) */
    div[data-baseweb="popover"],
    ul[data-baseweb="menu"],
    ul[role="listbox"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border: 1px solid #334155 !important;
    }
    li[role="option"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }
    li[role="option"]:hover,
    li[aria-selected="true"] {
        background-color: #334155 !important;
        color: #34d399 !important;
    }
    li[role="option"] * {
        color: inherit !important;
    }

    /* Secondary Buttons */
    .stButton > button:not([kind="primary"]),
    button[data-testid*="stBaseButton-secondary"],
    button[kind="secondary"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border: 1px solid #475569 !important;
        box-shadow: none !important;
    }
    .stButton > button:not([kind="primary"]):hover,
    button[data-testid*="stBaseButton-secondary"]:hover,
    button[kind="secondary"]:hover {
        background-color: #334155 !important;
        border-color: #10b981 !important;
        color: #34d399 !important;
    }
    .stButton > button:not([kind="primary"]) *,
    button[data-testid*="stBaseButton-secondary"] *,
    button[kind="secondary"] * {
        color: inherit !important;
        background-color: transparent !important;
    }

    /* Number Input Stepper (+ / -) Buttons */
    div[data-testid="stNumberInput"] button,
    div[data-testid="stNumberInput"] [data-testid*="Button"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border: 1px solid #475569 !important;
    }
    div[data-testid="stNumberInput"] button:hover {
        background-color: #334155 !important;
        border-color: #10b981 !important;
        color: #34d399 !important;
    }

    /* Primary Buttons Override */
    .stButton > button[kind="primary"],
    button[data-testid*="stBaseButton-primary"],
    button[kind="primary"] {
        background-color: #10b981 !important;
        color: #ffffff !important;
        border: 1px solid #10b981 !important;
    }
    .stButton > button[kind="primary"]:hover,
    button[data-testid*="stBaseButton-primary"]:hover,
    button[kind="primary"]:hover {
        background-color: #059669 !important;
        border-color: #059669 !important;
        color: #ffffff !important;
    }
    .stButton > button[kind="primary"] *,
    button[data-testid*="stBaseButton-primary"] *,
    button[kind="primary"] * {
        color: #ffffff !important;
        background-color: transparent !important;
    }

    /* Tables & DataFrames (Glide Data Grid Container) */
    div[data-testid="stDataFrame"],
    div[data-testid="stDataFrameResizable"],
    .stDataFrameGlideDataEditor,
    .dvn-scroller,
    .dvn-stack,
    div[data-testid="stDataFrame"] > div {
        background-color: #1e293b !important;
        border-color: #334155 !important;
    }
    div[data-testid="stDataFrame"] [data-testid="stElementToolbar"] {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 6px !important;
    }
    div[data-testid="stDataFrame"] [data-testid="stElementToolbar"] button {
        background-color: transparent !important;
        border: none !important;
        color: #f8fafc !important;
    }
    div[data-testid="stDataFrame"] [data-testid="stElementToolbar"] button:hover {
        color: #34d399 !important;
    }
    div[data-testid="stDataFrameColumnMenu"],
    div[data-testid="stDataFrameColumnVisibilityMenu"],
    div[data-testid="stDataFrameStatisticsMenu"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border: 1px solid #334155 !important;
    }
    div[data-testid="stDataFrameColumnMenu"] *,
    div[data-testid="stDataFrameColumnVisibilityMenu"] *,
    div[data-testid="stDataFrameStatisticsMenu"] * {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }

    /* Native Streamlit Styled Tables (Dark Mode) */
    .stTable,
    div[data-testid="stTable"],
    table[data-testid="stTableStyledTable"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border-color: #334155 !important;
    }
    table[data-testid="stTableStyledTable"] th {
        background-color: #0f172a !important;
        color: #f8fafc !important;
        border: 1px solid #334155 !important;
        font-weight: 700 !important;
    }
    table[data-testid="stTableStyledTable"] td {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border: 1px solid #334155 !important;
    }
    table[data-testid="stTableStyledTable"] tbody tr:nth-of-type(even) td {
        background-color: #182338 !important;
    }

    /* Scoped Basket Table (Dark Mode) */
    .basket-breakdown-container {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 12px !important;
    }
    .basket-table {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }
    .basket-table th {
        background-color: #0f172a !important;
        color: #94a3b8 !important;
    }
    .basket-table td {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }

    /* Matrix Table (Dark Mode) */
    .matrix-table-container {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 12px !important;
    }
    .matrix-table {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }
    .matrix-table th {
        background-color: #0f172a !important;
        color: #94a3b8 !important;
    }
    .matrix-table td {
        background-color: #1e293b !important;
        color: #f8fafc !important;
    }

    /* Code Tags, Backticks & Code Blocks */
    code, kbd, samp, tt {
        background-color: #1e293b !important;
        color: #34d399 !important;
        border: 1px solid #334155 !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        font-family: monospace !important;
    }
    pre,
    pre code,
    div[data-testid="stCode"],
    div[data-testid="stCodeBlock"],
    div[data-testid="stCodeBlock"] pre,
    div[data-testid="stCodeBlock"] code {
        background-color: #0f172a !important;
        color: #34d399 !important;
        border: 1px solid #334155 !important;
        border-radius: 8px !important;
    }
    div[data-testid="stCodeBlock"] button {
        background-color: transparent !important;
        border: none !important;
        color: #94a3b8 !important;
    }

    /* File Uploader & Camera */
    div[data-testid="stFileUploader"],
    div[data-testid="stFileUploader"] section,
    div[data-testid="stFileUploader"] [data-testid="stFileUploaderDropzone"],
    div[data-testid="stCameraInput"] {
        background-color: #1e293b !important;
        border: 1px solid #475569 !important;
        color: #f8fafc !important;
    }
    div[data-testid="stFileUploader"] * {
        color: #f8fafc !important;
    }

    /* Dividers */
    hr {
        border-color: #334155 !important;
    }

    /* Expanders */
    div[data-testid="stExpander"] {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] details {
        background-color: #1e293b !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] summary {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] summary * {
        color: #f8fafc !important;
    }
    div[data-testid="stExpander"] summary:hover,
    div[data-testid="stExpander"] summary:hover * {
        color: #34d399 !important;
    }
    div[data-testid="stExpander"] summary svg {
        fill: #f8fafc !important;
    }
    div[data-testid="stExpander"] div[role="region"] {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border-top: 1px solid #334155 !important;
    }

    /* Metrics */
    div[data-testid="stMetric"] {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 14px !important;
        padding: 14px 16px !important;
    }
    div[data-testid="stMetricLabel"],
    div[data-testid="stMetricLabel"] * {
        color: #94a3b8 !important;
        font-size: 13px !important;
    }
    div[data-testid="stMetricValue"],
    div[data-testid="stMetricValue"] * {
        color: #34d399 !important;
        font-weight: 800 !important;
    }
    div[data-testid="stMetricDelta"],
    div[data-testid="stMetricDelta"] * {
        color: #94a3b8 !important;
    }

    /* Sliders */
    div[data-testid="stSlider"] div[role="slider"] {
        background-color: #10b981 !important;
    }
    div[data-testid="stSlider"] [data-testid="stTickBar"] div {
        color: #94a3b8 !important;
    }
    div[data-testid="stSlider"] [data-testid="stThumbValue"] {
        color: #f8fafc !important;
    }

    /* Cards & Badges */
    .store-card {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 16px;
        padding: 20px;
        color: #f8fafc !important;
    }
    .metric-card {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 16px;
        padding: 18px 20px;
        color: #f8fafc !important;
    }
    .store-card h4, .store-card h3, .store-card h2, .store-card p {
        color: #f8fafc !important;
    }
    .store-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        color: white !important;
    }
    .savings-badge {
        background: rgba(16, 185, 129, 0.25) !important;
        color: #34d399 !important;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 800;
        font-size: 14px;
        display: inline-block;
        border: 1px solid rgba(16, 185, 129, 0.4) !important;
    }
    .promo-tag {
        background: rgba(239, 68, 68, 0.2) !important;
        color: #f87171 !important;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid rgba(239, 68, 68, 0.3) !important;
    }

    /* Alerts */
    div[data-testid="stAlert"] {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        color: #f8fafc !important;
    }
    div[data-testid="stAlert"] * {
        color: #f8fafc !important;
    }

    /* Main Hero */
    .main-header {
        background: linear-gradient(135deg, #064e3b 0%, #047857 100%) !important;
        padding: 24px 32px;
        border-radius: 20px;
        color: white !important;
        margin-bottom: 24px;
        box-shadow: 0 10px 25px -5px rgba(4, 120, 87, 0.4) !important;
    }
    .main-header * {
        color: white !important;
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
        color: white !important;
    }
    </style>
    """
else:
    custom_css = """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :root, [data-testid="stAppViewContainer"], .stApp {
        --text-color: #0f172a !important;
        --background-color: #f8fafc !important;
        --secondary-background-color: #ffffff !important;
        background-color: #f8fafc !important;
        color: #0f172a !important;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    section[data-testid="stSidebar"] {
        background-color: #ffffff !important;
        border-right: 1px solid #e2e8f0 !important;
    }
    [data-testid="stHeader"] {
        background-color: rgba(248, 250, 252, 0.95) !important;
    }

    .main-header {
        background: linear-gradient(135deg, #1e4d2b 0%, #10b981 100%);
        padding: 24px 32px;
        border-radius: 20px;
        color: white !important;
        margin-bottom: 24px;
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.25);
    }
    .main-header * {
        color: white !important;
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
        color: white !important;
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
        color: white !important;
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

    /* Expanders (Light Mode) */
    div[data-testid="stExpander"] {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] details {
        background-color: #ffffff !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] summary {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border-radius: 12px !important;
    }
    div[data-testid="stExpander"] summary * {
        color: #0f172a !important;
    }
    div[data-testid="stExpander"] summary:hover,
    div[data-testid="stExpander"] summary:hover * {
        color: #059669 !important;
    }
    div[data-testid="stExpander"] div[role="region"] {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border-top: 1px solid #e2e8f0 !important;
    }

    /* Scoped Basket Table (Light Mode) */
    .basket-breakdown-container {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 12px !important;
    }
    .basket-table {
        background-color: #ffffff !important;
        color: #0f172a !important;
    }
    .basket-table th {
        background-color: #f8fafc !important;
        color: #475569 !important;
    }
    .basket-table td {
        background-color: #ffffff !important;
        color: #0f172a !important;
    }

    /* Matrix Table (Light Mode) */
    .matrix-table-container {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 12px !important;
    }
    .matrix-table {
        background-color: #ffffff !important;
        color: #0f172a !important;
    }
    .matrix-table th {
        background-color: #f1f5f9 !important;
        color: #475569 !important;
    }
    .matrix-table td {
        background-color: #ffffff !important;
        color: #0f172a !important;
    }

    /* Native Streamlit Styled Tables & DataFrames (Light Mode) */
    .stTable,
    div[data-testid="stTable"],
    table[data-testid="stTableStyledTable"],
    div[data-testid="stDataFrame"],
    div[data-testid="stDataFrameResizable"],
    .stDataFrameGlideDataEditor,
    .dvn-scroller,
    .dvn-stack,
    div[data-testid="stDataFrame"] > div {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border-color: #e2e8f0 !important;
    }
    table[data-testid="stTableStyledTable"] th {
        background-color: #f8fafc !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
        font-weight: 700 !important;
    }
    table[data-testid="stTableStyledTable"] td {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
    }
    table[data-testid="stTableStyledTable"] tbody tr:nth-of-type(even) td {
        background-color: #f8fafc !important;
    }
    </style>
    """

st.markdown(custom_css, unsafe_allow_html=True)


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


def _safe_plotly_chart(fig):
    """Renders plotly chart using modern width='stretch' to avoid deprecation warnings."""
    try:
        st.plotly_chart(fig, width="stretch")
    except TypeError:
        st.plotly_chart(fig, use_container_width=True)


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
    center: dict = None,
    color_discrete_map: dict = None,
):
    """Renders map using px.scatter_map (Plotly 7+) or px.scatter_mapbox (Plotly 5/6), with st.map fallback."""
    """Renders interactive map using px.scatter_map (Plotly 7+) or px.scatter_mapbox (Plotly 5/6) with st.map fallback."""
    if df is None or df.empty or lat not in df.columns or lon not in df.columns:
        st.info("📍 Xəritədə göstərmək üçün məkan məlumatı yoxdur.")
        return

    # Clean numeric coordinates
    valid_df = df.dropna(subset=[lat, lon]).copy()
    valid_df[lat] = pd.to_numeric(valid_df[lat], errors="coerce")
    valid_df[lon] = pd.to_numeric(valid_df[lon], errors="coerce")
    valid_df = valid_df.dropna(subset=[lat, lon])

    if valid_df.empty:
        st.info("📍 Xəritədə göstərmək üçün düzgün koordinatlar tapılmadı.")
        st.info("📍 Xəritədə göstərmək üçün məkan məlumatı tapılmadı.")
        return

    # Default brand colors
    default_color_map = {
        "🔴 Sizin Məkanınız": "#ef4444",
        "Bravo": "#16a34a",
        "Araz": "#dc2626",
        "Oba": "#059669",
        "OBA": "#059669",
        "Bazarstore": "#2563eb",
        "Rahat": "#ea580c",
        "Grandmart": "#7c3aed",
        "Neptun": "#0891b2",
        "Bolmart": "#d97706",
        "Megastore": "#4f46e5",
        "Al Market": "#0284c7",
        "Səbət": "#10b981",
    }
    if color_discrete_map:
        default_color_map.update(color_discrete_map)

    # Determine center explicitly - NEVER leave empty as Plotly defaults to (0, 0) Null Island!
    if center is None:
        if color and color in valid_df.columns:
            user_rows = valid_df[valid_df[color].astype(str).str.contains("Sizin Məkanınız|🔴", na=False)]
            if not user_rows.empty:
                c_lat = float(user_rows[lat].iloc[0])
                c_lon = float(user_rows[lon].iloc[0])
            else:
                c_lat = float(valid_df[lat].mean())
                c_lon = float(valid_df[lon].mean())
        else:
            c_lat = float(valid_df[lat].mean())
            c_lon = float(valid_df[lon].mean())
        center = dict(lat=c_lat, lon=c_lon)

    legend_bg = "rgba(30, 41, 59, 0.88)" if dark_mode else "rgba(255, 255, 255, 0.88)"
    legend_font = dict(color="#f8fafc" if dark_mode else "#0f172a", size=11)
    target_style = "carto-darkmatter" if dark_mode else "carto-positron"

    # User-friendly hover tooltip: strictly hide raw latitude and longitude coordinates!
    hover_dict = {lat: False, lon: False}
    if hover_data:
        for c in hover_data:
            if c in valid_df.columns:
                hover_dict[c] = True
    if color and color in valid_df.columns:
        hover_dict[color] = False

    try:
        kwargs = dict(
            lat=lat,
            lon=lon,
            zoom=zoom,
            height=height,
            center=center,
            hover_data=hover_dict,
            color_discrete_map=default_color_map,
        )
        if hover_name and hover_name in valid_df.columns:
            kwargs["hover_name"] = hover_name
        if color and color in valid_df.columns:
            kwargs["color"] = color
        if size and size in valid_df.columns:
            kwargs["size"] = size

        if hasattr(px, "scatter_map"):
            kwargs["map_style"] = target_style
            fig = px.scatter_map(valid_df, **kwargs)
            if not size:
                fig.update_traces(marker=dict(size=14, opacity=0.92))
            fig.update_layout(
                margin={"r": 0, "t": 0, "l": 0, "b": 0},
                legend=dict(yanchor="top", y=0.98, xanchor="left", x=0.02, bgcolor=legend_bg, font=legend_font),
            )
            _safe_plotly_chart(fig)
            return
        elif hasattr(px, "scatter_mapbox"):
            kwargs["mapbox_style"] = target_style
            fig = px.scatter_mapbox(valid_df, **kwargs)
            if not size:
                fig.update_traces(marker=dict(size=14, opacity=0.92))
            fig.update_layout(
                mapbox_style=target_style,
                margin={"r": 0, "t": 0, "l": 0, "b": 0},
                legend=dict(yanchor="top", y=0.98, xanchor="left", x=0.02, bgcolor=legend_bg, font=legend_font),
            )
            _safe_plotly_chart(fig)
            return
    except Exception:
        pass

    # Fallback to standard streamlit map
    st.map(df[[lat, lon]], zoom=int(zoom))
    # Resilient fallback to standard streamlit map
    try:
        st.map(valid_df, latitude=lat, longitude=lon, zoom=int(zoom), height=height, width="stretch")
    except Exception:
        try:
            st.map(valid_df[[lat, lon]], zoom=int(zoom))
        except Exception:
            st.warning("⚠️ Xəritə vizuallaşdırması yüklənə bilmədi.")


def clear_basket_keys():
    """Clears all dynamic basket quantity input keys from session state."""
    for k in list(st.session_state.keys()):
        if k.startswith("bqty_") or k == "new_qty_kg_val":
            del st.session_state[k]


def render_html(html_str: str):
    """Safely renders HTML without accidental Markdown indented code-block conversion."""
    clean_html = textwrap.dedent(html_str).strip()
    if hasattr(st, "html"):
        st.html(clean_html)
    else:
        st.markdown(clean_html, unsafe_allow_html=True)


def get_gmaps_walking_dir_url(origin: Tuple[float, float], destination: Tuple[float, float]) -> str:
    """Generates official Google Maps turn-by-turn walking navigation URL."""
    return f"https://www.google.com/maps/dir/?api=1&origin={origin[0]:.6f},{origin[1]:.6f}&destination={destination[0]:.6f},{destination[1]:.6f}&travelmode=walking"


def get_gmaps_multistop_walking_dir_url(origin: Tuple[float, float], stop1: Tuple[float, float], destination: Tuple[float, float]) -> str:
    """Generates official Google Maps multi-stop walking navigation URL with waypoint."""
    return f"https://www.google.com/maps/dir/?api=1&origin={origin[0]:.6f},{origin[1]:.6f}&destination={destination[0]:.6f},{destination[1]:.6f}&waypoints={stop1[0]:.6f},{stop1[1]:.6f}&travelmode=walking"


def render_gmaps_embed_route(origin: Tuple[float, float], destination: Tuple[float, float], waypoint: Tuple[float, float] = None, height: int = 360):
    """Renders free, responsive embedded Google Maps route viewer without requiring paid API key."""
    if waypoint:
        src = f"https://maps.google.com/maps?saddr={origin[0]:.5f},{origin[1]:.5f}&daddr={waypoint[0]:.5f},{waypoint[1]:.5f}+to:{destination[0]:.5f},{destination[1]:.5f}&hl=az&output=embed"
    else:
        src = f"https://maps.google.com/maps?saddr={origin[0]:.5f},{origin[1]:.5f}&daddr={destination[0]:.5f},{destination[1]:.5f}&hl=az&output=embed"

    iframe_html = f"""
    <div style="width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.25); box-shadow: 0 4px 12px rgba(0,0,0,0.18); margin: 8px 0;">
        <iframe
            title="Google Maps Canlı Marşrut"
            width="100%"
            height="{height}"
            style="border: 0; display: block;"
            loading="lazy"
            allowfullscreen
            referrerpolicy="no-referrer-when-downgrade"
            src="{src}">
        </iframe>
    </div>
    """
    render_html(iframe_html)


def render_basket_items_table(items: List[Dict[str, Any]], dark: bool = True):
    """Renders a clean, high-contrast, fully visible items breakdown table in dark and light modes."""
    if not items:
        st.info("Məhsul yoxdur.")
        return

    # Theme colors for explicit inline styling (works seamlessly in both dark and light modes)
    th_bg = "#0f172a" if dark else "#f8fafc"
    th_color = "#94a3b8" if dark else "#475569"
    td_bg = "#1e293b" if dark else "#ffffff"
    td_alt_bg = "#182338" if dark else "#f8fafc"
    text_color = "#f8fafc" if dark else "#0f172a"
    sub_color = "#cbd5e1" if dark else "#334155"
    price_sub = "#94a3b8" if dark else "#64748b"
    border_color = "#334155" if dark else "#e2e8f0"
    pill_bg = "rgba(16, 185, 129, 0.2)" if dark else "#ecfdf5"
    pill_color = "#34d399" if dark else "#059669"
    pill_border = "rgba(16, 185, 129, 0.4)" if dark else "#a7f3d0"

    rows_html = []
    total_cost = 0.0
    for i, it in enumerate(items):
        qty = float(it.get("quantity", 1.0))
        unit = str(it.get("unit", "ədəd")).lower()
        if unit in ("kg", "kq"):
            qty_label = f"{qty:.2f} kq"
        elif unit in ("liter", "l"):
            qty_label = f"{int(qty) if qty.is_integer() else qty} L"
        else:
            qty_label = f"{int(qty) if qty.is_integer() else qty} ədəd"

        u_p = float(it.get("unit_price", 0.0))
        tot = float(it.get("total", round(u_p * qty, 2)))
        total_cost += tot
        row_bg = td_alt_bg if i % 2 == 1 else td_bg

        rows_html.append(
            f'<tr style="background-color: {row_bg} !important; border-bottom: 1px solid {border_color};">'
            f'<td style="padding: 10px 14px; font-weight: 600; color: {text_color} !important; text-align: left; background-color: {row_bg} !important;">{it.get("name", "")}</td>'
            f'<td style="padding: 10px 14px; color: {sub_color} !important; text-align: center; font-weight: 500; background-color: {row_bg} !important;">{qty_label}</td>'
            f'<td style="padding: 10px 14px; color: {price_sub} !important; text-align: right; font-weight: 500; background-color: {row_bg} !important;">{u_p:.2f} ₼</td>'
            f'<td style="padding: 10px 14px; text-align: right; background-color: {row_bg} !important;">'
            f'<span style="display: inline-block; background-color: {pill_bg} !important; color: {pill_color} !important; border: 1px solid {pill_border}; padding: 3px 9px; border-radius: 6px; font-weight: 700; font-size: 13px;">'
            f'{tot:.2f} ₼</span></td>'
            f'</tr>'
        )

    table_markup = (
        f'<div class="basket-breakdown-container" style="width: 100%; overflow-x: auto; border: 1px solid {border_color}; border-radius: 12px; margin: 8px 0 12px 0; background-color: {td_bg} !important;">'
        f'<table class="basket-table" style="width: 100%; border-collapse: collapse; font-size: 13px; background-color: {td_bg} !important; color: {text_color} !important;">'
        f'<thead>'
        f'<tr style="background-color: {th_bg} !important; border-bottom: 2px solid {border_color};">'
        f'<th style="padding: 10px 14px; text-align: left; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Məhsul</th>'
        f'<th style="padding: 10px 14px; text-align: center; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Miqdar</th>'
        f'<th style="padding: 10px 14px; text-align: right; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Qiymət</th>'
        f'<th style="padding: 10px 14px; text-align: right; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Məbləğ</th>'
        f'</tr>'
        f'</thead>'
        f'<tbody>'
        f'{"".join(rows_html)}'
        f'</tbody>'
        f'<tfoot>'
        f'<tr style="background-color: {th_bg} !important; border-top: 2px solid {border_color};">'
        f'<td colspan="3" style="padding: 10px 14px; font-weight: 700; color: {text_color} !important; text-align: right; background-color: {th_bg} !important;">Cəmi ({len(items)} məhsul):</td>'
        f'<td style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 15px; color: {pill_color} !important; background-color: {th_bg} !important;">{total_cost:.2f} ₼</td>'
        f'</tr>'
        f'</tfoot>'
        f'</table>'
        f'</div>'
    )

    st.markdown(table_markup, unsafe_allow_html=True)


def render_comparison_matrix_table(df: pd.DataFrame, dark: bool = True):
    """Renders a responsive, high-contrast HTML comparison matrix with sticky headers."""
    if df is None or df.empty:
        st.info("Axtarışa uyğun məhsul tapılmadı.")
        return

    # Theme colors
    th_bg = "#0f172a" if dark else "#f1f5f9"
    th_color = "#94a3b8" if dark else "#475569"
    td_bg = "#1e293b" if dark else "#ffffff"
    td_alt_bg = "#182338" if dark else "#f8fafc"
    text_color = "#f8fafc" if dark else "#0f172a"
    sub_color = "#cbd5e1" if dark else "#475569"
    border_color = "#334155" if dark else "#e2e8f0"

    # Badges
    min_pill_bg = "rgba(16, 185, 129, 0.2)" if dark else "#ecfdf5"
    min_pill_color = "#34d399" if dark else "#059669"
    min_pill_border = "rgba(16, 185, 129, 0.4)" if dark else "#a7f3d0"

    star_pill_bg = "rgba(16, 185, 129, 0.15)" if dark else "#dcfce7"
    star_pill_color = "#34d399" if dark else "#166534"
    star_pill_border = "rgba(16, 185, 129, 0.3)" if dark else "#86efac"

    cols = list(df.columns)

    # Build header HTML with sticky top
    th_cells = []
    for c in cols:
        align = "left" if c in ("Məhsul", "Qablaşdırma", "Kateqoriya") else "right"
        th_cells.append(
            f'<th style="padding: 11px 13px; text-align: {align}; color: {th_color} !important; '
            f'font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; '
            f'background-color: {th_bg} !important; position: sticky; top: 0; z-index: 2; '
            f'border-bottom: 2px solid {border_color}; white-space: nowrap;">{c}</th>'
        )
    thead_html = f'<thead><tr>{"".join(th_cells)}</tr></thead>'

    # Build rows HTML
    rows_html = []
    for i, row in df.iterrows():
        row_bg = td_alt_bg if i % 2 == 1 else td_bg
        td_cells = []
        for c in cols:
            val = str(row[c])
            align = "left" if c in ("Məhsul", "Qablaşdırma", "Kateqoriya") else "right"

            if c == "Məhsul":
                td_cells.append(
                    f'<td style="padding: 10px 13px; text-align: {align}; font-weight: 600; '
                    f'color: {text_color} !important; background-color: {row_bg} !important; '
                    f'border-bottom: 1px solid {border_color}; white-space: nowrap;">{val}</td>'
                )
            elif c in ("Qablaşdırma", "Kateqoriya"):
                td_cells.append(
                    f'<td style="padding: 10px 13px; text-align: {align}; font-weight: 500; '
                    f'color: {sub_color} !important; background-color: {row_bg} !important; '
                    f'border-bottom: 1px solid {border_color}; white-space: nowrap;">{val}</td>'
                )
            elif c == "Ən Ucuz (₼)":
                td_cells.append(
                    f'<td style="padding: 10px 13px; text-align: {align}; background-color: {row_bg} !important; '
                    f'border-bottom: 1px solid {border_color}; white-space: nowrap;">'
                    f'<span style="display: inline-block; background-color: {min_pill_bg} !important; '
                    f'color: {min_pill_color} !important; border: 1px solid {min_pill_border}; '
                    f'padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 13px;">{val}</span></td>'
                )
            else:
                if "⭐" in val:
                    clean_val = val.replace(" ⭐", "")
                    td_cells.append(
                        f'<td style="padding: 10px 13px; text-align: {align}; background-color: {row_bg} !important; '
                        f'border-bottom: 1px solid {border_color}; white-space: nowrap;">'
                        f'<span style="display: inline-block; background-color: {star_pill_bg} !important; '
                        f'color: {star_pill_color} !important; border: 1px solid {star_pill_border}; '
                        f'padding: 3px 7px; border-radius: 6px; font-weight: 700; font-size: 12.5px;">'
                        f'{clean_val} ⭐</span></td>'
                    )
                else:
                    td_cells.append(
                        f'<td style="padding: 10px 13px; text-align: {align}; font-weight: 500; '
                        f'color: {sub_color} !important; background-color: {row_bg} !important; '
                        f'border-bottom: 1px solid {border_color}; white-space: nowrap;">{val}</td>'
                    )
        rows_html.append(f'<tr>{"".join(td_cells)}</tr>')

    table_markup = (
        f'<div class="matrix-table-container" style="width: 100%; max-height: 480px; overflow-y: auto; '
        f'overflow-x: auto; border: 1px solid {border_color}; border-radius: 12px; margin: 10px 0 16px 0; '
        f'background-color: {td_bg} !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">'
        f'<table class="matrix-table" style="width: 100%; border-collapse: separate; border-spacing: 0; '
        f'font-size: 13px; background-color: {td_bg} !important; color: {text_color} !important;">'
        f'{thead_html}'
        f'<tbody>{"".join(rows_html)}</tbody>'
        f'</table>'
        f'</div>'
    )
    st.markdown(table_markup, unsafe_allow_html=True)


def render_dispersion_table(df: pd.DataFrame, dark: bool = True):
    """Renders high-contrast table for Top 5 highest price differences."""
    if df is None or df.empty:
        return

    th_bg = "#0f172a" if dark else "#f1f5f9"
    th_color = "#94a3b8" if dark else "#475569"
    td_bg = "#1e293b" if dark else "#ffffff"
    td_alt_bg = "#182338" if dark else "#f8fafc"
    text_color = "#f8fafc" if dark else "#0f172a"
    sub_color = "#cbd5e1" if dark else "#475569"
    border_color = "#334155" if dark else "#e2e8f0"
    badge_bg = "rgba(239, 68, 68, 0.15)" if dark else "#fee2e2"
    badge_color = "#f87171" if dark else "#dc2626"
    badge_border = "rgba(239, 68, 68, 0.3)" if dark else "#fca5a5"

    rows_html = []
    for i, row in df.iterrows():
        row_bg = td_alt_bg if i % 2 == 1 else td_bg
        rows_html.append(
            f'<tr style="background-color: {row_bg} !important; border-bottom: 1px solid {border_color};">'
            f'<td style="padding: 10px 14px; font-weight: 600; color: {text_color} !important; text-align: left; background-color: {row_bg} !important;">{row["Məhsul"]}</td>'
            f'<td style="padding: 10px 14px; color: #10b981 !important; text-align: right; font-weight: 700; background-color: {row_bg} !important;">{row["Ən Aşağı Qiymət"]}</td>'
            f'<td style="padding: 10px 14px; color: #ef4444 !important; text-align: right; font-weight: 700; background-color: {row_bg} !important;">{row["Ən Yuxarı Qiymət"]}</td>'
            f'<td style="padding: 10px 14px; color: {sub_color} !important; text-align: right; font-weight: 600; background-color: {row_bg} !important;">{row["Fərq (₼)"]:.2f} ₼</td>'
            f'<td style="padding: 10px 14px; text-align: right; background-color: {row_bg} !important;">'
            f'<span style="display: inline-block; background-color: {badge_bg} !important; color: {badge_color} !important; border: 1px solid {badge_border}; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 13px;">'
            f'+{row["Fərq (%)"]:.1f}%</span></td>'
            f'</tr>'
        )

    table_markup = (
        f'<div style="width: 100%; overflow-x: auto; border: 1px solid {border_color}; border-radius: 12px; margin: 10px 0 16px 0; background-color: {td_bg} !important;">'
        f'<table style="width: 100%; border-collapse: collapse; font-size: 13px; background-color: {td_bg} !important; color: {text_color} !important;">'
        f'<thead>'
        f'<tr style="background-color: {th_bg} !important; border-bottom: 2px solid {border_color};">'
        f'<th style="padding: 11px 14px; text-align: left; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Məhsul</th>'
        f'<th style="padding: 11px 14px; text-align: right; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Ən Aşağı Qiymət</th>'
        f'<th style="padding: 11px 14px; text-align: right; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Ən Yuxarı Qiymət</th>'
        f'<th style="padding: 11px 14px; text-align: right; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Fərq (₼)</th>'
        f'<th style="padding: 11px 14px; text-align: right; color: {th_color} !important; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; background-color: {th_bg} !important;">Fərq (%)</th>'
        f'</tr>'
        f'</thead>'
        f'<tbody>{"".join(rows_html)}</tbody>'
        f'</table>'
        f'</div>'
    )
    st.markdown(table_markup, unsafe_allow_html=True)


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
            "gmaps_rating": s.get("gmaps_rating", 4.4),
            "gmaps_reviews": s.get("gmaps_reviews", 1200),
            "opening_hours": s.get("opening_hours", "08:00 – 23:00"),
            "google_maps_url": s.get("google_maps_url", f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(s['branch_name'] + ' ' + s['address'])}"),
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
# Split-Window Modal Dialog: Login & Register
# -----------------------------------------------------------------------------
@st.dialog("👤 SebEt — İstifadəçi Girişi və Qeydiyyat", width="large")
def show_auth_dialog():
    """Split modal window containing branding perks on the left and login/register tabs on the right."""
    is_dark = st.session_state.get("dark_mode_toggle", True)
    dlg_text = "#f8fafc" if is_dark else "#0f172a"
    dlg_sub = "#94a3b8" if is_dark else "#64748b"
    dlg_card_bg = "rgba(16, 185, 129, 0.08)" if is_dark else "#f0fdf4"

    col_brand, col_forms = st.columns([1, 1.3], gap="large")

    with col_brand:
        logo_path = "frontend/public/logo-light.png" if is_dark else "frontend/public/logo-dark.png"
        if not os.path.exists(logo_path):
            logo_path = "frontend/public/sebet-logo-banner.png"
        if os.path.exists(logo_path):
            st.image(logo_path, width=190)
        else:
            st.markdown("### 🛒 SebEt")

        st.markdown(
            f"""
            <div style="margin-top: 12px; line-height: 1.5;">
                <h4 style="margin: 0 0 10px 0; color: #10b981; font-weight: 800; font-size: 17px;">Bakının Ağıllı Səbət Platforması</h4>
                <div style="font-size: 13px; color: {dlg_text}; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 8px;">
                    <span>🎁</span>
                    <div><b>Xoş gəldin bonusu:</b> Yeni qeydiyyatdan keçən hər istifadəçiyə dərhal <b style="color: #10b981;">+250 Sebet Xalı (2.50 ₼)</b> hədiyyə olunur!</div>
                </div>
                <div style="font-size: 13px; color: {dlg_text}; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 8px;">
                    <span>💾</span>
                    <div><b>Səbət Sinxronizasiyası:</b> Yığdığınız ərzaqları bir toxunuşla bazada yadda saxlayın və istənilən vaxt bərpa edin.</div>
                </div>
                <div style="font-size: 13px; color: {dlg_text}; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 8px;">
                    <span>💳</span>
                    <div><b>2x Keşbek & Endirim:</b> Bravo, Araz, OBA, Bazarstore və digər marketlərdən keşbek toplayın.</div>
                </div>
                <div style="font-size: 13px; color: {dlg_text}; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 8px;">
                    <span>📍</span>
                    <div><b>Optimal Marşrut:</b> Ünvanınıza ən yaxın 2 market kombinasiyası ilə büdcənizə qənaət edin.</div>
                </div>
            </div>
            <div style="margin-top: 14px; padding: 10px 12px; background: {dlg_card_bg}; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; font-size: 12px; color: #10b981;">
                🔒 Şifrəniz PBKDF2-HMAC-SHA256 (100,000 iterasiya) ilə etibarlı şifrələnir.
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_forms:
        diag_tab_login, diag_tab_reg = st.tabs(["🔑 Daxil Ol (Login)", "📝 Yeni Qeydiyyat (Register)"])

        with diag_tab_login:
            if st.button("⚡ 1-Kliklə Demo Giriş (Ali İskəndərli)", key="dlg_btn_demo_in", use_container_width=True, type="primary"):
                ok, msg, u_data = user_db.authenticate_user("demo", "sebet2026")
                if ok:
                    st.session_state["user_authenticated"] = True
                    st.session_state["current_user"] = u_data
                    st.session_state["points"] = u_data.get("sebet_points", 300)
                    s_b, s_loc = user_db.load_user_basket(u_data["id"])
                    if s_b:
                        st.session_state["basket"] = s_b
                    st.toast(f"Xoş gəldiniz, {u_data['full_name']}!", icon="👋")
                    st.rerun()

            st.markdown("<div style='text-align: center; color: #94a3b8; margin: 8px 0; font-size: 12px;'>və ya öz hesabınızla</div>", unsafe_allow_html=True)

            with st.form(key="dlg_form_login"):
                u_in = st.text_input("İstifadəçi adı və ya Telefon / E-poçt", placeholder="Məs: demo və ya ali@sebet.az", key="dlg_inp_user")
                p_in = st.text_input("Şifrə", type="password", placeholder="••••••••", key="dlg_inp_pwd")
                sub_login = st.form_submit_button("Daxil Ol", use_container_width=True)

                if sub_login:
                    if not u_in or not p_in:
                        st.error("Zəhmət olmasa istifadəçi adı və şifrəni daxil edin.")
                    else:
                        ok, msg, u_data = user_db.authenticate_user(u_in.strip(), p_in)
                        if ok:
                            st.session_state["user_authenticated"] = True
                            st.session_state["current_user"] = u_data
                            st.session_state["points"] = u_data.get("sebet_points", 0)
                            s_b, s_loc = user_db.load_user_basket(u_data["id"])
                            if s_b:
                                st.session_state["basket"] = s_b
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)

        with diag_tab_reg:
            st.markdown(
                """
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 12px; color: #10b981; font-weight: 600;">
                    🎁 Qeydiyyat tamamlanan kimi 250 Sebet Xalı (2.50 AZN) balansınıza oturacaq!
                </div>
                """,
                unsafe_allow_html=True,
            )
            with st.form(key="dlg_form_register"):
                reg_name = st.text_input("Ad və Soyadınız", placeholder="Məs: Rəşad Məmmədov", key="dlg_r_name")
                reg_u = st.text_input("İstifadəçi Adı və ya Telefon", placeholder="reshad99 və ya 0501234567", key="dlg_r_user")
                reg_e = st.text_input("E-poçt Ünvanı (Könüllü)", placeholder="reshad@example.com", key="dlg_r_email")
                reg_loc = st.selectbox(
                    "Sevimli Ərazi / Metro",
                    [
                        "28 May m. / Dəmiryol Vağzalı",
                        "Gənclik m. / Atatürk pr. / Gənclik Mall",
                        "Nərimanov m. / Metropark",
                        "Elmlər Akademiyası m. / BDU",
                        "İnşaatçılar m. / A. M. Şərifzadə",
                        "20 Yanvar m. / Tbilisi pr.",
                        "Əhmədli m. / M. Hadi",
                        "Neftçilər m. / Q. Qarayev pr.",
                        "Sahil m. / Nizami küç. (Tarqovı)",
                    ],
                    key="dlg_r_loc",
                )
                reg_p1 = st.text_input("Şifrə", type="password", placeholder="Ən azı 4 simvol", key="dlg_r_p1")
                reg_p2 = st.text_input("Şifrənin Təkrarı", type="password", placeholder="Şifrəni yenidən yazın", key="dlg_r_p2")
                sub_reg = st.form_submit_button("Qeydiyyatdan Keç (+250 Xal Qazan)", use_container_width=True, type="primary")

                if sub_reg:
                    if not reg_name or not reg_u or not reg_p1:
                        st.error("Zəhmət olmasa bütün tələb olunan sahələri doldurun.")
                    elif len(reg_p1) < 4:
                        st.error("Şifrə ən azı 4 simvoldan ibarət olmalıdır.")
                    elif reg_p1 != reg_p2:
                        st.error("Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.")
                    else:
                        ok, msg, u_data = user_db.register_user(
                            username=reg_u.strip(),
                            full_name=reg_name.strip(),
                            password=reg_p1,
                            email=reg_e.strip(),
                            phone=reg_u.strip(),
                            home_location=reg_loc,
                        )
                        if ok:
                            st.session_state["user_authenticated"] = True
                            st.session_state["current_user"] = u_data
                            st.session_state["points"] = u_data.get("sebet_points", 250)
                            st.success(f"🎉 Təbriklər, {reg_name}! Hesabınız yaradıldı və 250 xal əlavə edildi.")
                            st.rerun()
                        else:
                            st.error(msg)


# -----------------------------------------------------------------------------
# 6. Sidebar Controls
# -----------------------------------------------------------------------------
with st.sidebar:
    is_dark = st.session_state.get("dark_mode_toggle", True)
    sidebar_logo = "frontend/public/logo-light.png" if is_dark else "frontend/public/logo-dark.png"
    if not os.path.exists(sidebar_logo):
        sidebar_logo = "frontend/public/sebet-logo-banner.png"
    st.image(
        sidebar_logo if os.path.exists(sidebar_logo) else "https://raw.githubusercontent.com/Ali0lo/Sebet/main/frontend/public/logo-light.png",
        use_container_width=True,
    )
    dark_mode = st.toggle("🌙 Qaranlıq Rejim (Dark Mode)", value=True, key="dark_mode_toggle")

    # -------------------------------------------------------------------------
    # User Profile / Login Card in Sidebar
    # -------------------------------------------------------------------------
    if st.session_state.get("user_authenticated") and st.session_state.get("current_user"):
        usr = st.session_state["current_user"]
        st.markdown(
            f"""
            <div style="background: {card_bg}; border: 1px solid #10b981; border-radius: 12px; padding: 12px; margin: 10px 0 12px 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px;">
                        {usr['full_name'][0].upper() if usr.get('full_name') else 'U'}
                    </div>
                    <div style="line-height: 1.25;">
                        <div style="font-weight: 700; color: {card_text}; font-size: 13px;">{usr['full_name']}</div>
                        <div style="font-size: 11px; color: #10b981; font-weight: 600;">⭐ {usr.get('membership_tier', 'Sebet Platinum')}</div>
                    </div>
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid {card_border}; font-size: 12px; color: {sub_text}; display: flex; justify-content: space-between;">
                    <span>Keşbek Balansı:</span>
                    <b style="color: #10b981;">{usr.get('sebet_points', 0)} Xal ({usr.get('sebet_points', 0) / 100:.2f} ₼)</b>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        col_sb_save, col_sb_out = st.columns(2)
        with col_sb_save:
            if st.button("💾 Səbəti Saxla", key="sb_btn_save_basket", use_container_width=True):
                user_db.save_user_basket(usr["id"], st.session_state.get("basket", []), st.session_state.get("selected_loc_name"))
                st.toast("✅ Səbətiniz bazada saxlanıldı!", icon="💾")
        with col_sb_out:
            if st.button("🚪 Çıxış", key="sb_btn_logout", use_container_width=True):
                st.session_state["user_authenticated"] = False
                st.session_state["current_user"] = None
                st.rerun()
    else:
        st.markdown(
            f"""
            <div style="background: {card_bg}; border: 1px solid {card_border}; border-radius: 12px; padding: 10px 12px; margin: 10px 0 10px 0;">
                <div style="font-size: 12px; font-weight: 700; color: {card_text};">👤 Qonaq İstifadəçi</div>
                <div style="font-size: 11px; color: {sub_text};">Xalları və səbəti saxlamaq üçün daxil olun</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        col_sb_log, col_sb_demo = st.columns(2)
        with col_sb_log:
            with st.popover("🔑 Giriş", use_container_width=True):
                st.markdown("##### 🔑 Daxil Ol")
                sb_u = st.text_input("İstifadəçi adı / Telefon:", key="sb_pop_u")
                sb_p = st.text_input("Şifrə:", type="password", key="sb_pop_p")
                if st.button("Daxil Ol", key="sb_pop_btn_login", type="primary", use_container_width=True):
                    ok, msg, u_data = user_db.authenticate_user(sb_u, sb_p)
                    if ok:
                        st.session_state["user_authenticated"] = True
                        st.session_state["current_user"] = u_data
                        st.session_state["points"] = u_data.get("sebet_points", 250)
                        s_b, s_loc = user_db.load_user_basket(u_data["id"])
                        if s_b:
                            st.session_state.basket = s_b
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)
        with col_sb_demo:
            if st.button("⚡ Demo Giriş", key="sb_btn_demo_login", use_container_width=True, help="Ali İskəndərli demo hesabı ilə 1-kliklə daxil ol"):
                ok, msg, u_data = user_db.authenticate_user("demo", "sebet2026")
                if ok:
                    st.session_state["user_authenticated"] = True
                    st.session_state["current_user"] = u_data
                    st.session_state["points"] = u_data.get("sebet_points", 300)
                    s_b, s_loc = user_db.load_user_basket(u_data["id"])
                    if s_b:
                        st.session_state.basket = s_b
                    st.rerun()

    st.markdown("### 📍 Bakı Məkanı & Radius")

    # Build full Baku location presets from comprehensive database
    LOCATION_PRESETS = {
        loc["title"]: (loc["lat"], loc["lon"])
        for loc in sebet_data.BAKU_ALL_LOCATIONS.values()
    }

    # Initialize location state
    if "user_coords" not in st.session_state:
        st.session_state["user_coords"] = (40.3798, 49.8475)
    if "selected_loc_name" not in st.session_state:
        st.session_state["selected_loc_name"] = "28 May m. / Dəmiryol Vağzalı"
    if "max_walking_dist" not in st.session_state:
        st.session_state["max_walking_dist"] = 750
    if "user_location_confirmed" not in st.session_state:
        st.session_state["user_location_confirmed"] = False

    # Actively request browser geolocation via streamlit_js_eval
    if HAS_GEO:
        geo_info = get_geolocation(component_key="browser_auto_gps_locator")
        if geo_info and isinstance(geo_info, dict) and "coords" in geo_info and geo_info["coords"]:
            raw_lat = geo_info["coords"].get("latitude")
            raw_lon = geo_info["coords"].get("longitude")
            accuracy = float(geo_info["coords"].get("accuracy", 9999.0))
            if raw_lat and raw_lon:
                g_lat = round(float(raw_lat), 4)
                g_lon = round(float(raw_lon), 4)
                st.session_state["raw_gps_coords"] = (g_lat, g_lon)
                st.session_state["raw_gps_accuracy"] = accuracy
                # Only automatically set coordinates if the user has NOT manually set their location
                if not st.session_state.get("user_location_confirmed", False):
                    if st.session_state.get("last_auto_gps") != (g_lat, g_lon):
                        st.session_state["last_auto_gps"] = (g_lat, g_lon)
                        st.session_state["user_coords"] = (g_lat, g_lon)
                        closest_k = min(
                            LOCATION_PRESETS.keys(),
                            key=lambda k: calculate_distance_meters((g_lat, g_lon), LOCATION_PRESETS[k]),
                        )
                        if accuracy <= 1000:
                            st.session_state["selected_loc_name"] = f"📍 Dəqiq GPS ({closest_k} yaxınlığı)"
                            st.session_state["gps_detected"] = "precise"
                        else:
                            st.session_state["selected_loc_name"] = f"📍 Şəbəkə Təxmini ({closest_k})"
                            st.session_state["gps_detected"] = "coarse"

    # Status indication
    gps_status = st.session_state.get("gps_detected")
    if gps_status == "precise":
        acc = int(st.session_state.get("raw_gps_accuracy", 50))
        st.success(f"🎯 Dəqiq GPS aktivdir: **{st.session_state.get('selected_loc_name', 'Məkanınız')}** (~{acc}m dəqiqliklə)")
    elif gps_status == "coarse":
        acc_km = round(st.session_state.get("raw_gps_accuracy", 3000) / 1000, 1)
        st.warning(f"⚠️ Şəbəkə təxmini (~{acc_km}km xəta). Dəqiq ünvanınızı aşağıdan seçin 👇")
    elif st.session_state.get("user_location_confirmed"):
        st.info(f"✅ Seçilmiş Məkan: **{st.session_state['selected_loc_name']}**")
    else:
        st.caption("ℹ️ Brauzer icazəsi verdikdə GPS yoxlanılır və ya aşağıdan ərazi seçə bilərsiniz.")

    # Location mode selection - user friendly (no complex coordinates)
    loc_mode = st.radio(
        "Məkan Seçim Üsulu:",
        ["🏙️ Bakı Əraziləri", "🔍 Ünvan / Axtarış"],
        index=0,
        horizontal=True,
        label_visibility="collapsed",
    )

    preset_keys = list(LOCATION_PRESETS.keys())
    cur_sel_name = st.session_state["selected_loc_name"]

    if loc_mode == "🏙️ Bakı Əraziləri":
        cur_idx = preset_keys.index(cur_sel_name) if cur_sel_name in preset_keys else 0
        chosen_preset = st.selectbox(
            "Yaşadığınız ərazi (80+ Məkan):",
            preset_keys,
            index=cur_idx,
            key="sidebar_preset_select",
        )
        if chosen_preset != st.session_state.get("selected_loc_name"):
            st.session_state["selected_loc_name"] = chosen_preset
            st.session_state["user_coords"] = LOCATION_PRESETS[chosen_preset]
            st.session_state["user_location_confirmed"] = True
            st.session_state["gps_detected"] = "manual"

    elif loc_mode == "🔍 Ünvan / Axtarış":
        search_kw = st.text_input(
            "Küçə, metro və ya landmark axtarın:",
            placeholder="Məs: Həzi Aslanov, İnşaatçılar, Təbriz, BDU, Yasamal...",
            key="sidebar_location_search",
        )
        if search_kw:
            found_locs = sebet_data.search_baku_locations(search_kw, limit=5)
            if found_locs:
                st.caption("Tapılan məkanlar (seçmək üçün klikləyin):")
                for s_loc in found_locs:
                    if st.button(f"📍 {s_loc['title']} ({s_loc['category']})", key=f"sb_srch_{s_loc['title']}", use_container_width=True):
                        st.session_state["user_coords"] = (s_loc["lat"], s_loc["lon"])
                        st.session_state["selected_loc_name"] = s_loc["title"]
                        st.session_state["user_location_confirmed"] = True
                        st.session_state["gps_detected"] = "manual"
                        st.rerun()
            else:
                st.caption("Axtarışa uyğun məkan tapılmadı. Məsələn: *Port Baku*, *Torqovaya*, *Gənclik*, *Yasamal*, *Əhmədli*")

    # Optional developer/advanced coordinates collapsed at the bottom
    with st.expander("⚙️ Xüsusi koordinat daxil et (İxtiyari)", expanded=False):
        cur_c = st.session_state["user_coords"]
        c_lat_col, c_lon_col = st.columns(2)
        with c_lat_col:
            new_lat = st.number_input("Enlik (Lat)", value=float(cur_c[0]), format="%.4f", step=0.001, key="sb_cust_lat")
        with c_lon_col:
            new_lon = st.number_input("Uzunluq (Lon)", value=float(cur_c[1]), format="%.4f", step=0.001, key="sb_cust_lon")
        if (new_lat, new_lon) != cur_c:
            st.session_state["user_coords"] = (new_lat, new_lon)
            st.session_state["selected_loc_name"] = "Xüsusi Məkan"
            st.session_state["user_location_confirmed"] = True
            st.session_state["gps_detected"] = "manual"

    user_coords = st.session_state["user_coords"]
    selected_loc_name = st.session_state["selected_loc_name"]

    max_walking_dist = st.slider(
        "🚶 Piyada məsafə limiti (metr):",
        min_value=200,
        max_value=2000,
        value=int(st.session_state["max_walking_dist"]),
        step=50,
        help="2 market arasındakı maksimum gəzinti məsafəsi. Bakıda adətən 750 metr (7-9 dəqiqə) optimaldır.",
        key="sidebar_walk_slider",
    )
    st.session_state["max_walking_dist"] = max_walking_dist

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
tab_optimizer, tab_comparison, tab_flyers, tab_scan, tab_analytics, tab_loyalty, tab_auth, tab_about = st.tabs([
    "🧺 Ağıllı Səbət (Smart Basket)",
    "🔍 Qiymət Müqayisəsi (Matrix)",
    "📰 Həftəlik Bukletlər (Flyers)",
    "🧾 Qəbz Skanı & Keşbek (OCR)",
    "📊 Bazar Analitikası (Analytics)",
    "🎁 Keşbek & Loyallıq",
    "👤 Hesabım & Giriş (Login)",
    "ℹ️ Texniki Memarlıq (About)",
])

# =============================================================================
# TAB 1: AĞILLI SƏBƏT (SMART BASKET OPTIMIZER)
# =============================================================================
with tab_optimizer:
    # -------------------------------------------------------------------------
    # Top Location Bar & Fast Switcher
    # -------------------------------------------------------------------------
    cur_loc = st.session_state.get("selected_loc_name", "28 May / Dəmiryol Vağzalı")
    u_lat, u_lon = st.session_state.get("user_coords", (40.3798, 49.8475))
    walk_dist = int(st.session_state.get("max_walking_dist", 750))
    walk_time_est = max(1, round(walk_dist / 80))

    loc_top_bg = "rgba(30, 41, 59, 0.75)" if dark_mode else "#f8fafc"
    loc_top_border = "rgba(16, 185, 129, 0.35)" if dark_mode else "#cbd5e1"
    loc_accent = "#34d399" if dark_mode else "#059669"

    # -------------------------------------------------------------------------
    # Top Location Bar & Intuitive Baku Location Switcher
    # -------------------------------------------------------------------------
    cur_loc = st.session_state.get("selected_loc_name", "28 May m. / Dəmiryol Vağzalı")
    u_lat, u_lon = st.session_state.get("user_coords", (40.3798, 49.8475))
    walk_dist = int(st.session_state.get("max_walking_dist", 750))
    walk_time_est = max(1, round(walk_dist / 80))

    loc_top_bg = "rgba(30, 41, 59, 0.75)" if dark_mode else "#f8fafc"
    loc_top_border = "rgba(16, 185, 129, 0.35)" if dark_mode else "#cbd5e1"
    loc_accent = "#34d399" if dark_mode else "#059669"
    gps_st = st.session_state.get("gps_detected")

    status_badge_html = ""
    if gps_st == "coarse":
        status_badge_html = """<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">⚠️ Təxmini Şəbəkə Məkanı (Dəqiq deyil? Aşağıdan seçin)</span>"""
    elif gps_st == "precise":
        status_badge_html = """<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">🎯 Dəqiq GPS Aktivdir</span>"""
    elif st.session_state.get("user_location_confirmed"):
        status_badge_html = """<span style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">✅ Təsdiqlənmiş Ünvan</span>"""

    render_html(f"""
    <div style="background: {loc_top_bg}; border: 1px solid {loc_top_border}; border-radius: 14px; padding: 14px 18px; margin-bottom: 16px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 14px;">
            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                📍
            </div>
            <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                    <span style="font-size: 11px; font-weight: 800; color: {loc_accent}; text-transform: uppercase; letter-spacing: 0.05em;">Cari Məkan & Radius</span>
                    {status_badge_html}
                </div>
                <div style="font-size: 17px; font-weight: 800; color: {card_text};">{cur_loc}</div>
                <div style="font-size: 13px; color: {sub_text}; margin-top: 3px;">
                    🚶 Maksimum piyada radiusu: <b style="color: {card_text};">{walk_dist} metr</b> (~{walk_time_est} dəqiqə piyada) · Ən yaxın filiallar əsasında
                </div>
            </div>
        </div>
    </div>
    """)

    # Open expander by default if user hasn't manually confirmed location or if coarse GPS
    is_exp_open = not st.session_state.get("user_location_confirmed", False)
    with st.expander("📍 Məkanı Dəyişdir / Ünvan Axtar / Xəritədə Seç", expanded=is_exp_open):
        st.markdown("<div style='font-size: 13px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;'>⚡ 1-Kliklə Populyar Bakı Məkanları:</div>", unsafe_allow_html=True)

        row1_cols = st.columns(6)
        row1_hubs = [
            ("🚇 28 May", "28 May m. / Dəmiryol Vağzalı"),
            ("🚇 Gənclik", "Gənclik m. / Atatürk pr. / Gənclik Mall"),
            ("🚇 Nərimanov", "Nərimanov m. / Metropark"),
            ("🚇 Elmlər / BDU", "Elmlər Akademiyası m. / BDU"),
            ("🚇 İnşaatçılar", "İnşaatçılar m. / A. M. Şərifzadə"),
            ("🚇 20 Yanvar", "20 Yanvar m. / Tbilisi pr."),
        ]
        for col_i, (short_label, full_key) in zip(row1_cols, row1_hubs):
            with col_i:
                if st.button(short_label, key=f"t1_q1_{short_label}", use_container_width=True):
                    st.session_state["selected_loc_name"] = full_key
                    st.session_state["user_coords"] = LOCATION_PRESETS[full_key]
                    st.session_state["user_location_confirmed"] = True
                    st.session_state["gps_detected"] = "manual"
                    st.rerun()

        row2_cols = st.columns(6)
        row2_hubs = [
            ("🚇 Əhmədli", "Əhmədli m. / Məhəmməd Hadi"),
            ("🚇 Neftçilər", "Neftçilər m. / Rüstəm Rüstəmov"),
            ("🏢 Sahil / Torqovı", "Sahil m. / Torqovı (Nizami küç.)"),
            ("🏢 Port Baku", "Port Baku Mall / Neftçilər pr."),
            ("🏘️ Yasamal", "Yasamal (Mərkəz)"),
            ("🏘️ Xırdalan", "Xırdalan Mərkəz (Heydər Əliyev parkı)"),
        ]
        for col_i, (short_label, full_key) in zip(row2_cols, row2_hubs):
            with col_i:
                if st.button(short_label, key=f"t1_q2_{short_label}", use_container_width=True):
                    st.session_state["selected_loc_name"] = full_key
                    st.session_state["user_coords"] = LOCATION_PRESETS[full_key]
                    st.session_state["user_location_confirmed"] = True
                    st.session_state["gps_detected"] = "manual"
                    st.rerun()

        st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
        tab_loc_col1, tab_loc_col2 = st.columns([1.4, 1.1], gap="medium")

        with tab_loc_col1:
            t1_search_q = st.text_input(
                "🔍 Bakı üzrə istənilən küçə, prospekt, metro və ya landmark axtarın:",
                placeholder="Məs: Həzi Aslanov, Təbriz küç., BDU, Dəniz Mall, Badamdar, Biləcəri...",
                key="tab1_fuzzy_location_search",
            )
            if t1_search_q:
                found = sebet_data.search_baku_locations(t1_search_q, limit=6)
                if found:
                    st.markdown("<div style='font-size: 12px; font-weight: 600; color: #10b981; margin: 4px 0;'>Tapılan nəticələr (seçmək üçün klikləyin):</div>", unsafe_allow_html=True)
                    f_cols = st.columns(2)
                    for idx_f, f_item in enumerate(found):
                        with f_cols[idx_f % 2]:
                            btn_label = f"📍 {f_item['title']}"
                            if st.button(btn_label, key=f"t1_found_{f_item['title']}_{idx_f}", use_container_width=True):
                                st.session_state["user_coords"] = (f_item["lat"], f_item["lon"])
                                st.session_state["selected_loc_name"] = f_item["title"]
                                st.session_state["user_location_confirmed"] = True
                                st.session_state["gps_detected"] = "manual"
                                st.rerun()
                else:
                    st.caption("ℹ️ Axtarışa uyğun məkan tapılmadı. Məsələn: *Port Baku*, *Torqovaya*, *Yasamal*, *Əhmədli*, *Atatürk pr.*")

            cur_p_keys = list(LOCATION_PRESETS.keys())
            c_idx = cur_p_keys.index(cur_loc) if cur_loc in cur_p_keys else 0
            new_preset = st.selectbox(
                "Və ya siyahıdan seçin (80+ Bakı məkanı):",
                cur_p_keys,
                index=c_idx,
                key="tab1_preset_select",
            )
            if new_preset != st.session_state.get("selected_loc_name") and not t1_search_q:
                st.session_state["selected_loc_name"] = new_preset
                st.session_state["user_coords"] = LOCATION_PRESETS[new_preset]
                st.session_state["user_location_confirmed"] = True
                st.session_state["gps_detected"] = "manual"
                st.rerun()

            # Walking radius selector buttons + slider
            st.markdown("<div style='font-size: 13px; font-weight: 600; color: #94a3b8; margin-top: 8px;'>🚶 Piyada Məsafə Radiusu:</div>", unsafe_allow_html=True)
            r_cols = st.columns(5)
            radii_presets = [(300, "300m"), (500, "500m"), (750, "750m"), (1000, "1000m"), (1500, "1500m")]
            for r_col, (r_val, r_label) in zip(r_cols, radii_presets):
                with r_col:
                    btn_type = "primary" if walk_dist == r_val else "secondary"
                    if st.button(r_label, key=f"t1_rbtn_{r_val}", use_container_width=True, type=btn_type):
                        st.session_state["max_walking_dist"] = r_val
                        st.rerun()

            new_radius = st.slider(
                "Dəqiq metr tənzimlənməsi:",
                min_value=200,
                max_value=2000,
                value=int(st.session_state["max_walking_dist"]),
                step=50,
                key="tab1_walk_slider",
            )
            if new_radius != st.session_state["max_walking_dist"]:
                st.session_state["max_walking_dist"] = new_radius
                st.rerun()

        with tab_loc_col2:
            st.markdown("<div style='font-size: 13px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;'>🗺️ Cari Məkanınız & Yaxın Marketlər:</div>", unsafe_allow_html=True)

            # Build dataframe with User location + nearby supermarkets
            map_pts = [
                {
                    "Məkan": f"🔴 Siz ({cur_loc.split('/')[0].strip()})",
                    "Şəbəkə": "🔴 Sizin Məkanınız",
                    "lat": float(u_lat),
                    "lon": float(u_lon),
                    "Məsafə": "Siz buradasınız",
                }
            ]
            all_store_dists = []
            for s in STORES:
                d_m = calculate_distance_meters((u_lat, u_lon), (s["latitude"], s["longitude"]))
                all_store_dists.append((d_m, s))
            all_store_dists.sort(key=lambda x: x[0])

            cutoff_dist = max(walk_dist * 2.2, 2200)
            stores_to_show = [item for item in all_store_dists if item[0] <= cutoff_dist]
            if len(stores_to_show) < 5:
                stores_to_show = all_store_dists[:6]

            for d_m, s in stores_to_show:
                map_pts.append({
                    "Məkan": s["branch_name"],
                    "Şəbəkə": s["chain_slug"].title(),
                    "lat": float(s["latitude"]),
                    "lon": float(s["longitude"]),
                    "Məsafə": f"{int(d_m)}m (~{max(1, round(d_m / 80))} dəq piyada)",
                })

            loc_preview_df = pd.DataFrame(map_pts)
            render_map(
                loc_preview_df,
                lat="lat",
                lon="lon",
                color="Şəbəkə",
                hover_name="Məkan",
                hover_data=["Məsafə"],
                zoom=13.4,
                height=280,
                center=dict(lat=float(u_lat), lon=float(u_lon)),
            )

            # Quick summary badges of nearest stores
            top_stores = all_store_dists[:3]
            top_badges = []
            for d_m, s in top_stores:
                c_name = s["chain_slug"].title()
                b_name = s["branch_name"].split(" - ")[-1] if " - " in s["branch_name"] else s["branch_name"]
                walk_min = max(1, round(d_m / 80))
                rating = s.get("gmaps_rating", 4.4)
                top_badges.append(
                    f"<span style='display:inline-block; background:{card_bg}; border:1px solid {card_border}; border-radius:6px; padding:3px 8px; margin:2px 3px 2px 0; font-size:11px; color:{card_text};'>"
                    f"🏪 <b>{c_name}</b> ({b_name}): <b>{int(d_m)}m</b> · ~{walk_min} dəq · ⭐{rating}</span>"
                )
            st.markdown(f"<div style='margin-top: 4px; margin-bottom: 6px;'>{' '.join(top_badges)}</div>", unsafe_allow_html=True)

            # Re-check GPS button
            if st.button("📡 Brauzer GPS-ini Yenidən Yoxla", key="t1_refresh_gps_btn", use_container_width=True):
                st.session_state["user_location_confirmed"] = False
                st.session_state["last_auto_gps"] = None
                st.session_state["gps_detected"] = None
                st.rerun()

    col_basket_mgr, col_optimizer_view = st.columns([1, 1.4], gap="large")

    with col_basket_mgr:
        st.markdown("### 🛒 Səbətiniz")

        # Quick preset buttons
        st.markdown(f"<div style='font-size: 13px; font-weight: 600; color: {sub_text}; margin-bottom: 6px;'>⚡ Hazır Səbət Şablonları:</div>", unsafe_allow_html=True)
        col_p1, col_p2, col_p3 = st.columns(3)
        with col_p1:
            if st.button("🍳 Səhər Yeməyi", key="preset_breakfast", use_container_width=True):
                clear_basket_keys()
                st.session_state.basket = [
                    {"barcode": PRODUCTS[0]["barcode"], "canonical_name": PRODUCTS[0]["canonical_name"], "brand": PRODUCTS[0]["brand"], "quantity": 2.0, "unit": "liter", "cat_slug": PRODUCTS[0]["cat_slug"]},
                    {"barcode": PRODUCTS[4]["barcode"], "canonical_name": PRODUCTS[4]["canonical_name"], "brand": PRODUCTS[4]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[4]["cat_slug"]},
                    {"barcode": PRODUCTS[10]["barcode"], "canonical_name": PRODUCTS[10]["canonical_name"], "brand": PRODUCTS[10]["brand"], "quantity": 1.0, "unit": "piece", "cat_slug": PRODUCTS[10]["cat_slug"]},
                    {"barcode": PRODUCTS[11]["barcode"], "canonical_name": PRODUCTS[11]["canonical_name"], "brand": PRODUCTS[11]["brand"], "quantity": 2.0, "unit": "piece", "cat_slug": PRODUCTS[11]["cat_slug"]},
                ]
                st.rerun()

        with col_p2:
            if st.button("🥗 Meyvə & Tərəvəz", key="preset_produce", use_container_width=True):
                clear_basket_keys()
                st.session_state.basket = [
                    {"barcode": PRODUCTS[28]["barcode"], "canonical_name": PRODUCTS[28]["canonical_name"], "brand": PRODUCTS[28]["brand"], "quantity": 2.0, "unit": "kg", "cat_slug": PRODUCTS[28]["cat_slug"]},
                    {"barcode": PRODUCTS[29]["barcode"], "canonical_name": PRODUCTS[29]["canonical_name"], "brand": PRODUCTS[29]["brand"], "quantity": 1.5, "unit": "kg", "cat_slug": PRODUCTS[29]["cat_slug"]},
                    {"barcode": PRODUCTS[30]["barcode"], "canonical_name": PRODUCTS[30]["canonical_name"], "brand": PRODUCTS[30]["brand"], "quantity": 3.0, "unit": "kg", "cat_slug": PRODUCTS[30]["cat_slug"]},
                    {"barcode": PRODUCTS[32]["barcode"], "canonical_name": PRODUCTS[32]["canonical_name"], "brand": PRODUCTS[32]["brand"], "quantity": 1.5, "unit": "kg", "cat_slug": PRODUCTS[32]["cat_slug"]},
                ]
                st.rerun()

        with col_p3:
            if st.button("🏠 Ailəvi Həftəlik", key="preset_family", use_container_width=True):
                clear_basket_keys()
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
            f_search = st.text_input("Məhsul axtarışı:", key="basket_prod_search", placeholder="Məs: Süd, Yağ, Çay, Kartof...")

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

                is_kg = (sel_prod.get("unit") == "kg")
                if is_kg:
                    st.markdown("<div style='font-size: 13px; font-weight: 700; color: #10b981; margin: 6px 0 2px 0;'>⚖️ Çəki Məhsulu — İstədiyiniz Çəkini Daxil Edin:</div>", unsafe_allow_html=True)
                    
                    # Quick weight presets
                    chip_cols = st.columns(5)
                    for chip_val, c_col in zip([0.5, 1.0, 1.5, 2.0, 3.0], chip_cols):
                        with c_col:
                            if st.button(f"{chip_val} kq", key=f"adder_chip_{chip_val}", use_container_width=True):
                                st.session_state["adder_kg_val"] = chip_val
                                st.rerun()

                    cur_adder_kg = float(st.session_state.get("adder_kg_val", 1.0))
                    new_qty = st.number_input(
                        "Dəqiq çəki (kq):",
                        min_value=0.05,
                        max_value=50.0,
                        value=cur_adder_kg,
                        step=0.1,
                        format="%.2f",
                        key="new_qty_kg_input",
                        help="İstənilən çəkini klaviatura ilə əllə daxil edin (məs: 0.75, 1.35, 2.40 kq)",
                    )
                    # Average price for estimate
                    p_prices = [get_effective_price(sel_prod, ck) for ck in ["bravo", "araz", "oba", "bazarstore", "almarket", "neptun", "spar"]]
                    avg_price = sum(p_prices) / len(p_prices) if p_prices else float(sel_prod.get("base_price", 1.0))
                    est_total = round(avg_price * new_qty, 2)
                    st.markdown(
                        f"<div style='background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 8px 12px; margin: 6px 0 10px 0; font-size: 13px; color: #34d399;'>"
                        f"⚖️ Seçilmiş: <b>{new_qty:.2f} kq</b> | 💰 Təxmini Məbləğ: <b>~{est_total:.2f} ₼</b> (1 kq ≈ {avg_price:.2f} ₼)"
                        f"</div>",
                        unsafe_allow_html=True,
                    )
                else:
                    new_qty = st.number_input(
                        "Say (ədəd / litr):",
                        min_value=1.0,
                        max_value=100.0,
                        value=1.0,
                        step=1.0,
                        format="%.0f",
                        key="new_qty_count",
                    )

                if st.button("Səbətə Əlavə Et", key="btn_add_to_basket", type="primary", use_container_width=True):
                    existing = next((item for item in st.session_state.basket if item["barcode"] == sel_prod["barcode"]), None)
                    if existing:
                        existing["quantity"] = round(existing["quantity"] + new_qty, 2)
                    else:
                        st.session_state.basket.append({
                            "barcode": sel_prod["barcode"],
                            "canonical_name": sel_prod["canonical_name"],
                            "brand": sel_prod["brand"],
                            "quantity": round(new_qty, 2),
                            "unit": sel_prod.get("unit", "ədəd"),
                            "cat_slug": sel_prod["cat_slug"],
                        })
                    clear_basket_keys()
                    st.rerun()
            else:
                st.info("Axtarışa uyğun məhsul tapılmadı.")

        # Display Current Basket Table
        if not st.session_state.basket:
            st.info("Səbətiniz boşdur. Yuxarıdakı şablonlardan birini seçin və ya məhsul əlavə edin.")
        else:
            st.markdown(f"**Səbətdəki Məhsullar ({len(st.session_state.basket)} növ):**")
            for idx, item in enumerate(st.session_state.basket):
                is_kg = (item.get("unit") == "kg")
                unit_label = "kq" if is_kg else ("L" if item.get("unit") == "liter" else "ədəd")

                c_name, c_qty, c_del = st.columns([2.5, 1.8, 0.4])

                with c_name:
                    st.markdown(f"**{item['canonical_name']}**")
                    if is_kg:
                        st.markdown(f"<span style='font-size: 11px; color: #10b981; font-weight: 700; background: rgba(16,185,129,0.15); padding: 2px 6px; border-radius: 4px;'>⚖️ Çəki: {item['quantity']:.2f} kq</span>", unsafe_allow_html=True)
                    else:
                        st.markdown(f"<span style='font-size: 11px; color: #94a3b8; font-weight: 600;'>📦 {unit_label}</span>", unsafe_allow_html=True)

                with c_qty:
                    cur_qty = float(item["quantity"])
                    bqty_key = f"bqty_{item['barcode']}_{idx}"
                    if is_kg:
                        val = st.number_input(
                            f"Çəki (kq) - {item['canonical_name']}",
                            min_value=0.05,
                            max_value=50.0,
                            value=cur_qty,
                            step=0.1,
                            format="%.2f",
                            key=bqty_key,
                            label_visibility="collapsed",
                            help=f"Dəqiq çəkini klaviatura ilə daxil edin (məs: 0.75, 1.35, 2.40)",
                        )
                        if abs(val - cur_qty) > 0.001:
                            item["quantity"] = round(val, 2)
                            st.rerun()
                    else:
                        val = st.number_input(
                            f"Miqdar - {item['canonical_name']}",
                            min_value=1.0,
                            max_value=100.0,
                            value=cur_qty,
                            step=1.0,
                            format="%.0f",
                            key=bqty_key,
                            label_visibility="collapsed",
                            help="Say daxil edin",
                        )
                        if abs(val - cur_qty) > 0.001:
                            item["quantity"] = float(int(val))
                            st.rerun()

                with c_del:
                    if st.button("🗑️", key=f"del_{idx}", help="Səbətdən sil"):
                        st.session_state.basket.pop(idx)
                        clear_basket_keys()
                        st.rerun()

            if st.button("Səbəti Təmizlə", key="clear_basket_btn", use_container_width=True):
                st.session_state.basket = []
                clear_basket_keys()
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
                    single_walk_url = get_gmaps_walking_dir_url((u_lat, u_lon), (single["lat"], single["lon"]))
                    s_rating = single.get("gmaps_rating", 4.5)
                    s_revs = single.get("gmaps_reviews", 1200)
                    s_hours = single.get("opening_hours", "08:00 – 23:00")

                    render_html(f"""
                    <div class="store-card" style="border-top: 4px solid {single['chain_color']};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span class="store-badge" style="background: {single['chain_color']};">{single['chain_name']}</span>
                            <span style="font-size: 12px; color: {sub_text}; font-weight: 600;">📍 {single['distance_km']} km məsafə</span>
                        </div>
                        <h4 style="margin: 0 0 4px 0; color: {card_text}; font-size: 17px;">{single['branch_name']}</h4>
                        <p style="font-size: 13px; color: {sub_text}; margin-bottom: 8px;">{single['address']}</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; margin-bottom: 12px;">
                            <span style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 700;">
                                ⭐ {s_rating} ({s_revs:,} Google rəy)
                            </span>
                            <span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 600;">
                                🕒 {s_hours}
                            </span>
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: {card_text}; margin-bottom: 4px;">
                            Cəmi: {single['total_cost']:.2f} ₼
                        </div>
                    </div>
                    """)

                    st.link_button(
                        "🗺️ Google Maps-də Marşrutu Aç (Piyada 🚶)",
                        single_walk_url,
                        type="primary",
                        use_container_width=True,
                    )

                    with st.expander(f"🛒 Səbət tərkibi ({len(single['items'])} məhsul)", expanded=True):
                        render_basket_items_table(single["items"], dark=dark_mode)

                with card_col2:
                    if is_split_viable and split:
                        s1 = split["s1"]
                        s2 = split["s2"]
                        split_card_bg = "rgba(16, 185, 129, 0.12)" if dark_mode else "#f0fdf4"
                        split_card_border = "#10b981"
                        split_card_title = "#6ee7b7" if dark_mode else "#166534"
                        split_card_price = "#34d399" if dark_mode else "#15803d"
                        split_walk_url = get_gmaps_multistop_walking_dir_url(
                            (u_lat, u_lon),
                            (s1["lat"], s1["lon"]),
                            (s2["lat"], s2["lon"]),
                        )

                        render_html(f"""
                        <div class="store-card" style="border: 1px solid {split_card_border}; border-top: 4px solid {split_card_border}; background: {split_card_bg};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span class="savings-badge">✨ {split['savings_azn']:.2f} ₼ Qənaət ({split['savings_pct']}%)</span>
                                <span style="font-size: 12px; color: {split_card_price}; font-weight: 700;">🚶 {split['walking_meters']}m aralı</span>
                            </div>
                            <h4 style="margin: 0 0 4px 0; color: {split_card_title}; font-size: 17px;">1. {s1['branch_name']} + 2. {s2['branch_name']}</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; margin-bottom: 12px;">
                                <span style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 600;">
                                    ⭐ {s1.get('gmaps_rating', 4.5)} {s1['chain_name']} ({s1.get('gmaps_reviews', 1200):,} rəy)
                                </span>
                                <span style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 600;">
                                    ⭐ {s2.get('gmaps_rating', 4.5)} {s2['chain_name']} ({s2.get('gmaps_reviews', 1200):,} rəy)
                                </span>
                            </div>
                            <div style="font-size: 22px; font-weight: 800; color: {split_card_price}; margin-bottom: 4px;">
                                Cəmi: {split['total_cost']:.2f} ₼ <span style="font-size: 14px; text-decoration: line-through; color: {sub_text};">{single['total_cost']:.2f} ₼</span>
                            </div>
                        </div>
                        """)

                        st.link_button(
                            "🧭 Google Maps 2-Market Marşrutu Aç (Multi-Stop 🚶)",
                            split_walk_url,
                            type="primary",
                            use_container_width=True,
                        )

                        with st.expander(f"🛒 1-ci Market: {s1['branch_name']} ({len(split['s1_items'])} məhsul)", expanded=True):
                            render_basket_items_table(split["s1_items"], dark=dark_mode)

                        with st.expander(f"🛒 2-ci Market: {s2['branch_name']} ({len(split['s2_items'])} məhsul)", expanded=True):
                            render_basket_items_table(split["s2_items"], dark=dark_mode)
                    else:
                        st.info("ℹ️ Seçilmiş piyada radiusunda qiymət fərqi 0.15 ₼-dən az olduğu üçün tək marketdən alış-veriş etmək ən optimal qərardır.")

                # Live Embedded Google Maps Viewer
                st.markdown("<div style='height: 8px;'></div>", unsafe_allow_html=True)
                with st.expander("🗺️ Canlı Google Maps Xəritəsi & Marşrut (İnteraktiv)", expanded=False):
                    st.caption("Google Maps üzərində cari məkanınızdan supermarketə qədər olan dəqiq piyada marşrutu.")
                    if is_split_viable and split:
                        render_gmaps_embed_route(
                            origin=(u_lat, u_lon),
                            destination=(split["s2"]["lat"], split["s2"]["lon"]),
                            waypoint=(split["s1"]["lat"], split["s1"]["lon"]),
                            height=380,
                        )
                    else:
                        render_gmaps_embed_route(
                            origin=(u_lat, u_lon),
                            destination=(single["lat"], single["lon"]),
                            height=380,
                        )


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
        render_comparison_matrix_table(matrix_df, dark=dark_mode)
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
                template="plotly_dark" if dark_mode else "plotly_white",
                paper_bgcolor="#1e293b" if dark_mode else "#ffffff",
                plot_bgcolor="#1e293b" if dark_mode else "#ffffff",
                font=dict(color="#f8fafc" if dark_mode else "#0f172a"),
            )
            _safe_plotly_chart(fig_bar)


# =============================================================================
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
            fl_box_bg = "#0f172a" if dark_mode else "#f8fafc"
            st.markdown(
                f"""
                <div class="store-card" style="border-top: 4px solid {fl['color']}; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="store-badge" style="background: {fl['color']};">{fl['chain']}</span>
                        <span class="promo-tag">🔥 {fl['discount']}</span>
                    </div>
                    <h4 style="margin: 4px 0 2px 0; color: {card_text};">{fl['title']}</h4>
                    <p style="font-size: 12px; color: {sub_text}; margin-bottom: 12px;">📅 {fl['dates']}</p>
                    <div style="background: {fl_box_bg}; border: 1px solid {card_border}; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: 700; color: {sub_text}; margin-bottom: 4px;">Seçilmiş Təkliflər:</div>
                        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: {card_text};">
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
        st.markdown(f"<div style='font-size: 13px; font-weight: 600; color: {sub_text}; margin-bottom: 6px;'>Sürətli Nümunə Qəbzlər:</div>", unsafe_allow_html=True)
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
        fig_index.update_layout(
            showlegend=False,
            yaxis_range=[0, totals_df["Ümumi Səbət Dəyəri (₼)"].max() * 1.15],
            template="plotly_dark" if dark_mode else "plotly_white",
            paper_bgcolor="#1e293b" if dark_mode else "#ffffff",
            plot_bgcolor="#1e293b" if dark_mode else "#ffffff",
            font=dict(color="#f8fafc" if dark_mode else "#0f172a"),
        )
        _safe_plotly_chart(fig_index)

    with col_an2:
        st.markdown(f"#### 📍 Bakı & Regionlar üzrə Market Şəbəkəsi ({len(STORES)} Filial)")
        store_map_df = pd.DataFrame([
            {
                "Filial": s["branch_name"],
                "Şəbəkə": s["chain_slug"].title(),
                "Ərazi": s["neighborhood"],
                "Google Reytinqi ⭐": f"⭐ {s.get('gmaps_rating', 4.4)} ({s.get('gmaps_reviews', 1200):,} rəy)",
                "İş Saatları 🕒": s.get("opening_hours", "08:00 – 23:00"),
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
            hover_data=["Ərazi", "Google Reytinqi ⭐", "İş Saatları 🕒"],
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
    render_dispersion_table(disp_df, dark=dark_mode)


# =============================================================================
# TAB 4: LOYALLIQ & RETAIL MEDIA (CASHBACK & BRAND BOOST)
# =============================================================================
with tab_loyalty:
    st.markdown("### 🎁 Sebet Loyallıq & Retail Media Şəbəkəsi")
    st.markdown("İstehlakçılar üçün avtomatlaşdırılmış keşbek və FMCG brendləri üçün rəqəmsal reklam platforması.")

    col_user, col_media = st.columns(2, gap="large")

    with col_user:
        st.markdown("#### 💳 İstifadəçi Keşbek Balansı")
        curr_u = st.session_state.get("current_user")
        user_pts = curr_u.get("sebet_points", 250) if curr_u else st.session_state.get("points", 250)
        card_holder = curr_u["full_name"] if curr_u else "Qonaq İstifadəçi"
        card_tier = curr_u.get("membership_tier", "SEBET PLATINUM CARD") if curr_u else "SEBET QONAQ KARTI"
        card_num = f"•••• •••• •••• {curr_u['id']:04d}" if curr_u else "•••• •••• •••• 4892"

        st.markdown(
            f"""
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); border: 1px solid #334155;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">{card_tier}</div>
                    <span style="font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 8px; border-radius: 6px; font-weight: 700;">{'🟢 DAXİL OLUB' if curr_u else '⚪ QONAQ'}</span>
                </div>
                <div style="font-size: 28px; font-weight: 800; margin: 12px 0 4px 0; color: #10b981;">{user_pts} Xal</div>
                <div style="font-size: 14px; color: #cbd5e1;">Real Dəyəri: <b>{user_pts / 100:.2f} AZN</b> Keşbek · Sahib: <b>{card_holder}</b></div>
                <div style="margin-top: 20px; font-size: 12px; color: #94a3b8; font-family: monospace;">{card_num}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<br/>", unsafe_allow_html=True)
        st.markdown("##### 🎟️ Xalları Endirim Vayçerinə Çevir")
        max_v = max(50, min(user_pts, 500))
        voucher_pts = st.slider("İstifadə ediləcək xal miqdarı:", min_value=50, max_value=max(50, user_pts) if user_pts >= 50 else 50, value=min(100, max_v), step=50)
        voucher_val = voucher_pts / 100.0

        if st.button("Endirim Barkodu Yarat", key="create_voucher_btn", type="primary", use_container_width=True):
            if user_pts >= voucher_pts:
                new_pts = user_pts - voucher_pts
                st.session_state["points"] = new_pts
                if curr_u:
                    user_db.update_user_points(curr_u["id"], new_pts)
                    curr_u["sebet_points"] = new_pts
                    st.session_state["current_user"] = curr_u
                st.success(f"Təbriklər! {voucher_val:.2f} AZN dəyərində vayçer aktivləşdirildi.")
                st.code(f"SEBET-AZN-{voucher_val:.2f}-PROMO-8291", language="bash")
                st.caption("Bu barkodu Bravo, Araz və ya OBA kassasında skan edərək dərhal endirim əldə edə bilərsiniz.")
                st.rerun()
            else:
                st.error("Balansınızda kifayət qədər xal yoxdur!")

    with col_media:
        st.markdown("#### 📣 FMCG Retail Media & Brand Boost")
        st.markdown("Milla, Westgold, Ariel kimi qlobal və yerli brendlərin xüsusi təklifləri:")

        wg_bg = "rgba(245, 158, 11, 0.12)" if dark_mode else "#fffbeb"
        wg_border = "rgba(245, 158, 11, 0.3)" if dark_mode else "#fef3c7"
        wg_title = "#fbbf24" if dark_mode else "#b45309"
        wg_text = "#fde68a" if dark_mode else "#78350f"

        mil_bg = "rgba(16, 185, 129, 0.12)" if dark_mode else "#f0fdf4"
        mil_border = "rgba(16, 185, 129, 0.3)" if dark_mode else "#dcfce7"
        mil_title = "#34d399" if dark_mode else "#15803d"
        mil_text = "#a7f3d0" if dark_mode else "#166534"

        ar_bg = "rgba(59, 130, 246, 0.12)" if dark_mode else "#eff6ff"
        ar_border = "rgba(59, 130, 246, 0.3)" if dark_mode else "#dbeafe"
        ar_title = "#60a5fa" if dark_mode else "#1d4ed8"
        ar_text = "#bfdbfe" if dark_mode else "#1e40af"

        st.markdown(
            f"""
            <div style="background: {wg_bg}; border: 1px solid {wg_border}; padding: 16px; border-radius: 12px; margin-bottom: 12px;">
                <div style="font-weight: 700; color: {wg_title};">🌟 Westgold 82.5% Kərə Yağı — 2x Keşbek</div>
                <div style="font-size: 13px; color: {wg_text};">Bu həftə Westgold kərə yağı alan istifadəçilərə hər qutuda <b>+40 Sebet xalı</b> hədiyyə!</div>
            </div>
            <div style="background: {mil_bg}; border: 1px solid {mil_border}; padding: 16px; border-radius: 12px; margin-bottom: 12px;">
                <div style="font-weight: 700; color: {mil_title};">🥛 Milla Süd Məhsulları Kampaniyası</div>
                <div style="font-size: 13px; color: {mil_text};">Səbətinizə 3 ədəd Milla məhsulu əlavə etdikdə avtomatik <b>0.50 AZN dərhal endirim</b> tətbiq olunur.</div>
            </div>
            <div style="background: {ar_bg}; border: 1px solid {ar_border}; padding: 16px; border-radius: 12px;">
                <div style="font-weight: 700; color: {ar_title};">🧺 Ariel Yuyucu Toz 7kg Eko-Paket</div>
                <div style="font-size: 13px; color: {ar_text};">Həftənin seçilmiş təmizlik məhsulu. Bravo və Bazarstore filiallarında xüsusi qiymət zəmanəti.</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


# =============================================================================
# TAB 7: İSTİFADƏÇİ HESABI & GİRİŞ (USER AUTH & DATABASE)
# =============================================================================
with tab_auth:
    st.markdown("### 👤 İstifadəçi Hesabı və Giriş (User Account & Database)")
    st.markdown(
        "Sebet platformasında qeydiyyatdan keçin, xallarınızı toplayın, ərzaq səbətlərinizi yadda saxlayın və canlı SQLite istifadəçi bazasını izləyin."
    )

    auth_card_bg = "#1e293b" if dark_mode else "#f8fafc"
    auth_card_border = "#334155" if dark_mode else "#e2e8f0"
    auth_text_color = "#f8fafc" if dark_mode else "#0f172a"
    auth_sub_color = "#94a3b8" if dark_mode else "#64748b"

    is_logged_in = st.session_state.get("user_authenticated", False)
    current_usr = st.session_state.get("current_user", None)

    if is_logged_in and current_usr:
        u_id = current_usr["id"]
        u_full = current_usr.get("full_name", "İstifadəçi")
        u_name = current_usr.get("username", "")
        u_email = current_usr.get("email", "")
        u_tier = current_usr.get("membership_tier", "Sebet Platinum")
        u_loc = current_usr.get("preferred_location", "28 May m.")
        u_pts = current_usr.get("sebet_points", 0)

        st.markdown(
            f"""
            <div style="background: {auth_card_bg}; border: 1.5px solid #10b981; border-radius: 16px; padding: 22px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 50%; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                            {u_full[0].upper() if u_full else 'U'}
                        </div>
                        <div>
                            <div style="font-size: 20px; font-weight: 800; color: {auth_text_color};">{u_full}</div>
                            <div style="font-size: 13px; color: {auth_sub_color};">@{u_name} &bull; {u_email} &bull; 📍 {u_loc}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 20px;">
                            ⭐ {u_tier}
                        </span>
                    </div>
                </div>
                <hr style="border: 0; border-top: 1px solid {auth_card_border}; margin: 16px 0;" />
                <div style="display: flex; gap: 30px; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 12px; color: {auth_sub_color}; text-transform: uppercase; font-weight: 600;">Balans</div>
                        <div style="font-size: 22px; font-weight: 800; color: #10b981;">{u_pts} Xal <span style="font-size: 14px; color: {auth_text_color}; font-weight: 500;">({u_pts / 100:.2f} ₼)</span></div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: {auth_sub_color}; text-transform: uppercase; font-weight: 600;">Hesab Statusu</div>
                        <div style="font-size: 16px; font-weight: 700; color: {auth_text_color}; margin-top: 4px;">✅ Aktiv & Doğrulanmış</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: {auth_sub_color}; text-transform: uppercase; font-weight: 600;">Təhlükəsizlik</div>
                        <div style="font-size: 16px; font-weight: 700; color: {auth_text_color}; margin-top: 4px;">🔒 PBKDF2-HMAC-SHA256</div>
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        col_p1, col_p2, col_p3 = st.columns([1.2, 1.2, 1])

        with col_p1:
            st.markdown("#### 💾 Səbət Sinxronizasiyası")
            current_basket_len = len(st.session_state.get("basket", []))
            st.caption(f"Cari aktiv səbətinizdə **{current_basket_len}** məhsul var.")
            if st.button("💾 Cari Səbəti Bazada Yadda Saxla", key="btn_save_basket_main", use_container_width=True):
                ok, msg = user_db.save_user_basket(u_id, st.session_state.get("basket", []))
                if ok:
                    st.success("✅ Səbətiniz SQLite məlumat bazasında uğurla yadda saxlanıldı!")
                else:
                    st.error(f"Xəta: {msg}")

            if st.button("🔄 Bazadan Yadda Saxlanmış Səbəti Yüklə", key="btn_load_basket_main", use_container_width=True):
                saved_b = user_db.load_user_basket(u_id)
                if saved_b:
                    st.session_state["basket"] = saved_b
                    st.success(f"✅ {len(saved_b)} məhsul bazadan uğurla aktiv səbətə bərpa edildi!")
                    st.rerun()
                else:
                    st.info("ℹ️ Bazada yadda saxlanmış səbət tapılmadı.")

        with col_p2:
            st.markdown("#### 🎁 Loyallıq & Xal Əlavəsi")
            st.caption("Alış-veriş və qəbz skanı zamanı toplanan bonus xallar.")
            bonus_col1, bonus_col2 = st.columns(2)
            with bonus_col1:
                if st.button("➕ +50 Sınaq Xalı", key="btn_add_pts_50", use_container_width=True):
                    new_pts = user_db.update_user_points(u_id, 50)
                    st.session_state["current_user"]["sebet_points"] = new_pts
                    st.session_state["points"] = new_pts
                    st.success("+50 Xal əlavə edildi!")
                    st.rerun()
            with bonus_col2:
                if st.button("➕ +100 Sınaq Xalı", key="btn_add_pts_100", use_container_width=True):
                    new_pts = user_db.update_user_points(u_id, 100)
                    st.session_state["current_user"]["sebet_points"] = new_pts
                    st.session_state["points"] = new_pts
                    st.success("+100 Xal əlavə edildi!")
                    st.rerun()

        with col_p3:
            st.markdown("#### 🚪 Çıxış")
            st.caption("Hesabınızdan çıxmaq və qonaq rejiminə keçmək.")
            if st.button("🚪 Hesabdan Çıxış Et", key="btn_logout_main", type="secondary", use_container_width=True):
                st.session_state["user_authenticated"] = False
                st.session_state["current_user"] = None
                st.session_state["points"] = 250
                st.toast("Hesabdan çıxış edildi", icon="🚪")
                st.rerun()

    else:
        st.info("💡 Ərzaq siyahınızı yadda saxlamaq, keşbek xalları toplamaq və endirim çekləri əldə etmək üçün daxil olun və ya qeydiyyatdan keçin.")

        auth_subtab_login, auth_subtab_reg = st.tabs(["🔑 Giriş Et (Login)", "📝 Yeni Qeydiyyat (Register)"])

        with auth_subtab_login:
            st.markdown("#### Giriş Məlumatları")
            
            if st.button("⚡ 1-Kliklə Demo Hesabla Giriş (Ali İskəndərli)", key="btn_demo_login_tab", use_container_width=True, type="primary"):
                demo_usr = user_db.authenticate_user("demo", "sebet2026")
                if demo_usr:
                    st.session_state["user_authenticated"] = True
                    st.session_state["current_user"] = demo_usr
                    st.session_state["points"] = demo_usr.get("sebet_points", 300)
                    saved_b = user_db.load_user_basket(demo_usr["id"])
                    if saved_b:
                        st.session_state["basket"] = saved_b
                    st.toast(f"Xoş gəldiniz, {demo_usr['full_name']}!", icon="👋")
                    st.rerun()

            st.markdown("<div style='text-align: center; color: #94a3b8; margin: 10px 0;'>və ya öz hesabınızla</div>", unsafe_allow_html=True)

            with st.form(key="tab_login_form"):
                login_user = st.text_input("İstifadəçi adı və ya E-poçt", placeholder="Məsələn: demo və ya ali@sebet.az")
                login_pwd = st.text_input("Şifrə", type="password", placeholder="••••••••")
                submit_login = st.form_submit_button("Daxil Ol", use_container_width=True)

                if submit_login:
                    if not login_user or not login_pwd:
                        st.error("Zəhmət olmasa istifadəçi adı və şifrəni daxil edin.")
                    else:
                        usr = user_db.authenticate_user(login_user.strip(), login_pwd)
                        if usr:
                            st.session_state["user_authenticated"] = True
                            st.session_state["current_user"] = usr
                            st.session_state["points"] = usr.get("sebet_points", 0)
                            saved_b = user_db.load_user_basket(usr["id"])
                            if saved_b:
                                st.session_state["basket"] = saved_b
                            st.success(f"Xoş gəldiniz, {usr['full_name']}!")
                            st.rerun()
                        else:
                            st.error("İstifadəçi adı və ya şifrə yanlışdır.")

        with auth_subtab_reg:
            st.markdown("#### Yeni İstifadəçi Hesabı Yarat")
            st.markdown(
                """
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 10px; padding: 12px; margin-bottom: 15px; font-size: 13px; color: #10b981;">
                    🎁 <b>Xoş Gəldin Hədiyyəsi:</b> Qeydiyyatdan keçən hər yeni istifadəçiyə <b>250 Sebet Xalı (2.50 AZN)</b> hədiyyə olunur!
                </div>
                """,
                unsafe_allow_html=True,
            )
            with st.form(key="tab_register_form"):
                reg_col1, reg_col2 = st.columns(2)
                with reg_col1:
                    reg_fullname = st.text_input("Tam Adınız", placeholder="Məsələn: Rəşad Məmmədov")
                    reg_username = st.text_input("İstifadəçi Adı", placeholder="reshad99")
                with reg_col2:
                    reg_email = st.text_input("E-poçt Ünvanı", placeholder="reshad@example.com")
                    reg_loc = st.selectbox("Seçilmiş Ərazi / Supermarket", ["28 May m.", "Gənclik m.", "Nərimanov m.", "Elmlər m.", "İnşaatçılar m.", "Əhmədli m.", "Xırdalan", "Sumqayıt"])

                reg_pass1 = st.text_input("Şifrə", type="password", placeholder="Ən azı 4 simvol")
                reg_pass2 = st.text_input("Şifrənin Təkrarı", type="password", placeholder="Şifrəni yenidən yazın")

                submit_reg = st.form_submit_button("Qeydiyyatdan Keç və Xalları Al", use_container_width=True, type="primary")

                if submit_reg:
                    if not reg_fullname or not reg_username or not reg_email or not reg_pass1:
                        st.error("Zəhmət olmasa bütün sahələri doldurun.")
                    elif len(reg_pass1) < 4:
                        st.error("Şifrə ən azı 4 simvoldan ibarət olmalıdır.")
                    elif reg_pass1 != reg_pass2:
                        st.error("Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.")
                    else:
                        ok, res = user_db.register_user(
                            username=reg_username.strip(),
                            email=reg_email.strip(),
                            password=reg_pass1,
                            full_name=reg_fullname.strip(),
                            initial_points=250,
                            preferred_location=reg_loc,
                        )
                        if ok:
                            st.session_state["user_authenticated"] = True
                            st.session_state["current_user"] = res
                            st.session_state["points"] = res.get("sebet_points", 250)
                            st.success(f"🎉 Təbriklər, {reg_fullname}! Hesabınız yaradıldı və 250 xal balansınıza köçürüldü.")
                            st.rerun()
                        else:
                            st.error(f"Qeydiyyat xətası: {res}")

    # =========================================================================
    # Live SQLite Database Inspector & Analytics
    # =========================================================================
    st.markdown("---")
    st.markdown("### 🗄️ İstifadəçilər Məlumat Bazası (SQLite Canlı İcmal)")
    st.caption("Bazada saxlanılan istifadəçi hesabları və təhlükəsizlik arxitekturası. (Şifrələr gizlədilib)")

    all_users = user_db.get_all_users_summary()
    total_users_count = len(all_users)
    total_db_points = sum(u.get("sebet_points", 0) for u in all_users)

    col_m1, col_m2, col_m3, col_m4 = st.columns(4)
    with col_m1:
        st.metric("👥 Qeydiyyatlı İstifadəçilər", f"{total_users_count} nəfər")
    with col_m2:
        st.metric("💎 Dövriyyədəki Xallar", f"{total_db_points:,} xal")
    with col_m3:
        st.metric("💰 Ümumi Keşbek Dəyəri", f"{total_db_points / 100:.2f} ₼")
    with col_m4:
        st.metric("🗄️ Baza Sistemi", "SQLite (sebet_users.db)")

    with st.expander("📋 Verilənlər Bazasındakı İstifadəçilərin Cədvəli (Live Data)", expanded=True):
        if all_users:
            import pandas as pd
            df_users = pd.DataFrame(all_users)
            df_display = df_users.rename(
                columns={
                    "id": "ID",
                    "full_name": "Tam Adı",
                    "username": "İstifadəçi Adı",
                    "email": "E-poçt",
                    "membership_tier": "Status",
                    "sebet_points": "Xal Balansı",
                    "preferred_location": "Ərazi",
                    "created_at": "Qeydiyyat Tarixi",
                    "last_login": "Son Giriş",
                }
            )
            st.dataframe(df_display, use_container_width=True, hide_index=True)
        else:
            st.info("Bazada hələ qeydiyyatdan keçmiş istifadəçi yoxdur.")

    st.markdown(
        """
        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 14px; font-size: 13px; color: #94a3b8;">
            🔒 <b>Təhlükəsizlik Zəmanəti:</b> İstifadəçi şifrələri verilənlər bazasında açıq mətn kimi saxlanılmır. Hər bir istifadəçi üçün unikal 16-baytlıq kriptoqrafik <code>salt</code> generasiya edilir və <code>PBKDF2-HMAC-SHA256</code> alqoritmi ilə 100,000 iterasiyada şifrələnir.
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

