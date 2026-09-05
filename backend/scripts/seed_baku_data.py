"""
SebEt Baku Grocery Intelligence — Realistic Seed Dataset.
Includes:
- 7 Supermarket Chains: Bravo, Araz, OBA, Bazarstore, Al Market, Neptun, Spar
- Physical store branches in Baku and regional hubs (Sumqayıt, Xırdalan, Gəncə)
- 8 Smart Categories (Dairy, Bakery, Meat, Pantry & Oils, Beverages & Tea, Sweets, Cleaning, Personal Care)
- Comprehensive Grocery SKUs with authentic local photos & full regular shelf pricing across all 7 chains
- Weekly promotional flyers for each chain
- Demo User: Ali Iskandarli (250 SebEt Points)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, init_db
from app.models import Chain, Store, Category, Product, StorePrice, Flyer, FlyerItem, User


CHAINS_DATA = [
    {
        "name": "Bravo",
        "slug": "bravo",
        "color": "#74b826",
        "logo_url": "/chains/bravo.png",
    },
    {
        "name": "Araz",
        "slug": "araz",
        "color": "#E30613",
        "logo_url": "/chains/araz.png",
    },
    {
        "name": "OBA",
        "slug": "oba",
        "color": "#009640",
        "logo_url": "/chains/oba.png",
    },
    {
        "name": "Bazarstore",
        "slug": "bazarstore",
        "color": "#D01026",
        "logo_url": "/chains/bazarstore.png",
    },
    {
        "name": "Al Market",
        "slug": "almarket",
        "color": "#00539B",
        "logo_url": "/chains/almarket.svg",
    },
    {
        "name": "Neptun",
        "slug": "neptun",
        "color": "#008CD2",
        "logo_url": "/chains/neptun.svg",
    },
    {
        "name": "Spar",
        "slug": "spar",
        "color": "#007A3D",
        "logo_url": "/chains/spar.svg",
    },
]

STORES_DATA = [
    # Bravo Branches
    {
        "chain_slug": "bravo",
        "branch_name": "Bravo 28 Mall",
        "neighborhood": "28 May",
        "voen": "1401564751",
        "obyekt_kodu": "0101",
        "address": "Bakı ş., Nəsimi r., 28 May küç., 28 Mall Ticarət Mərkəzi",
        "latitude": 40.3798,
        "longitude": 49.8475,
    },
    {
        "chain_slug": "bravo",
        "branch_name": "Bravo Koroğlu Hypermarket",
        "neighborhood": "Koroğlu",
        "voen": "1401564751",
        "obyekt_kodu": "0102",
        "address": "Bakı ş., Heydər Əliyev pr. 172, Koroğlu m.",
        "latitude": 40.4208,
        "longitude": 49.9192,
    },
    {
        "chain_slug": "bravo",
        "branch_name": "Bravo Yasamal",
        "neighborhood": "Yasamal",
        "voen": "1401564751",
        "obyekt_kodu": "0103",
        "address": "Bakı ş., Yasamal r., Abbas Mirzə Şərifzadə küç. 150",
        "latitude": 40.3882,
        "longitude": 49.8055,
    },
    {
        "chain_slug": "bravo",
        "branch_name": "Bravo Gəncə Mall",
        "neighborhood": "Gəncə",
        "voen": "1401564751",
        "obyekt_kodu": "0104",
        "address": "Gəncə ş., Heydər Əliyev prospekti, Gəncə Mall",
        "latitude": 40.6828,
        "longitude": 46.3606,
    },

    # Araz Branches
    {
        "chain_slug": "araz",
        "branch_name": "Araz 28 May",
        "neighborhood": "28 May",
        "voen": "1500843211",
        "obyekt_kodu": "0201",
        "address": "Bakı ş., Nəsimi r., Dilarə Əliyeva küç. 235",
        "latitude": 40.3812,
        "longitude": 49.8490,
    },
    {
        "chain_slug": "araz",
        "branch_name": "Araz Nərimanov",
        "neighborhood": "Nərimanov",
        "voen": "1500843211",
        "obyekt_kodu": "0202",
        "address": "Bakı ş., Nərimanov r., Təbriz küç. 54",
        "latitude": 40.4024,
        "longitude": 49.8712,
    },
    {
        "chain_slug": "araz",
        "branch_name": "Araz Elmlər",
        "neighborhood": "Elmlər",
        "voen": "1500843211",
        "obyekt_kodu": "0203",
        "address": "Bakı ş., Yasamal r., Zahid Xəlilov küç. 48",
        "latitude": 40.3745,
        "longitude": 49.8130,
    },
    {
        "chain_slug": "araz",
        "branch_name": "Araz Sumqayıt",
        "neighborhood": "Sumqayıt",
        "voen": "1500843211",
        "obyekt_kodu": "0204",
        "address": "Sumqayıt ş., Sülh küçəsi, 3-cü mikrorayon",
        "latitude": 40.5855,
        "longitude": 49.6317,
    },

    # OBA Branches
    {
        "chain_slug": "oba",
        "branch_name": "OBA 28 May",
        "neighborhood": "28 May",
        "voen": "1701928374",
        "obyekt_kodu": "0301",
        "address": "Bakı ş., Nəsimi r., Şamil Əzizbəyov küç. 140",
        "latitude": 40.3805,
        "longitude": 49.8460,
    },
    {
        "chain_slug": "oba",
        "branch_name": "OBA Nərimanov",
        "neighborhood": "Nərimanov",
        "voen": "1701928374",
        "obyekt_kodu": "0302",
        "address": "Bakı ş., Nərimanov r., Əhməd Rəcəbli küç. 12",
        "latitude": 40.4050,
        "longitude": 49.8680,
    },
    {
        "chain_slug": "oba",
        "branch_name": "OBA Nizami",
        "neighborhood": "Nizami",
        "voen": "1701928374",
        "obyekt_kodu": "0303",
        "address": "Bakı ş., Yasamal r., Nizami m., Zivərbəy Əhmədbəyov küç. 24",
        "latitude": 40.3790,
        "longitude": 49.8295,
    },
    {
        "chain_slug": "oba",
        "branch_name": "OBA Xırdalan",
        "neighborhood": "Xırdalan",
        "voen": "1701928374",
        "obyekt_kodu": "0304",
        "address": "Abşeron r., Xırdalan ş., Heydər Əliyev prospekti",
        "latitude": 40.4485,
        "longitude": 49.7547,
    },

    # Bazarstore Branches
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore 28 May",
        "neighborhood": "28 May",
        "voen": "1300293841",
        "obyekt_kodu": "0401",
        "address": "Bakı ş., Nəsimi r., Puşkin küç. 12",
        "latitude": 40.3780,
        "longitude": 49.8510,
    },
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore Yasamal",
        "neighborhood": "Yasamal",
        "voen": "1300293841",
        "obyekt_kodu": "0402",
        "address": "Bakı ş., Yasamal r., Həsən bəy Zərdabi küç. 78",
        "latitude": 40.3895,
        "longitude": 49.8120,
    },
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore Elmlər",
        "neighborhood": "Elmlər",
        "voen": "1300293841",
        "obyekt_kodu": "0403",
        "address": "Bakı ş., Yasamal r., Bəxtiyar Vahabzadə küç. 14",
        "latitude": 40.3718,
        "longitude": 49.8165,
    },
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore Gəncə",
        "neighborhood": "Gəncə",
        "voen": "1300293841",
        "obyekt_kodu": "0404",
        "address": "Gəncə ş., Atatürk prospekti 120",
        "latitude": 40.6780,
        "longitude": 46.3570,
    },

    # Al Market Branches
    {
        "chain_slug": "almarket",
        "branch_name": "Al Market 28 May",
        "neighborhood": "28 May",
        "voen": "1402394851",
        "obyekt_kodu": "0501",
        "address": "Bakı ş., Nəsimi r., Rəşid Behbudov küç. 65",
        "latitude": 40.3825,
        "longitude": 49.8445,
    },
    {
        "chain_slug": "almarket",
        "branch_name": "Al Market Nərimanov",
        "neighborhood": "Nərimanov",
        "voen": "1402394851",
        "obyekt_kodu": "0502",
        "address": "Bakı ş., Nərimanov r., Fətəli Xan Xoyski küç. 88",
        "latitude": 40.4010,
        "longitude": 49.8650,
    },
    {
        "chain_slug": "almarket",
        "branch_name": "Al Market Xırdalan",
        "neighborhood": "Xırdalan",
        "voen": "1402394851",
        "obyekt_kodu": "0503",
        "address": "Xırdalan ş., Qalubiyyə küç. 14",
        "latitude": 40.4510,
        "longitude": 49.7580,
    },
    {
        "chain_slug": "almarket",
        "branch_name": "Al Market Sumqayıt 1-ci mkr",
        "neighborhood": "Sumqayıt",
        "voen": "1402394851",
        "obyekt_kodu": "0504",
        "address": "Sumqayıt ş., 1-ci mikrorayon, Koroğlu pr.",
        "latitude": 40.5910,
        "longitude": 49.6640,
    },

    # Neptun Branches
    {
        "chain_slug": "neptun",
        "branch_name": "Neptun 28 May Vağzal",
        "neighborhood": "28 May",
        "voen": "1301827461",
        "obyekt_kodu": "0601",
        "address": "Bakı ş., Nəsimi r., Cəfər Cabbarlı meydanı, Dəmiryol Vağzalı",
        "latitude": 40.3815,
        "longitude": 49.8505,
    },
    {
        "chain_slug": "neptun",
        "branch_name": "Neptun Tiflis Prospekti",
        "neighborhood": "Yasamal",
        "voen": "1301827461",
        "obyekt_kodu": "0602",
        "address": "Bakı ş., Yasamal r., Tiflis pr. 3007",
        "latitude": 40.3950,
        "longitude": 49.8190,
    },
    {
        "chain_slug": "neptun",
        "branch_name": "Neptun Nərimanov",
        "neighborhood": "Nərimanov",
        "voen": "1301827461",
        "obyekt_kodu": "0603",
        "address": "Bakı ş., Nərimanov r., Ağa Nemətulla küç. 42",
        "latitude": 40.4040,
        "longitude": 49.8735,
    },

    # Spar Branches
    {
        "chain_slug": "spar",
        "branch_name": "Spar Səməd Vurğun",
        "neighborhood": "28 May",
        "voen": "1403847291",
        "obyekt_kodu": "0701",
        "address": "Bakı ş., Nəsimi r., Səməd Vurğun küç. 84",
        "latitude": 40.3830,
        "longitude": 49.8430,
    },
    {
        "chain_slug": "spar",
        "branch_name": "Spar Yasamal",
        "neighborhood": "Yasamal",
        "voen": "1403847291",
        "obyekt_kodu": "0702",
        "address": "Bakı ş., Yasamal r., Əsəd Əhmədov küç. 21",
        "latitude": 40.3920,
        "longitude": 49.8020,
    },
    {
        "chain_slug": "spar",
        "branch_name": "Spar Əhmədli",
        "neighborhood": "Əhmədli",
        "voen": "1403847291",
        "obyekt_kodu": "0703",
        "address": "Bakı ş., Xətai r., Məhəmməd Hadi küç. 68",
        "latitude": 40.3850,
        "longitude": 49.9530,
    },
]

CATEGORIES_DATA = [
    {
        "name_az": "Süd və Ağartı Məhsulları",
        "name_en": "Dairy & Eggs",
        "slug": "dairy-eggs",
        "icon_name": "Milk",
    },
    {
        "name_az": "Çörək və Qənnadı Məhsulları",
        "name_en": "Bakery",
        "slug": "bakery",
        "icon_name": "Cookie",
    },
    {
        "name_az": "Ət və Qastronomiya",
        "name_en": "Meat & Poultry",
        "slug": "meat-poultry",
        "icon_name": "Utensils",
    },
    {
        "name_az": "Ərzaq və Yağlar",
        "name_en": "Pantry & Oils",
        "slug": "pantry-cooking",
        "icon_name": "Utensils",
    },
    {
        "name_az": "Çay, Qəhvə və İçkilər",
        "name_en": "Beverages & Tea",
        "slug": "beverages-tea",
        "icon_name": "Coffee",
    },
    {
        "name_az": "Şirniyyat və Qəlyanaltı",
        "name_en": "Snacks & Sweets",
        "slug": "snacks-sweets",
        "icon_name": "Sparkles",
    },
    {
        "name_az": "Təmizlik və Məişət",
        "name_en": "Cleaning & Household",
        "slug": "cleaning-household",
        "icon_name": "Sparkles",
    },
    {
        "name_az": "Şəxsi Qulluq və Uşaq",
        "name_en": "Personal Care & Baby",
        "slug": "personal-care-baby",
        "icon_name": "Sparkles",
    },
]

PRODUCTS_DATA = [
    # 1. Dairy & Eggs
    {
        "barcode": "4760083300124",
        "canonical_name": "Milla Süd 2.5% Tetra Pak 1L",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "/products/milla_sud.png",
        "base_price": 2.35,
        "variations": {"oba": 2.15, "almarket": 2.12, "araz": 2.29, "bravo": 2.39, "bazarstore": 2.35, "neptun": 2.40, "spar": 2.38},
        "promo": {"chain": "oba", "promo_price": 1.99},
    },
    {
        "barcode": "4760083300254",
        "canonical_name": "Milla Kənd Üsulu Qatıq 3.2% 450g",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "450g",
        "image_url": "/products/milla_qatig.png",
        "base_price": 1.85,
        "variations": {"oba": 1.69, "almarket": 1.68, "araz": 1.79, "bravo": 1.89, "bazarstore": 1.85, "neptun": 1.90, "spar": 1.88},
        "promo": None,
    },
    {
        "barcode": "4760083300261",
        "canonical_name": "Milla Qatıq 3.2% Plastik Qab 1kg",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "1kg",
        "image_url": "/products/milla_qatig.png",
        "base_price": 2.55,
        "variations": {"oba": 2.35, "almarket": 2.30, "araz": 2.49, "bravo": 2.65, "bazarstore": 2.55, "neptun": 2.60, "spar": 2.58},
        "promo": None,
    },
    {
        "barcode": "4760083300308",
        "canonical_name": "Milla Xama 25% 300g",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "300g",
        "image_url": "/products/milla_xama.png",
        "base_price": 2.35,
        "variations": {"oba": 2.15, "almarket": 2.10, "araz": 2.29, "bravo": 2.39, "bazarstore": 2.35, "neptun": 2.45, "spar": 2.40},
        "promo": None,
    },
    {
        "barcode": "9415494000125",
        "canonical_name": "Westgold Kərə Yağı 82.5% 200g",
        "brand": "Westgold",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "/products/westgold.png",
        "base_price": 5.45,
        "variations": {"oba": 5.15, "almarket": 5.10, "araz": 5.35, "bravo": 5.50, "bazarstore": 5.45, "neptun": 5.55, "spar": 5.49},
        "promo": {"chain": "bravo", "promo_price": 4.79},
    },
    {
        "barcode": "9415494000194",
        "canonical_name": "Anchor Kərə Yağı 82.9% 500g",
        "brand": "Anchor",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "/products/anchor.png",
        "base_price": 13.90,
        "variations": {"oba": 13.20, "almarket": 13.10, "araz": 13.70, "bravo": 13.90, "bazarstore": 14.20, "neptun": 14.30, "spar": 14.10},
        "promo": {"chain": "bazarstore", "promo_price": 12.79},
    },
    {
        "barcode": "9415494000195",
        "canonical_name": "Anchor Kərə Yağı 82.5% 200g",
        "brand": "Anchor",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "/products/anchor.png",
        "base_price": 5.65,
        "variations": {"oba": 5.25, "almarket": 5.20, "araz": 5.55, "bravo": 5.75, "bazarstore": 5.65, "neptun": 5.80, "spar": 5.70},
        "promo": None,
    },
    {
        "barcode": "4820000888777",
        "canonical_name": "Slavyanoçka Kərə Yağı 82.5% 200g",
        "brand": "Slavyanoçka",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.90,
        "variations": {"oba": 4.45, "almarket": 4.40, "araz": 4.80, "bravo": 4.95, "bazarstore": 4.90, "neptun": 5.00, "spar": 4.95},
        "promo": None,
    },
    {
        "barcode": "4760083300407",
        "canonical_name": "Milla Kəsmik 9% 200g",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.75,
        "variations": {"oba": 1.55, "almarket": 1.52, "araz": 1.69, "bravo": 1.79, "bazarstore": 1.75, "neptun": 1.80, "spar": 1.78},
        "promo": None,
    },
    {
        "barcode": "4760055400123",
        "canonical_name": "Atena Ağ Pendir 400g",
        "brand": "Atena",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "400g",
        "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.80,
        "variations": {"oba": 4.35, "almarket": 4.30, "araz": 4.70, "bravo": 4.90, "bazarstore": 4.85, "neptun": 4.95, "spar": 4.85},
        "promo": None,
    },
    {
        "barcode": "4760123456789",
        "canonical_name": "Giləzi Kənd Yumurtası 10-lu",
        "brand": "Giləzi",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "10 ədəd",
        "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.45,
        "variations": {"oba": 2.19, "almarket": 2.15, "araz": 2.35, "bravo": 2.50, "bazarstore": 2.45, "neptun": 2.55, "spar": 2.50},
        "promo": {"chain": "araz", "promo_price": 1.95},
    },

    # 2. Bakery (Çörək və Qənnadı)
    {
        "barcode": "4760011223344",
        "canonical_name": "Zavod Çörəyi Ağ Dilimlənmiş 500g",
        "brand": "№1 Çörək Zavodu",
        "cat_slug": "bakery",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
        "base_price": 0.65,
        "variations": {"oba": 0.65, "almarket": 0.65, "araz": 0.65, "bravo": 0.65, "bazarstore": 0.65, "neptun": 0.65, "spar": 0.65},
        "promo": None,
    },
    {
        "barcode": "4760011223351",
        "canonical_name": "Kənd Təndir Çörəyi Təzə",
        "brand": "Milli Təndir",
        "cat_slug": "bakery",
        "unit": "piece",
        "pack_size": "1 ədəd",
        "image_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&auto=format&fit=crop&q=80",
        "base_price": 0.90,
        "variations": {"oba": 0.85, "almarket": 0.85, "araz": 0.90, "bravo": 1.00, "bazarstore": 0.95, "neptun": 1.10, "spar": 1.00},
        "promo": None,
    },
    {
        "barcode": "4760011223368",
        "canonical_name": "Baton Çörək Fransız Üsulu 400g",
        "brand": "№1 Çörək Zavodu",
        "cat_slug": "bakery",
        "unit": "piece",
        "pack_size": "400g",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
        "base_price": 0.80,
        "variations": {"oba": 0.75, "almarket": 0.75, "araz": 0.80, "bravo": 0.85, "bazarstore": 0.80, "neptun": 0.90, "spar": 0.85},
        "promo": None,
    },
    {
        "barcode": "4760011223375",
        "canonical_name": "Nazik Lavaş Paketi (5 ədəd)",
        "brand": "Bərəkət Lavaş",
        "cat_slug": "bakery",
        "unit": "piece",
        "pack_size": "5 ədəd",
        "image_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.10,
        "variations": {"oba": 0.95, "almarket": 0.95, "araz": 1.05, "bravo": 1.15, "bazarstore": 1.10, "neptun": 1.20, "spar": 1.15},
        "promo": None,
    },

    # 3. Meat & Poultry (Ət və Qastronomiya)
    {
        "barcode": "4760099887766",
        "canonical_name": "Təzə Mal Əti Sümüksüz 1kg",
        "brand": "Yerli Ferma",
        "cat_slug": "meat-poultry",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400&auto=format&fit=crop&q=80",
        "base_price": 18.50,
        "variations": {"oba": 16.90, "almarket": 16.80, "araz": 17.90, "bravo": 18.90, "bazarstore": 18.50, "neptun": 19.50, "spar": 18.90},
        "promo": None,
    },
    {
        "barcode": "4760099887773",
        "canonical_name": "Mərcan Təzə Broyler Toyuq 1kg",
        "brand": "Mərcan",
        "cat_slug": "meat-poultry",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.80,
        "variations": {"oba": 5.20, "almarket": 5.15, "araz": 5.60, "bravo": 5.95, "bazarstore": 5.85, "neptun": 6.10, "spar": 5.90},
        "promo": {"chain": "almarket", "promo_price": 4.89},
    },
    {
        "barcode": "4760099887780",
        "canonical_name": "Səhba Halal Südlü Sosis 350g",
        "brand": "Səhba",
        "cat_slug": "meat-poultry",
        "unit": "piece",
        "pack_size": "350g",
        "image_url": "https://images.unsplash.com/photo-1624726175512-19b9baf9fbd1?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.90,
        "variations": {"oba": 3.45, "almarket": 3.40, "araz": 3.80, "bravo": 4.10, "bazarstore": 3.95, "neptun": 4.20, "spar": 4.05},
        "promo": None,
    },
    {
        "barcode": "4760099887797",
        "canonical_name": "Hacı Turqay Həkim Kolbasası 500g",
        "brand": "Hacı Turqay",
        "cat_slug": "meat-poultry",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1624726175512-19b9baf9fbd1?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.60,
        "variations": {"oba": 4.95, "almarket": 4.90, "araz": 5.40, "bravo": 5.80, "bazarstore": 5.65, "neptun": 5.90, "spar": 5.75},
        "promo": None,
    },

    # 4. Pantry & Oils (Ərzaq və Yağlar)
    {
        "barcode": "4760032100147",
        "canonical_name": "Final Təmizlənmiş Günəbaxan Yağı 5L",
        "brand": "Final",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "5L",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
        "base_price": 18.90,
        "variations": {"oba": 17.50, "almarket": 17.40, "araz": 18.40, "bravo": 19.50, "bazarstore": 18.90, "neptun": 19.80, "spar": 19.20},
        "promo": {"chain": "oba", "promo_price": 16.49},
    },
    {
        "barcode": "4760032100154",
        "canonical_name": "Final Günəbaxan Yağı 1L",
        "brand": "Final",
        "cat_slug": "pantry-cooking",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.20,
        "variations": {"oba": 3.85, "almarket": 3.80, "araz": 4.10, "bravo": 4.35, "bazarstore": 4.25, "neptun": 4.40, "spar": 4.30},
        "promo": None,
    },
    {
        "barcode": "4760032100123",
        "canonical_name": "Möcüzə Qarğıdalı Yağı 1L",
        "brand": "Möcüzə",
        "cat_slug": "pantry-cooking",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.10,
        "variations": {"oba": 4.65, "almarket": 4.60, "araz": 4.95, "bravo": 5.30, "bazarstore": 5.20, "neptun": 5.40, "spar": 5.25},
        "promo": {"chain": "bazarstore", "promo_price": 4.49},
    },
    {
        "barcode": "4760012340019",
        "canonical_name": "Karmen Əla Növ Buğda Unu 2kg",
        "brand": "Karmen",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "2kg",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.85,
        "variations": {"oba": 2.55, "almarket": 2.50, "araz": 2.75, "bravo": 2.95, "bazarstore": 2.90, "neptun": 3.05, "spar": 2.95},
        "promo": None,
    },
    {
        "barcode": "4600605001234",
        "canonical_name": "Makfa Spagetti Makaron 500g",
        "brand": "Makfa",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.75,
        "variations": {"oba": 1.50, "almarket": 1.48, "araz": 1.69, "bravo": 1.85, "bazarstore": 1.75, "neptun": 1.90, "spar": 1.80},
        "promo": None,
    },
    {
        "barcode": "4760098765432",
        "canonical_name": "Bizim Süfrə Klassik Mayonez 380g",
        "brand": "Bizim Süfrə",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "380g",
        "image_url": "https://images.unsplash.com/photo-1528751014936-863e6e7a319c?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.65,
        "variations": {"oba": 2.35, "almarket": 2.30, "araz": 2.55, "bravo": 2.75, "bazarstore": 2.70, "neptun": 2.85, "spar": 2.75},
        "promo": None,
    },
    {
        "barcode": "4760078901265",
        "canonical_name": "Bizim Tarla Tomat Pastası 700g",
        "brand": "Bizim Tarla",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "700g",
        "image_url": "https://images.unsplash.com/photo-1546548970-71785318a17b?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.65,
        "variations": {"oba": 3.25, "almarket": 3.20, "araz": 3.50, "bravo": 3.75, "bazarstore": 3.65, "neptun": 3.85, "spar": 3.70},
        "promo": {"chain": "neptun", "promo_price": 3.19},
    },
    {
        "barcode": "4760078901272",
        "canonical_name": "Bizim Tarla Əla Növ Basmati Düyü 1kg",
        "brand": "Bizim Tarla",
        "cat_slug": "pantry-cooking",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.90,
        "variations": {"oba": 4.35, "almarket": 4.30, "araz": 4.75, "bravo": 5.10, "bazarstore": 4.95, "neptun": 5.20, "spar": 5.05},
        "promo": None,
    },
    {
        "barcode": "4760078901289",
        "canonical_name": "Azərşəkər Ağ Qənd 1kg",
        "brand": "Azərşəkər",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.15,
        "variations": {"oba": 1.95, "almarket": 1.92, "araz": 2.10, "bravo": 2.25, "bazarstore": 2.20, "neptun": 2.30, "spar": 2.20},
        "promo": None,
    },

    # 5. Beverages & Tea (Çay, Qəhvə və İçkilər)
    {
        "barcode": "4760012300124",
        "canonical_name": "Azərçay Buket Qara Çay 250g",
        "brand": "Azərçay",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "250g",
        "image_url": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.85,
        "variations": {"oba": 4.35, "almarket": 4.30, "araz": 4.65, "bravo": 5.10, "bazarstore": 4.85, "neptun": 5.20, "spar": 4.95},
        "promo": {"chain": "araz", "promo_price": 3.99},
    },
    {
        "barcode": "4760012300131",
        "canonical_name": "Azərçay Armudu Qara Çay Kəklikotulu 100g",
        "brand": "Azərçay",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "100g",
        "image_url": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.40,
        "variations": {"oba": 2.10, "almarket": 2.05, "araz": 2.30, "bravo": 2.50, "bazarstore": 2.40, "neptun": 2.55, "spar": 2.45},
        "promo": None,
    },
    {
        "barcode": "8711000526348",
        "canonical_name": "Jacobs Monarch Həll Olan Qəhvə 190g",
        "brand": "Jacobs",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "190g",
        "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80",
        "base_price": 17.80,
        "variations": {"oba": 15.90, "almarket": 15.80, "araz": 17.20, "bravo": 17.90, "bazarstore": 17.80, "neptun": 18.50, "spar": 18.00},
        "promo": {"chain": "spar", "promo_price": 14.99},
    },
    {
        "barcode": "4760048100123",
        "canonical_name": "Sirab Mineral Qazsız Su 1.5L",
        "brand": "Sirab",
        "cat_slug": "beverages-tea",
        "unit": "liter",
        "pack_size": "1.5L",
        "image_url": "/products/sirab.png",
        "base_price": 1.05,
        "variations": {"oba": 0.88, "almarket": 0.85, "araz": 1.00, "bravo": 1.15, "bazarstore": 1.10, "neptun": 1.20, "spar": 1.10},
        "promo": None,
    },
    {
        "barcode": "4760048100130",
        "canonical_name": "Sirab Premium Qazlı Su Şüşə 0.5L",
        "brand": "Sirab",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "0.5L",
        "image_url": "/products/sirab.png",
        "base_price": 1.20,
        "variations": {"oba": 1.05, "almarket": 1.00, "araz": 1.15, "bravo": 1.30, "bazarstore": 1.25, "neptun": 1.35, "spar": 1.25},
        "promo": None,
    },
    {
        "barcode": "4760048100246",
        "canonical_name": "Badamlı Qazsız Təbii Mineral Su 1L",
        "brand": "Badamlı",
        "cat_slug": "beverages-tea",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "/products/badamli.png",
        "base_price": 0.95,
        "variations": {"oba": 0.82, "almarket": 0.80, "araz": 0.90, "bravo": 1.05, "bazarstore": 1.00, "neptun": 1.10, "spar": 1.00},
        "promo": None,
    },
    {
        "barcode": "4860019001346",
        "canonical_name": "Borjomi Təbii Müalicəvi Mineral Qazlı Su 0.5L",
        "brand": "Borjomi",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "0.5L",
        "image_url": "/products/borjomi.jpg",
        "base_price": 1.70,
        "variations": {"oba": 1.48, "almarket": 1.45, "araz": 1.65, "bravo": 1.75, "bazarstore": 1.70, "neptun": 1.85, "spar": 1.75},
        "promo": None,
    },
    {
        "barcode": "5449000000996",
        "canonical_name": "Coca-Cola Classic 1.5L",
        "brand": "Coca-Cola",
        "cat_slug": "beverages-tea",
        "unit": "liter",
        "pack_size": "1.5L",
        "image_url": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.30,
        "variations": {"oba": 2.05, "almarket": 2.00, "araz": 2.25, "bravo": 2.45, "bazarstore": 2.35, "neptun": 2.50, "spar": 2.40},
        "promo": {"chain": "bravo", "promo_price": 1.99},
    },

    # 6. Snacks & Sweets (Şirniyyat və Qəlyanaltı)
    {
        "barcode": "7622210287123",
        "canonical_name": "Alpen Gold Süd Şokoladı 85g",
        "brand": "Alpen Gold",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "85g",
        "image_url": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.20,
        "variations": {"oba": 1.85, "almarket": 1.80, "araz": 2.10, "bravo": 2.30, "bazarstore": 2.25, "neptun": 2.35, "spar": 2.25},
        "promo": {"chain": "oba", "promo_price": 1.69},
    },
    {
        "barcode": "7622210998877",
        "canonical_name": "Oreo Original Biskvit 154g",
        "brand": "Oreo",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "154g",
        "image_url": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.90,
        "variations": {"oba": 2.45, "almarket": 2.40, "araz": 2.80, "bravo": 3.10, "bazarstore": 2.95, "neptun": 3.20, "spar": 3.00},
        "promo": None,
    },
    {
        "barcode": "4823077612345",
        "canonical_name": "Roshen Konfet Çeşidləri 1kg",
        "brand": "Roshen",
        "cat_slug": "snacks-sweets",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&auto=format&fit=crop&q=80",
        "base_price": 11.50,
        "variations": {"oba": 9.90, "almarket": 9.80, "araz": 10.90, "bravo": 11.90, "bazarstore": 11.50, "neptun": 12.20, "spar": 11.80},
        "promo": None,
    },

    # 7. Cleaning & Household (Təmizlik və Məişət)
    {
        "barcode": "8001090123456",
        "canonical_name": "Ariel Dağ Təravəti Avtomat Yuyucu Toz 3kg",
        "brand": "Ariel",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "3kg",
        "image_url": "/products/ariel.png",
        "base_price": 14.90,
        "variations": {"oba": 13.50, "almarket": 13.40, "araz": 14.30, "bravo": 14.90, "bazarstore": 15.20, "neptun": 15.50, "spar": 15.00},
        "promo": {"chain": "bravo", "promo_price": 12.49},
    },
    {
        "barcode": "8001090123499",
        "canonical_name": "Ariel Dağ Əsintisi Avtomat Yuyucu Toz 7kg (Dev Ekonomi)",
        "brand": "Ariel",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "7kg",
        "image_url": "/products/ariel.png",
        "base_price": 28.90,
        "variations": {"oba": 26.20, "almarket": 25.90, "araz": 27.50, "bravo": 28.90, "bazarstore": 29.50, "neptun": 29.90, "spar": 29.00},
        "promo": {"chain": "bravo", "promo_price": 23.99},
    },
    {
        "barcode": "8001090123470",
        "canonical_name": "Fairy Limon Qabyuyan Maye 650ml",
        "brand": "Fairy",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "650ml",
        "image_url": "/products/fairy.png",
        "base_price": 4.10,
        "variations": {"oba": 3.55, "almarket": 3.50, "araz": 3.90, "bravo": 4.25, "bazarstore": 4.15, "neptun": 4.35, "spar": 4.20},
        "promo": {"chain": "oba", "promo_price": 3.19},
    },
    {
        "barcode": "8710447289012",
        "canonical_name": "Domestos Xlorlu Təmizləyici Gel 750ml",
        "brand": "Domestos",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "750ml",
        "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.75,
        "variations": {"oba": 3.25, "almarket": 3.20, "araz": 3.60, "bravo": 3.90, "bazarstore": 3.80, "neptun": 4.00, "spar": 3.85},
        "promo": None,
    },
    {
        "barcode": "8690530012345",
        "canonical_name": "Papia Tualet Kağızı 3 Qat 8-li",
        "brand": "Papia",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "8 rulon",
        "image_url": "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=400&auto=format&fit=crop&q=80",
        "base_price": 6.90,
        "variations": {"oba": 5.95, "almarket": 5.90, "araz": 6.60, "bravo": 7.20, "bazarstore": 7.00, "neptun": 7.35, "spar": 7.10},
        "promo": {"chain": "oba", "promo_price": 5.79},
    },

    # 8. Personal Care & Baby (Şəxsi Qulluq və Uşaq)
    {
        "barcode": "8690506001234",
        "canonical_name": "Duru Təbii Zeytun Sabunu 4x150g",
        "brand": "Duru",
        "cat_slug": "personal-care-baby",
        "unit": "piece",
        "pack_size": "4x150g",
        "image_url": "https://images.unsplash.com/photo-1607006314644-88331bb14a72?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.20,
        "variations": {"oba": 3.65, "almarket": 3.60, "araz": 4.00, "bravo": 4.40, "bazarstore": 4.30, "neptun": 4.50, "spar": 4.30},
        "promo": None,
    },
    {
        "barcode": "8001090543210",
        "canonical_name": "Pantene Pro-V Şampun Bərpaedici 400ml",
        "brand": "Pantene",
        "cat_slug": "personal-care-baby",
        "unit": "piece",
        "pack_size": "400ml",
        "image_url": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&auto=format&fit=crop&q=80",
        "base_price": 6.90,
        "variations": {"oba": 5.90, "almarket": 5.85, "araz": 6.50, "bravo": 7.20, "bazarstore": 7.00, "neptun": 7.30, "spar": 7.10},
        "promo": {"chain": "araz", "promo_price": 5.79},
    },
    {
        "barcode": "4015600854321",
        "canonical_name": "Blend-a-med 3D White Diş Pastası 100ml",
        "brand": "Blend-a-med",
        "cat_slug": "personal-care-baby",
        "unit": "piece",
        "pack_size": "100ml",
        "image_url": "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.80,
        "variations": {"oba": 3.20, "almarket": 3.15, "araz": 3.60, "bravo": 3.95, "bazarstore": 3.85, "neptun": 4.10, "spar": 3.90},
        "promo": None,
    },
    {
        "barcode": "8001090887766",
        "canonical_name": "Pampers Active Baby 4-cü Ölçü (52 ədəd)",
        "brand": "Pampers",
        "cat_slug": "personal-care-baby",
        "unit": "piece",
        "pack_size": "52 ədəd",
        "image_url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&auto=format&fit=crop&q=80",
        "base_price": 24.50,
        "variations": {"oba": 21.80, "almarket": 21.50, "araz": 23.50, "bravo": 25.20, "bazarstore": 24.90, "neptun": 25.90, "spar": 25.00},
        "promo": {"chain": "almarket", "promo_price": 19.99},
    },
]


async def seed():
    print("🌱 Initializing SebEt database schema with 7 Supermarkets...")
    await init_db()

    async with async_session_factory() as session:
        existing_chains = await session.execute(select(func.count(Chain.id)))
        if existing_chains.scalar() > 0:
            print("ℹ️ Database already contains chains. Re-seeding fresh data...")
            await session.execute(delete(FlyerItem))
            await session.execute(delete(Flyer))
            await session.execute(delete(StorePrice))
            await session.execute(delete(Product))
            await session.execute(delete(Category))
            await session.execute(delete(Store))
            await session.execute(delete(Chain))
            await session.execute(delete(User))
            await session.commit()

        print("🏢 Seeding 7 major retail chains (Bravo, Araz, OBA, Bazarstore, Al Market, Neptun, Spar)...")
        chains_map = {}
        for cdata in CHAINS_DATA:
            chain = Chain(
                name=cdata["name"],
                slug=cdata["slug"],
                color=cdata["color"],
                logo_url=cdata["logo_url"],
            )
            session.add(chain)
            chains_map[cdata["slug"]] = chain

        await session.flush()

        print("📍 Seeding store branches across Baku and regional hubs (28 May, Nərimanov, Yasamal, Elmlər, Sumqayıt, Xırdalan, Gəncə)...")
        stores_map = {}
        for sdata in STORES_DATA:
            chain = chains_map[sdata["chain_slug"]]
            store = Store(
                chain_id=chain.id,
                branch_name=sdata["branch_name"],
                neighborhood=sdata["neighborhood"],
                voen=sdata["voen"],
                obyekt_kodu=sdata["obyekt_kodu"],
                address=sdata["address"],
                latitude=sdata["latitude"],
                longitude=sdata["longitude"],
                is_active=True,
            )
            session.add(store)
            if sdata["chain_slug"] not in stores_map:
                stores_map[sdata["chain_slug"]] = []
            stores_map[sdata["chain_slug"]].append(store)

        await session.flush()

        print("🏷️ Seeding 8 smart product categories...")
        categories_map = {}
        for cat_data in CATEGORIES_DATA:
            cat = Category(
                name_az=cat_data["name_az"],
                name_en=cat_data["name_en"],
                slug=cat_data["slug"],
                icon_name=cat_data["icon_name"],
            )
            session.add(cat)
            categories_map[cat_data["slug"]] = cat

        await session.flush()

        print(f"🛒 Seeding {len(PRODUCTS_DATA)} authentic grocery SKUs with shelf prices across 7 chains...")
        now = datetime.now(timezone.utc)
        products_map = {}

        for pdata in PRODUCTS_DATA:
            cat = categories_map[pdata["cat_slug"]]
            prod = Product(
                barcode=pdata["barcode"],
                canonical_name=pdata["canonical_name"],
                brand=pdata["brand"],
                category_id=cat.id,
                unit=pdata["unit"],
                pack_size=pdata["pack_size"],
                image_url=pdata["image_url"],
            )
            session.add(prod)
            products_map[pdata["barcode"]] = prod
            await session.flush()

            # Create shelf prices for all 7 retail chains
            for chain_slug, stores in stores_map.items():
                chain_price = pdata["variations"].get(chain_slug, pdata["base_price"])
                is_promo = False
                promo_p = None

                if pdata["promo"] and pdata["promo"]["chain"] == chain_slug:
                    is_promo = True
                    promo_p = pdata["promo"]["promo_price"]

                for store in stores:
                    store_price = StorePrice(
                        store_id=store.id,
                        product_id=prod.id,
                        price=chain_price,
                        promo_price=promo_p,
                        is_promo=is_promo,
                        in_stock=True,
                        source_type="scraping",
                        confidence_score=0.98,
                        recorded_at=now,
                        expires_at=now + timedelta(days=7) if is_promo else None,
                    )
                    session.add(store_price)

        print("📰 Seeding weekly promotional flyers for all 7 chains...")
        flyers_info = [
            {
                "chain_slug": "bravo",
                "title": "Bravo — Həftənin Super Təklifləri",
                "cover": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "8001090123456", "title": "Ariel Yuyucu Toz 3kg", "disc": 12.49, "orig": 14.90, "pct": 16, "badge": "Super Endirim"},
                    {"barcode": "8001090123499", "title": "Ariel Yuyucu Toz 7kg", "disc": 23.99, "orig": 28.90, "pct": 17, "badge": "Dev Fürsət"},
                    {"barcode": "9415494000125", "title": "Westgold Kərə Yağı 200g", "disc": 4.79, "orig": 5.50, "pct": 13, "badge": "Yeni Təklif"},
                    {"barcode": "5449000000996", "title": "Coca-Cola Classic 1.5L", "disc": 1.99, "orig": 2.45, "pct": 19, "badge": "1+1 Fürsəti"},
                ]
            },
            {
                "chain_slug": "araz",
                "title": "Araz — Həftəlik Səbət Endirimləri",
                "cover": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760012300124", "title": "Azərçay Buket 250g", "disc": 3.99, "orig": 4.65, "pct": 14, "badge": "Çay Mövsümü"},
                    {"barcode": "4760123456789", "title": "Giləzi Yumurtası 10-lu", "disc": 1.95, "orig": 2.35, "pct": 17, "badge": "Sərfəli Qənaət"},
                    {"barcode": "8001090543210", "title": "Pantene Şampun 400ml", "disc": 5.79, "orig": 6.50, "pct": 11, "badge": "Xüsusi Qiymət"},
                ]
            },
            {
                "chain_slug": "oba",
                "title": "OBA — Cibinizə Qənaət Kataloqu",
                "cover": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760083300124", "title": "Milla Süd 2.5% 1L", "disc": 1.99, "orig": 2.15, "pct": 7, "badge": "Hər Gün Ucuz"},
                    {"barcode": "4760032100147", "title": "Final Yağı 5L", "disc": 16.49, "orig": 17.50, "pct": 6, "badge": "Ailəvi Boy"},
                    {"barcode": "8001090123470", "title": "Fairy Limon 650ml", "disc": 3.19, "orig": 3.55, "pct": 10, "badge": "Mətbəx Fürsəti"},
                    {"barcode": "8690530012345", "title": "Papia Tualet Kağızı 8-li", "disc": 5.79, "orig": 5.95, "pct": 3, "badge": "Super Fürsət"},
                ]
            },
            {
                "chain_slug": "bazarstore",
                "title": "Bazarstore — Həftəsonu Azersun Fürsətləri",
                "cover": "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "9415494000194", "title": "Anchor Kərə Yağı 500g", "disc": 12.79, "orig": 14.20, "pct": 10, "badge": "Yeni Kərə Yağı"},
                    {"barcode": "4760032100123", "title": "Möcüzə Qarğıdalı Yağı 1L", "disc": 4.49, "orig": 5.20, "pct": 14, "badge": "Azersun Endirimi"},
                ]
            },
            {
                "chain_slug": "almarket",
                "title": "Al Market — Hər Həftə Ən Ucuz",
                "cover": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760099887773", "title": "Mərcan Təzə Broyler Toyuq 1kg", "disc": 4.89, "orig": 5.15, "pct": 5, "badge": "Al Market Ən Ucuz"},
                    {"barcode": "8001090887766", "title": "Pampers Active Baby 4-cü Ölçü", "disc": 19.99, "orig": 21.50, "pct": 7, "badge": "Uşaq Fürsəti"},
                ]
            },
            {
                "chain_slug": "neptun",
                "title": "Neptun — Təravət və Keyfiyyət",
                "cover": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760078901265", "title": "Bizim Tarla Tomat Pastası 700g", "disc": 3.19, "orig": 3.85, "pct": 17, "badge": "Neptun Təklifi"},
                ]
            },
            {
                "chain_slug": "spar",
                "title": "Spar — Avropa Standartı Endirimlər",
                "cover": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "8711000526348", "title": "Jacobs Monarch Qəhvə 190g", "disc": 14.99, "orig": 18.00, "pct": 17, "badge": "Spar Xüsusi"},
                ]
            }
        ]

        for finfo in flyers_info:
            chain = chains_map[finfo["chain_slug"]]
            flyer = Flyer(
                chain_id=chain.id,
                title=finfo["title"],
                start_date=now - timedelta(days=1),
                end_date=now + timedelta(days=6),
                cover_image_url=finfo["cover"],
                pdf_url=f"https://catalog.sebet.az/flyers/{finfo['chain_slug']}-current.pdf",
            )
            session.add(flyer)
            await session.flush()

            for item in finfo["items"]:
                prod = products_map.get(item["barcode"])
                flyer_item = FlyerItem(
                    flyer_id=flyer.id,
                    product_id=prod.id if prod else None,
                    title=item["title"],
                    discount_price=item["disc"],
                    original_price=item["orig"],
                    discount_percent=item["pct"],
                    image_url=prod.image_url if prod else None,
                    badge_text=item["badge"],
                )
                session.add(flyer_item)

        print("👤 Seeding demo user (Ali Iskandarli, +994 50 123 45 67, 250 SebEt Points)...")
        demo_user = User(
            phone_number="+994501234567",
            full_name="Ali Iskandarli",
            sebet_points=250,
        )
        session.add(demo_user)

        await session.commit()
        print("✅ Baku & Regional realistic dataset successfully seeded!")
        print("   - 7 Chains: Bravo, Araz, OBA, Bazarstore, Al Market, Neptun, Spar")
        print("   - Stores in 28 May, Nərimanov, Yasamal, Elmlər, Koroğlu, Xırdalan, Sumqayıt, Gəncə")
        print("   - 8 Smart Categories")
        print(f"   - {len(PRODUCTS_DATA)} Branded SKUs with shelf prices across all 7 chains")
        print("   - 7 Active weekly promotional flyers")
        print("   - 1 Demo User (Ali Iskandarli) with 250 SebEt Points")


if __name__ == "__main__":
    asyncio.run(seed())
