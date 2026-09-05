# SebEt — Consumer Grocery Price Intelligence & Smart Basket Optimizer for Baku, Azerbaijan

[![Next.js 15](https://img.shields.io/badge/Next.js-15%20(App%20Router)-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?logo=postgresql)](https://github.com/pgvector/pgvector)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d?logo=redis)](https://redis.io/)
[![Baku Retail](https://img.shields.io/badge/Marketlər-Bravo%20%7C%20Araz%20%7C%20OBA%20%7C%20Bazarstore-059669)](#)

> **"Səbətini SebEt"** — Price discovery and smart basket optimizer that compares shelf prices across Baku's top supermarket chains (**Bravo**, **Araz**, **OBA**, and **Bazarstore**) without requiring POS integrations. Leverages crowdsourced receipt OCR (*"ƏDV Geri Al"* habit), weekly brochure parsing, and web scrapers.

---

## 1. Quick Start with Docker Compose

To start the complete stack (PostgreSQL with pgvector, Redis, FastAPI backend, Next.js 15 frontend, and auto-seeded Baku dataset):

```bash
docker compose up --build
```

- **Frontend (Next.js 15):** [http://localhost:3000](http://localhost:3000)
- **Backend API (FastAPI):** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 2. Local Development (Without Docker)

### Backend (FastAPI):
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run seed script (supports PostgreSQL or SQLite)
DATABASE_URL="sqlite+aiosqlite:///./sebet.db" python scripts/seed_baku_data.py

# Start API server
DATABASE_URL="sqlite+aiosqlite:///./sebet.db" uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Next.js 15):
```bash
cd frontend
npm install
npm run dev
```

---

## 3. Baku Seed Dataset Summary

The database is pre-populated with:
- **4 Supermarket Chains:** Bravo (PASHA Holding), Araz (Veysəloğlu), OBA (Discounter), Bazarstore (Azersun).
- **12 Real Store Branches in Baku:**
  - *28 May / Nəsimi:* Bravo 28 Mall, Araz 28 May, OBA 28 May, Bazarstore 28 May.
  - *Nərimanov:* Araz Nərimanov, OBA Nərimanov.
  - *Yasamal / İnşaatçılar:* Bravo Yasamal, Bazarstore Yasamal.
  - *Elmlər Akademiyası:* Araz Elmlər, Bazarstore Elmlər.
  - *Nizami / Tarqovı:* OBA Nizami.
  - *Koroğlu:* Bravo Koroğlu Hypermarket.
- **54 Real Packaged Grocery SKUs:**
  - Milla Süd 2.5% 1L, Westgold Kərə Yağı 200g, Ariel Dağ Təravəti 3kg, Azərçay Buket 250g, Sirab 1.5L, Bizim Süfrə Mayonez 400ml, Möcüzə Yağı 1L, Final Yağı 5L, Makfa Spagetti, Duru Zeytun Sabunu, Papia Tualet Kağızı, Jacobs Monarch Qəhvə, Saville Nar Şirəsi, Atena Ağ Pendir, etc.
- **Realistic Price Variances:** Reflects real discounter vs premium margins, weekly flyer promotions, and store-specific discounts.
- **4 Active Weekly Leaflets:** Digitized discount catalogs from Bravo, Araz, OBA, and Bazarstore.

---

## 4. Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/products/search` | Fuzzy text, category, and chain search |
| `GET` | `/api/v1/products/{barcode}` | EAN-13 barcode lookup & cross-chain price comparison |
| `GET` | `/api/v1/products/top-deals` | Top weekly discounted items in Baku |
| `POST` | `/api/v1/basket/optimize` | Dual-store walking split (<600m) vs single-store best |
| `POST` | `/api/v1/receipts/upload` | Multipart receipt upload, OpenCV + OCR parsing, +50 points |
| `GET` | `/api/v1/receipts/samples` | Preset Baku sample receipts for 1-click testing |
| `POST` | `/api/v1/receipts/parse-sample/{id}` | Instant test with pre-extracted fiscal receipt |
| `GET` | `/api/v1/flyers/active` | Active weekly promotional catalogs with digitized items |
| `GET` | `/api/v1/stores/nearby` | Supermarkets within X km radius of Baku coordinates |
| `GET` | `/api/v1/users/me` | User points balance & profile |
| `POST` | `/api/v1/users/redeem` | Redeem points for Gloria Jean's, Azercell, or cinema vouchers |

---

## 5. Smart Basket Optimizer Algorithm ("Ağıllı Səbət")

Given a shopping basket $\mathcal{B} = \{(p_1, q_1), \dots, (p_n, q_n)\}$:

1. **Single-Store Best:**
   $$\text{Cost}(s) = \sum_{i=1}^n q_i \times \text{Price}(p_i, s)$$
   subject to $\text{Coverage}(s) \ge 75\%$.

2. **Dual-Store Walking Split ($s_1, s_2$ within 600m):**
   $$\text{Cost}(s_1, s_2) = \sum_{i=1}^n q_i \times \min\Big(\text{Price}(p_i, s_1), \text{Price}(p_i, s_2)\Big)$$
   Calculates net savings in AZN and percent:
   $$\Delta_{\text{savings}} = \text{Cost}(S_{\text{best}}) - \text{Cost}(s_1, s_2)$$

---

## 6. Crowdsourced Receipt OCR & "ƏDV Geri Al" Synergy

Azerbaijani shoppers already photograph fiscal receipts into **Birbank / edvgerial.az** for their 3% - 5% state VAT cashback. **SebEt** piggybacks on this daily reflex:
1. User snaps the cash register receipt (*Fiskal Kassa Qəbzi*).
2. OpenCV contrast enhancement and regex parser extract:
   - Supermarket legal VÖEN (`1401564751` for Bravo, `1400124571` for Araz, `1700893241` for OBA)
   - Store branch `Obyekt Kodu`
   - Fiscal ID (`NÖŞ`)
   - Line items: `[Item Name] x [Qty] = [Price] AZN`
3. Canonical SKU matcher maps line text to master database and updates `store_prices`.
4. User receives **+50 SebEt Points**, redeemable for partner coffee vouchers, cinema tickets, or mobile top-ups.

