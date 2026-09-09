export interface StorePrice {
  store_id: string;
  branch_name: string;
  neighborhood?: string;
  chain_name: string;
  chain_slug: string;
  chain_color: string;
  price: number;
  promo_price?: number | null;
  is_promo: boolean;
  in_stock: boolean;
  source_type: string;
  confidence_score: number;
  recorded_at: string;
}

export interface NearbyStore {
  id: string;
  branch_name: string;
  neighborhood: string;
  chain_name: string;
  chain_slug: string;
  chain_color: string;
  voen?: string;
  obyekt_kodu?: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km: number;
}

export interface Product {
  id: string;
  barcode?: string | null;
  canonical_name: string;
  brand?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  unit: string;
  pack_size?: string | null;
  image_url?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  prices: StorePrice[];
}

export interface BasketItem {
  product: Product;
  quantity: number;
}

export interface BasketItemDetail {
  product_id: string;
  product_name: string;
  brand?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SingleStoreResult {
  store_id: string;
  branch_name: string;
  neighborhood?: string;
  chain_name: string;
  chain_slug: string;
  chain_color: string;
  address: string;
  latitude: number;
  longitude: number;
  total_cost: number;
  coverage_pct: number;
  distance_km: number;
  items: BasketItemDetail[];
  missing_items_count: number;
}

export interface SplitStoreInfo {
  store_id: string;
  branch_name: string;
  chain_name: string;
  chain_slug: string;
  chain_color: string;
  address: string;
  latitude: number;
  longitude: number;
  subtotal: number;
  items: BasketItemDetail[];
}

export interface SplitStoreResult {
  store_1: SplitStoreInfo;
  store_2: SplitStoreInfo;
  total_cost: number;
  distance_between_stores_m: number;
  savings_vs_single_azn: number;
  savings_percent: number;
}

export interface BasketOptimizationResponse {
  basket_count: number;
  best_single_store: SingleStoreResult | null;
  best_split_store: SplitStoreResult | null;
  all_single_stores: SingleStoreResult[];
}

export interface ReceiptLineItem {
  raw_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  matched_product_id?: string | null;
  matched_product_name?: string | null;
  confidence_score: number;
}

export interface ParsedReceipt {
  id: string;
  fiscal_id?: string | null;
  voen?: string | null;
  obyekt_kodu?: string | null;
  matched_store_id?: string | null;
  store_name?: string | null;
  chain_name?: string | null;
  chain_color?: string | null;
  receipt_date?: string | null;
  total_amount?: number | null;
  items: ReceiptLineItem[];
  processing_status: string;
  sebet_points_awarded: number;
  raw_ocr_text?: string | null;
  message: string;
}

export interface SampleReceipt {
  id: string;
  title: string;
  store_name: string;
  voen: string;
  obyekt_kodu: string;
  total_amount: number;
  raw_text: string;
}

export interface FlyerItem {
  id: string;
  product_id?: string | null;
  title: string;
  discount_price: number;
  original_price: number;
  discount_percent: number;
  image_url?: string | null;
  badge_text?: string | null;
}

export interface Flyer {
  id: string;
  chain_name: string;
  chain_slug: string;
  chain_color: string;
  title: string;
  start_date: string;
  end_date: string;
  pdf_url?: string | null;
  cover_image_url: string;
  items: FlyerItem[];
}

export interface Category {
  id: string;
  name_az: string;
  name_en?: string | null;
  slug: string;
  icon_name?: string | null;
  product_count?: number;
}

export interface User {
  id: string;
  phone_number: string;
  full_name?: string | null;
  sebet_points: number;
}

export interface Reward {
  id: string;
  title: string;
  points_cost: number;
  category: string;
  icon: string;
}

export interface SearchRecommendationCategory {
  name: string;
  icon: string;
  slug: string;
}

export interface SearchRecommendationsResponse {
  query: string;
  source: string;
  suggestions: string[];
  trending: string[];
  categories: SearchRecommendationCategory[];
}


