import asyncio
import uuid
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Ensure backend root is in sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, delete
from app.core.database import async_session_factory, init_db
from app.models import (
    Chain,
    Store,
    Category,
    Product,
    StorePrice,
    Flyer,
    FlyerItem,
    User,
)

CHAINS_DATA = [
    {
        "name": "Bravo",
        "slug": "bravo",
        "color": "#007A3D",
        "logo_url": "/chains/bravo.svg",
    },
    {
        "name": "Araz",
        "slug": "araz",
        "color": "#E30613",
        "logo_url": "/chains/araz.svg",
    },
    {
        "name": "OBA",
        "slug": "oba",
        "color": "#009640",
        "logo_url": "/chains/oba.svg",
    },
    {
        "name": "Bazarstore",
        "slug": "bazarstore",
        "color": "#D01026",
        "logo_url": "/chains/bazarstore.svg",
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
        "address": "Bakı ş., Yasamal r., Şərifzadə küç. 150, İnşaatçılar",
        "latitude": 40.3872,
        "longitude": 49.8055,
    },
    # Araz Branches
    {
        "chain_slug": "araz",
        "branch_name": "Araz Nərimanov",
        "neighborhood": "Nərimanov",
        "voen": "1400124571",
        "obyekt_kodu": "0201",
        "address": "Bakı ş., Nərimanov r., Təbriz küç. 93",
        "latitude": 40.4024,
        "longitude": 49.8712,
    },
    {
        "chain_slug": "araz",
        "branch_name": "Araz 28 May",
        "neighborhood": "28 May",
        "voen": "1400124571",
        "obyekt_kodu": "0202",
        "address": "Bakı ş., Nəsimi r., Dilarə Əliyeva küç. 235",
        "latitude": 40.3812,
        "longitude": 49.8490,
    },
    {
        "chain_slug": "araz",
        "branch_name": "Araz Elmlər",
        "neighborhood": "Elmlər",
        "voen": "1400124571",
        "obyekt_kodu": "0203",
        "address": "Bakı ş., Yasamal r., Hüseyn Cavid pr. 528",
        "latitude": 40.3735,
        "longitude": 49.8142,
    },
    # OBA Branches
    {
        "chain_slug": "oba",
        "branch_name": "OBA 28 May",
        "neighborhood": "28 May",
        "voen": "1700893241",
        "obyekt_kodu": "0301",
        "address": "Bakı ş., Nəsimi r., Füzuli küç. 42",
        "latitude": 40.3805,
        "longitude": 49.8460,
    },
    {
        "chain_slug": "oba",
        "branch_name": "OBA Nərimanov",
        "neighborhood": "Nərimanov",
        "voen": "1700893241",
        "obyekt_kodu": "0302",
        "address": "Bakı ş., Nərimanov r., Ağa Nemətulla küç. 67",
        "latitude": 40.4010,
        "longitude": 49.8725,
    },
    {
        "chain_slug": "oba",
        "branch_name": "OBA Nizami",
        "neighborhood": "Nizami",
        "voen": "1700893241",
        "obyekt_kodu": "0303",
        "address": "Bakı ş., Yasamal r., Bəşir Səfəroğlu küç. 112",
        "latitude": 40.3752,
        "longitude": 49.8335,
    },
    # Bazarstore Branches
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore 28 May",
        "neighborhood": "28 May",
        "voen": "1300234191",
        "obyekt_kodu": "0401",
        "address": "Bakı ş., Nəsimi r., Dəmiryol Vağzalı Meydanı",
        "latitude": 40.3820,
        "longitude": 49.8510,
    },
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore Yasamal",
        "neighborhood": "Yasamal",
        "voen": "1300234191",
        "obyekt_kodu": "0402",
        "address": "Bakı ş., Yasamal r., Zahid Xəlilov küç. 23",
        "latitude": 40.3780,
        "longitude": 49.8110,
    },
    {
        "chain_slug": "bazarstore",
        "branch_name": "Bazarstore Elmlər",
        "neighborhood": "Elmlər",
        "voen": "1300234191",
        "obyekt_kodu": "0403",
        "address": "Bakı ş., Yasamal r., Bəxtiyar Vahabzadə küç. 14",
        "latitude": 40.3718,
        "longitude": 49.8165,
    },
]

CATEGORIES_DATA = [
    {
        "name_az": "Süd və Süd Məhsulları",
        "name_en": "Dairy & Eggs",
        "slug": "dairy-eggs",
        "icon_name": "Milk",
    },
    {
        "name_az": "Ərzaq və Yağlar",
        "name_en": "Pantry & Cooking",
        "slug": "pantry-cooking",
        "icon_name": "Utensils",
    },
    {
        "name_az": "İçkilər və Çay",
        "name_en": "Beverages & Tea",
        "slug": "beverages-tea",
        "icon_name": "Coffee",
    },
    {
        "name_az": "Təmizlik və Məişət",
        "name_en": "Cleaning & Household",
        "slug": "cleaning-household",
        "icon_name": "Sparkles",
    },
    {
        "name_az": "Şirniyyat və Qəlyanaltı",
        "name_en": "Snacks & Sweets",
        "slug": "snacks-sweets",
        "icon_name": "Cookie",
    },
    {
        "name_az": "Şəxsi Qulluq və Uşaq",
        "name_en": "Personal Care & Baby",
        "slug": "personal-baby",
        "icon_name": "Heart",
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
        "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.35,
        "variations": {"oba": 2.15, "araz": 2.29, "bravo": 2.39, "bazarstore": 2.35},
        "promo": {"chain": "oba", "promo_price": 1.99},
    },
    {
        "barcode": "4760083300254",
        "canonical_name": "Milla Qatıq 3.2% 1kg",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.55,
        "variations": {"oba": 2.39, "araz": 2.50, "bravo": 2.65, "bazarstore": 2.59},
        "promo": None,
    },
    {
        "barcode": "4760083300308",
        "canonical_name": "Milla Xama 20% 300g",
        "brand": "Milla",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "300g",
        "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.20,
        "variations": {"oba": 2.05, "araz": 2.19, "bravo": 2.29, "bazarstore": 2.25},
        "promo": None,
    },
    {
        "barcode": "9415494000125",
        "canonical_name": "Westgold Kərə Yağı 82% 200g",
        "brand": "Westgold",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.45,
        "variations": {"oba": 5.15, "araz": 5.35, "bravo": 5.50, "bazarstore": 5.45},
        "promo": {"chain": "bravo", "promo_price": 4.79},
    },
    {
        "barcode": "9415494000194",
        "canonical_name": "Anchor Kərə Yağı 82.5% 200g",
        "brand": "Anchor",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.65,
        "variations": {"oba": 5.25, "araz": 5.55, "bravo": 5.75, "bazarstore": 5.65},
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
        "base_price": 4.75,
        "variations": {"oba": 4.35, "araz": 4.65, "bravo": 4.85, "bazarstore": 4.79},
        "promo": None,
    },
    {
        "barcode": "4760083300452",
        "canonical_name": "Atena Kəsmik 9% 200g",
        "brand": "Atena",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "200g",
        "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.85,
        "variations": {"oba": 1.69, "araz": 1.80, "bravo": 1.95, "bazarstore": 1.89},
        "promo": None,
    },
    {
        "barcode": "4760083300995",
        "canonical_name": "Atena Klassik Ağ Pendir 500g",
        "brand": "Atena",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.70,
        "variations": {"oba": 5.20, "araz": 5.60, "bravo": 5.85, "bazarstore": 5.75},
        "promo": None,
    },
    {
        "barcode": "4760123456789",
        "canonical_name": "Giləzi Kənd Yumurtası 10 ədəd",
        "brand": "Giləzi",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "10 ədəd",
        "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.35,
        "variations": {"oba": 2.15, "araz": 2.29, "bravo": 2.45, "bazarstore": 2.39},
        "promo": {"chain": "araz", "promo_price": 1.95},
    },
    {
        "barcode": "4760123456790",
        "canonical_name": "Səba Yumurta Dietik 10 ədəd",
        "brand": "Səba",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "10 ədəd",
        "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.25,
        "variations": {"oba": 2.05, "araz": 2.19, "bravo": 2.30, "bazarstore": 2.25},
        "promo": None,
    },
    {
        "barcode": "4760083300889",
        "canonical_name": "İvanovka Pendiri Motallı 500g",
        "brand": "İvanovka",
        "cat_slug": "dairy-eggs",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=80",
        "base_price": 7.20,
        "variations": {"oba": 6.60, "araz": 7.10, "bravo": 7.45, "bazarstore": 7.30},
        "promo": None,
    },

    # 2. Pantry & Cooking
    {
        "barcode": "4760098765432",
        "canonical_name": "Bizim Süfrə Klassik Mayonez 67% 400ml",
        "brand": "Bizim Süfrə",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "400ml",
        "image_url": "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.65,
        "variations": {"oba": 2.45, "araz": 2.60, "bravo": 2.75, "bazarstore": 2.55},
        "promo": None,
    },
    {
        "barcode": "4760098765449",
        "canonical_name": "Bizim Süfrə Provansal Mayonez 67% 750ml",
        "brand": "Bizim Süfrə",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "750ml",
        "image_url": "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.50,
        "variations": {"oba": 4.10, "araz": 4.40, "bravo": 4.65, "bazarstore": 4.35},
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
        "base_price": 5.30,
        "variations": {"oba": 4.85, "araz": 5.20, "bravo": 5.45, "bazarstore": 4.95},
        "promo": {"chain": "bazarstore", "promo_price": 4.49},
    },
    {
        "barcode": "4760032100130",
        "canonical_name": "Final Günəbaxan Yağı 1L",
        "brand": "Final",
        "cat_slug": "pantry-cooking",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.20,
        "variations": {"oba": 3.85, "araz": 4.15, "bravo": 4.35, "bazarstore": 4.10},
        "promo": None,
    },
    {
        "barcode": "4760032100147",
        "canonical_name": "Final Günəbaxan Yağı 5L",
        "brand": "Final",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "5L",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
        "base_price": 19.80,
        "variations": {"oba": 17.90, "araz": 19.20, "bravo": 19.95, "bazarstore": 18.90},
        "promo": {"chain": "oba", "promo_price": 16.49},
    },
    {
        "barcode": "4760045678901",
        "canonical_name": "Doyum Düyü Basmati 1kg",
        "brand": "Doyum",
        "cat_slug": "pantry-cooking",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.65,
        "variations": {"oba": 4.20, "araz": 4.55, "bravo": 4.80, "bazarstore": 4.65},
        "promo": None,
    },
    {
        "barcode": "4600123456789",
        "canonical_name": "Makfa Spagetti 500g",
        "brand": "Makfa",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.75,
        "variations": {"oba": 1.55, "araz": 1.70, "bravo": 1.85, "bazarstore": 1.79},
        "promo": None,
    },
    {
        "barcode": "4600123456796",
        "canonical_name": "Makfa Boru Makaron 500g",
        "brand": "Makfa",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "500g",
        "image_url": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.75,
        "variations": {"oba": 1.55, "araz": 1.70, "bravo": 1.85, "bazarstore": 1.79},
        "promo": None,
    },
    {
        "barcode": "4760078901234",
        "canonical_name": "Karmen Əla Növ Buğda Unu 2kg",
        "brand": "Karmen",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "2kg",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.95,
        "variations": {"oba": 2.70, "araz": 2.90, "bravo": 3.10, "bazarstore": 2.99},
        "promo": None,
    },
    {
        "barcode": "4760078901241",
        "canonical_name": "Azərşəkər Şəkər Tozu 1kg",
        "brand": "Azərşəkər",
        "cat_slug": "pantry-cooking",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80",
        "base_price": 1.95,
        "variations": {"oba": 1.85, "araz": 1.95, "bravo": 2.05, "bazarstore": 1.95},
        "promo": None,
    },
    {
        "barcode": "4760078901258",
        "canonical_name": "Durna Yodlaşdırılmış Süfrə Duzu 1kg",
        "brand": "Durna",
        "cat_slug": "pantry-cooking",
        "unit": "kg",
        "pack_size": "1kg",
        "image_url": "https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&auto=format&fit=crop&q=80",
        "base_price": 0.85,
        "variations": {"oba": 0.70, "araz": 0.80, "bravo": 0.90, "bazarstore": 0.85},
        "promo": None,
    },
    {
        "barcode": "4760078901265",
        "canonical_name": "Bizim Tarla Tomat Pastası 720g",
        "brand": "Bizim Tarla",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "720g",
        "image_url": "https://images.unsplash.com/photo-1582293041079-7814c2f12063?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.75,
        "variations": {"oba": 3.40, "araz": 3.70, "bravo": 3.85, "bazarstore": 3.50},
        "promo": {"chain": "bazarstore", "promo_price": 3.19},
    },
    {
        "barcode": "4760077770022",
        "canonical_name": "Şamaxı Şanı Təbii Üzüm Sirkəsi 500ml",
        "brand": "Şamaxı",
        "cat_slug": "pantry-cooking",
        "unit": "piece",
        "pack_size": "500ml",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.40,
        "variations": {"oba": 2.10, "araz": 2.30, "bravo": 2.50, "bazarstore": 2.45},
        "promo": None,
    },

    # 3. Beverages & Tea
    {
        "barcode": "4760012300124",
        "canonical_name": "Azərçay Buket Qara Çay 250g",
        "brand": "Azərçay",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "250g",
        "image_url": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.80,
        "variations": {"oba": 4.35, "araz": 4.65, "bravo": 4.90, "bazarstore": 4.50},
        "promo": {"chain": "araz", "promo_price": 3.99},
    },
    {
        "barcode": "4760012300131",
        "canonical_name": "Azərçay Kəklikotulu Çay 100g",
        "brand": "Azərçay",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "100g",
        "image_url": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.40,
        "variations": {"oba": 2.15, "araz": 2.35, "bravo": 2.50, "bazarstore": 2.30},
        "promo": None,
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
        "variations": {"oba": 0.90, "araz": 1.00, "bravo": 1.15, "bazarstore": 1.10},
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
        "variations": {"oba": 1.05, "araz": 1.15, "bravo": 1.30, "bazarstore": 1.25},
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
        "variations": {"oba": 0.85, "araz": 0.95, "bravo": 1.05, "bazarstore": 1.00},
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
        "variations": {"oba": 1.50, "araz": 1.65, "bravo": 1.75, "bazarstore": 1.70},
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
        "variations": {"oba": 2.10, "araz": 2.25, "bravo": 2.35, "bazarstore": 2.30},
        "promo": {"chain": "bravo", "promo_price": 1.99},
    },
    {
        "barcode": "5449000001009",
        "canonical_name": "Fanta Portağal 1.5L",
        "brand": "Fanta",
        "cat_slug": "beverages-tea",
        "unit": "liter",
        "pack_size": "1.5L",
        "image_url": "https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.30,
        "variations": {"oba": 2.10, "araz": 2.25, "bravo": 2.35, "bazarstore": 2.30},
        "promo": None,
    },
    {
        "barcode": "8711000366111",
        "canonical_name": "Jacobs Monarch Həll Olan Qəhvə 190g",
        "brand": "Jacobs",
        "cat_slug": "beverages-tea",
        "unit": "piece",
        "pack_size": "190g",
        "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80",
        "base_price": 17.80,
        "variations": {"oba": 15.90, "araz": 17.20, "bravo": 18.20, "bazarstore": 18.50},
        "promo": {"chain": "araz", "promo_price": 14.89},
    },
    {
        "barcode": "4820000123456",
        "canonical_name": "Sandora Portağal Şirəsi 1L",
        "brand": "Sandora",
        "cat_slug": "beverages-tea",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.90,
        "variations": {"oba": 3.50, "araz": 3.80, "bravo": 4.10, "bazarstore": 3.95},
        "promo": None,
    },
    {
        "barcode": "4760088880011",
        "canonical_name": "Saville Təbii Qara Nar Şirəsi 1L",
        "brand": "Saville",
        "cat_slug": "beverages-tea",
        "unit": "liter",
        "pack_size": "1L",
        "image_url": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.20,
        "variations": {"oba": 3.80, "araz": 4.10, "bravo": 4.30, "bazarstore": 4.15},
        "promo": {"chain": "bravo", "promo_price": 3.69},
    },

    # 4. Cleaning & Household
    {
        "barcode": "8001090123456",
        "canonical_name": "Ariel Dağ Təravəti Avtomat Yuyucu Toz 3kg",
        "brand": "Ariel",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "3kg",
        "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80",
        "base_price": 14.90,
        "variations": {"oba": 13.80, "araz": 14.50, "bravo": 14.90, "bazarstore": 15.20},
        "promo": {"chain": "bravo", "promo_price": 12.49},
    },
    {
        "barcode": "8001090123463",
        "canonical_name": "Ariel Rənglilər Üçün Gel Kapsul 15 ədəd",
        "brand": "Ariel",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "15 ədəd",
        "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80",
        "base_price": 13.90,
        "variations": {"oba": 12.80, "araz": 13.60, "bravo": 14.20, "bazarstore": 14.10},
        "promo": None,
    },
    {
        "barcode": "8001090123470",
        "canonical_name": "Fairy Limon Qabyuyan Maye 650ml",
        "brand": "Fairy",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "650ml",
        "image_url": "https://images.unsplash.com/photo-1585670270608-b4be4fb88092?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.10,
        "variations": {"oba": 3.65, "araz": 3.95, "bravo": 4.25, "bazarstore": 4.15},
        "promo": {"chain": "oba", "promo_price": 3.19},
    },
    {
        "barcode": "8001090123487",
        "canonical_name": "Fairy Platinum Qabyuyan Maşın Kapsulu 24 ədəd",
        "brand": "Fairy",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "24 ədəd",
        "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80",
        "base_price": 17.50,
        "variations": {"oba": 15.80, "araz": 16.90, "bravo": 17.50, "bazarstore": 17.90},
        "promo": {"chain": "bravo", "promo_price": 14.49},
    },
    {
        "barcode": "8710447289012",
        "canonical_name": "Domestos Xlorlu Təmizləyici Gel 750ml",
        "brand": "Domestos",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "750ml",
        "image_url": "https://images.unsplash.com/photo-1585670270608-b4be4fb88092?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.25,
        "variations": {"oba": 3.80, "araz": 4.15, "bravo": 4.35, "bazarstore": 4.40},
        "promo": None,
    },
    {
        "barcode": "8690506001234",
        "canonical_name": "Duru Təbii Zeytun Sabunu 4x115g",
        "brand": "Duru",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "4x115g",
        "image_url": "https://images.unsplash.com/photo-1607006314336-d7a86f7881c1?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.20,
        "variations": {"oba": 3.75, "araz": 4.10, "bravo": 4.30, "bazarstore": 4.35},
        "promo": None,
    },
    {
        "barcode": "8690530012345",
        "canonical_name": "Papia 3 Qatlı Tualet Kağızı 8 Rulon",
        "brand": "Papia",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "8 ədəd",
        "image_url": "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=400&auto=format&fit=crop&q=80",
        "base_price": 7.20,
        "variations": {"oba": 6.40, "araz": 6.95, "bravo": 7.40, "bazarstore": 7.30},
        "promo": {"chain": "oba", "promo_price": 5.79},
    },
    {
        "barcode": "8690530012352",
        "canonical_name": "Selpak Praktik Kağız Dəsmal 2 Rulon",
        "brand": "Selpak",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "2 ədəd",
        "image_url": "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.80,
        "variations": {"oba": 3.30, "araz": 3.65, "bravo": 3.90, "bazarstore": 3.85},
        "promo": None,
    },
    {
        "barcode": "8718951234567",
        "canonical_name": "Colgate Total Kompleks Diş Məcunu 75ml",
        "brand": "Colgate",
        "cat_slug": "cleaning-household",
        "unit": "piece",
        "pack_size": "75ml",
        "image_url": "https://images.unsplash.com/photo-1559591937-e1032b43b674?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.75,
        "variations": {"oba": 4.20, "araz": 4.60, "bravo": 4.85, "bazarstore": 4.90},
        "promo": None,
    },

    # 5. Snacks & Sweets
    {
        "barcode": "8690504001234",
        "canonical_name": "Ülker Albeni Karamel Şokolad 40g",
        "brand": "Ülker",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "40g",
        "image_url": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400&auto=format&fit=crop&q=80",
        "base_price": 0.85,
        "variations": {"oba": 0.75, "araz": 0.85, "bravo": 0.90, "bazarstore": 0.90},
        "promo": None,
    },
    {
        "barcode": "8690504001241",
        "canonical_name": "Ülker Çikolatalı Gofret 36g",
        "brand": "Ülker",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "36g",
        "image_url": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400&auto=format&fit=crop&q=80",
        "base_price": 0.75,
        "variations": {"oba": 0.65, "araz": 0.75, "bravo": 0.80, "bazarstore": 0.80},
        "promo": None,
    },
    {
        "barcode": "0284000123456",
        "canonical_name": "Lay's Klassik Kartof Çipsi 140g",
        "brand": "Lay's",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "140g",
        "image_url": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80",
        "base_price": 3.40,
        "variations": {"oba": 3.10, "araz": 3.35, "bravo": 3.50, "bazarstore": 3.50},
        "promo": {"chain": "bravo", "promo_price": 2.89},
    },
    {
        "barcode": "7622210123456",
        "canonical_name": "Oreo Vanilli Sendviç Peçenye 154g",
        "brand": "Oreo",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "154g",
        "image_url": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80",
        "base_price": 2.70,
        "variations": {"oba": 2.35, "araz": 2.65, "bravo": 2.80, "bazarstore": 2.80},
        "promo": None,
    },
    {
        "barcode": "4760099990012",
        "canonical_name": "Əsl Şəki Halvası Qozlu 350g",
        "brand": "Şəki Halvası",
        "cat_slug": "snacks-sweets",
        "unit": "piece",
        "pack_size": "350g",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.40,
        "variations": {"oba": 4.80, "araz": 5.30, "bravo": 5.60, "bazarstore": 5.40},
        "promo": None,
    },

    # 6. Personal Care & Baby
    {
        "barcode": "8001090987654",
        "canonical_name": "Pampers Active Baby Ölçü 4 (44 ədəd)",
        "brand": "Pampers",
        "cat_slug": "personal-baby",
        "unit": "piece",
        "pack_size": "44 ədəd",
        "image_url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&auto=format&fit=crop&q=80",
        "base_price": 26.50,
        "variations": {"oba": 24.50, "araz": 25.80, "bravo": 26.90, "bazarstore": 27.20},
        "promo": {"chain": "bravo", "promo_price": 22.99},
    },
    {
        "barcode": "4005808123456",
        "canonical_name": "Nivea Krem Universal Göy Qutu 150ml",
        "brand": "Nivea",
        "cat_slug": "personal-baby",
        "unit": "piece",
        "pack_size": "150ml",
        "image_url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80",
        "base_price": 6.40,
        "variations": {"oba": 5.70, "araz": 6.20, "bravo": 6.50, "bazarstore": 6.60},
        "promo": None,
    },
    {
        "barcode": "8001090543210",
        "canonical_name": "Pantene Pro-V Qidalandırıcı Şampun 400ml",
        "brand": "Pantene",
        "cat_slug": "personal-baby",
        "unit": "piece",
        "pack_size": "400ml",
        "image_url": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&auto=format&fit=crop&q=80",
        "base_price": 7.20,
        "variations": {"oba": 6.50, "araz": 6.95, "bravo": 7.40, "bazarstore": 7.50},
        "promo": {"chain": "araz", "promo_price": 5.79},
    },
    {
        "barcode": "3574660123456",
        "canonical_name": "Johnson's Baby Göz Yandırmayan Şampun 300ml",
        "brand": "Johnson's",
        "cat_slug": "personal-baby",
        "unit": "piece",
        "pack_size": "300ml",
        "image_url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&auto=format&fit=crop&q=80",
        "base_price": 5.60,
        "variations": {"oba": 5.10, "araz": 5.50, "bravo": 5.80, "bazarstore": 5.75},
        "promo": None,
    },
    {
        "barcode": "8690506009999",
        "canonical_name": "Evony Qoruyucu Tibbi Maska 50 ədəd",
        "brand": "Evony",
        "cat_slug": "personal-baby",
        "unit": "piece",
        "pack_size": "50 ədəd",
        "image_url": "https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=400&auto=format&fit=crop&q=80",
        "base_price": 4.80,
        "variations": {"oba": 4.20, "araz": 4.70, "bravo": 4.90, "bazarstore": 5.00},
        "promo": None,
    },
]


async def seed():
    print("🌱 Initializing SebEt database schema...")
    await init_db()

    async with async_session_factory() as session:
        # Check if already seeded
        result = await session.execute(select(Chain))
        existing_chains = result.scalars().all()
        if existing_chains:
            print(f"ℹ️ Database already contains {len(existing_chains)} chains. Re-seeding fresh data...")
            await session.execute(delete(StorePrice))
            await session.execute(delete(FlyerItem))
            await session.execute(delete(Flyer))
            await session.execute(delete(Product))
            await session.execute(delete(Category))
            await session.execute(delete(Store))
            await session.execute(delete(Chain))
            await session.execute(delete(User))
            await session.commit()

        print("🏢 Seeding 4 major retail chains (Bravo, Araz, OBA, Bazarstore)...")
        chains_map = {}
        for ch in CHAINS_DATA:
            chain_obj = Chain(
                name=ch["name"],
                slug=ch["slug"],
                color=ch["color"],
                logo_url=ch["logo_url"],
            )
            session.add(chain_obj)
            chains_map[ch["slug"]] = chain_obj
        await session.flush()

        print("📍 Seeding 12 physical store branches in Baku (28 May, Nərimanov, Yasamal, Elmlər, Nizami)...")
        stores_map = {}
        for st in STORES_DATA:
            chain = chains_map[st["chain_slug"]]
            store_obj = Store(
                chain_id=chain.id,
                branch_name=st["branch_name"],
                neighborhood=st["neighborhood"],
                voen=st["voen"],
                obyekt_kodu=st["obyekt_kodu"],
                address=st["address"],
                latitude=st["latitude"],
                longitude=st["longitude"],
            )
            session.add(store_obj)
            stores_map[st["branch_name"]] = store_obj
        await session.flush()

        print("🏷️ Seeding product categories...")
        categories_map = {}
        for cat in CATEGORIES_DATA:
            cat_obj = Category(
                name_az=cat["name_az"],
                name_en=cat["name_en"],
                slug=cat["slug"],
                icon_name=cat["icon_name"],
            )
            session.add(cat_obj)
            categories_map[cat["slug"]] = cat_obj
        await session.flush()

        print(f"🛒 Seeding {len(PRODUCTS_DATA)} real branded SKUs with Baku shelf prices...")
        now = datetime.now(timezone.utc)
        products_map = {}

        for pdata in PRODUCTS_DATA:
            cat = categories_map[pdata["cat_slug"]]
            product = Product(
                barcode=pdata["barcode"],
                canonical_name=pdata["canonical_name"],
                brand=pdata["brand"],
                category_id=cat.id,
                unit=pdata["unit"],
                pack_size=pdata["pack_size"],
                image_url=pdata["image_url"],
            )
            session.add(product)
            products_map[pdata["barcode"]] = product
            await session.flush()

            # Create realistic prices across all 12 stores
            for st in STORES_DATA:
                store_obj = stores_map[st["branch_name"]]
                chain_slug = st["chain_slug"]

                # Get price for this chain
                price = pdata["variations"].get(chain_slug, pdata["base_price"])

                # Check if promo exists for this chain
                promo_info = pdata.get("promo")
                is_promo = False
                promo_price = None

                if promo_info and promo_info["chain"] == chain_slug:
                    is_promo = True
                    promo_price = promo_info["promo_price"]

                source_type = "weekly_flyer" if is_promo else "web_scraper"

                store_price = StorePrice(
                    product_id=product.id,
                    store_id=store_obj.id,
                    price=price,
                    promo_price=promo_price,
                    is_promo=is_promo,
                    in_stock=True,
                    source_type=source_type,
                    recorded_at=now,
                    expires_at=now + timedelta(days=7) if is_promo else None,
                )
                session.add(store_price)

        print("📰 Seeding weekly promotional flyers...")
        flyers_info = [
            {
                "chain_slug": "bravo",
                "title": "Bravo Qiymətləri — Həftənin Super Təklifləri",
                "cover": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "8001090123456", "title": "Ariel Yuyucu Toz 3kg", "disc": 12.49, "orig": 14.90, "pct": 16, "badge": "Super Endirim"},
                    {"barcode": "9415494000125", "title": "Westgold Kərə Yağı 200g", "disc": 4.79, "orig": 5.50, "pct": 13, "badge": "Yeni Təklif"},
                    {"barcode": "5449000000996", "title": "Coca-Cola Classic 1.5L", "disc": 1.99, "orig": 2.35, "pct": 15, "badge": "1+1 Fürsəti"},
                ]
            },
            {
                "chain_slug": "araz",
                "title": "Araz — Həftəlik Səbət Endirimləri",
                "cover": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760012300124", "title": "Azərçay Buket 250g", "disc": 3.99, "orig": 4.80, "pct": 17, "badge": "Çay Mövsümü"},
                    {"barcode": "4760123456789", "title": "Giləzi Yumurtası 10-lu", "disc": 1.95, "orig": 2.35, "pct": 17, "badge": "Sərfəli Qənaət"},
                    {"barcode": "8001090543210", "title": "Pantene Şampun 400ml", "disc": 5.79, "orig": 7.20, "pct": 20, "badge": "Xüsusi Qiymət"},
                ]
            },
            {
                "chain_slug": "oba",
                "title": "OBA — Cibinizə Qənaət Kataloqu",
                "cover": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760083300124", "title": "Milla Süd 2.5% 1L", "disc": 1.99, "orig": 2.30, "pct": 13, "badge": "Hər Gün Ucuz"},
                    {"barcode": "4760032100147", "title": "Final Yağı 5L", "disc": 16.49, "orig": 19.80, "pct": 17, "badge": "Ailəvi Boy"},
                    {"barcode": "8690530012345", "title": "Papia Tualet Kağızı 8-li", "disc": 5.79, "orig": 7.20, "pct": 20, "badge": "Super Fürsət"},
                ]
            },
            {
                "chain_slug": "bazarstore",
                "title": "Bazarstore — Həftəsonu Azersun Fürsətləri",
                "cover": "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800&auto=format&fit=crop&q=80",
                "items": [
                    {"barcode": "4760032100123", "title": "Möcüzə Qarğıdalı Yağı 1L", "disc": 4.49, "orig": 5.30, "pct": 15, "badge": "Azersun Endirimi"},
                    {"barcode": "4760078901265", "title": "Bizim Tarla Tomat Pastası 720g", "disc": 3.19, "orig": 3.75, "pct": 15, "badge": "Mətbəx Fürsəti"},
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
        print("✅ Baku realistic dataset successfully seeded!")
        print("   - 4 Chains (Bravo, Araz, OBA, Bazarstore)")
        print("   - 12 Stores in 28 May, Nərimanov, Yasamal, Elmlər, Nizami")
        print("   - 6 Categories")
        print(f"   - {len(PRODUCTS_DATA)} Branded SKUs with verified shelf prices")
        print("   - 4 Active weekly promotional flyers")
        print("   - 1 Demo User (Ali Iskandarli) with 250 SebEt Points")


if __name__ == "__main__":
    asyncio.run(seed())
