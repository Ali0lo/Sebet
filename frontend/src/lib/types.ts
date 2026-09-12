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
  is_split_viable: boolean;
  primary_store: SplitStoreInfo;
  secondary_store: SplitStoreInfo;
  store_1?: SplitStoreInfo;
  store_2?: SplitStoreInfo;
  total_cost: number;
  savings_azn: number;
  savings_vs_single_azn?: number;
  savings_percent: number;
  walking_distance_meters: number;
  distance_between_stores_m?: number;
}

export interface BasketOptimizationResponse {
  basket_count: number;
  is_split_viable: boolean;
  single_store_baseline?: SingleStoreResult | null;
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

export interface MerchantChain {
  id: string;
  name: string;
  slug: string;
  category: string;
  color?: string | null;
  logo_url?: string | null;
}

export interface MerchantSummaryMetrics {
  merchant_id: string;
  merchant_name: string;
  category: string;
  total_revenue: string | number;
  total_points_issued: number;
  unique_customer_count: number;
  total_transactions: number;
  average_basket_size: string | number;
  average_points_earned_per_transaction: number;
  repeat_customer_rate: number;
}

export interface MerchantCoreMetrics {
  average_basket_size: string | number;
  average_points_earned_per_transaction: number;
  repeat_customer_rate: number;
}

export interface CategoryBenchmarkMetrics {
  category: string;
  k_anonymity_threshold: number;
  participating_merchants_count: number;
  average_basket_size: string | number;
  average_points_earned_per_transaction: number;
  repeat_customer_rate: number;
}

export interface CrossShoppingAffinity {
  category: string;
  affinity_percentage: number;
  description: string;
}

export interface MerchantBenchmarkResponse {
  merchant_id: string;
  merchant_name: string;
  category: string;
  benchmark_available: boolean;
  message: string;
  merchant_metrics: MerchantCoreMetrics;
  category_benchmark?: CategoryBenchmarkMetrics | null;
  cross_shopping_affinities: CrossShoppingAffinity[];
}

export interface RawTransaction {
  id: string;
  receipt_number?: string | null;
  total_amount: string | number;
  purchased_at: string;
  sebet_points_awarded: number;
  status: string;
  merchant_id?: string | null;
}

export interface BrandBoostResult {
  campaign_id: string;
  brand_name: string;
  campaign_title: string;
  multiplier: number;
  matched_keywords: string[];
  bonus_points: number;
  bonus_usd: number;
}

export interface ReceiptSubmitPayload {
  user_id?: string;
  merchant_id?: string;
  merchant_name?: string;
  receipt_number?: string;
  total_amount: number | string;
  purchased_at?: string;
  image_hash?: string;
  image_base64?: string;
  terminal_id?: string;
  image_url?: string;
  raw_ocr_text?: string;
  earn_rate?: number;
  line_items?: Array<{ raw_name: string; total_price?: number; price?: number }>;
}

export interface ReceiptSubmitResult {
  success: boolean;
  receipt_id: string;
  status: "APPROVED" | "FLAGGED_REVIEW" | "REJECTED" | string;
  is_flagged: boolean;
  is_rejected: boolean;
  rejection_reason?: string | null;
  points_awarded: number;
  base_points?: number;
  bonus_points?: number;
  brand_boost?: BrandBoostResult | null;
  ledger_transaction_id?: string | null;
  total_amount: number | string;
  message: string;
}

export interface BrandCampaign {
  id: string;
  brand_name: string;
  title: string;
  description?: string | null;
  target_sku_keywords: string[];
  multiplier: number;
  cpc_bid: number;
  budget_pool_remaining: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  banner_image_url?: string | null;
  category: string;
  created_at: string;
}

export interface AdEventRequest {
  campaign_id: string;
  event_type: "IMPRESSION" | "CLICK" | "CONVERSION_EARN" | string;
  user_id?: string;
  metadata?: Record<string, any>;
}

export interface AdEventResponse {
  success: boolean;
  event_id: string;
  campaign_id: string;
  event_type: string;
  cost_deducted: number;
  budget_pool_remaining: number;
  message: string;
}

export interface BrandAnalyticsCampaignItem {
  id: string;
  brand_name: string;
  title: string;
  multiplier: number;
  category: string;
  is_active: boolean;
  cpc_bid: number;
  budget_pool_remaining: number;
  impressions: number;
  clicks: number;
  ctr_percent: number;
  conversions: number;
  spent_usd: number;
}

export interface BrandAnalyticsResponse {
  total_campaigns: number;
  total_impressions: number;
  total_clicks: number;
  ctr_percent: number;
  total_conversions: number;
  total_spent_usd: number;
  total_budget_remaining_usd: number;
  campaigns: BrandAnalyticsCampaignItem[];
}

export interface LedgerBalanceResponse {
  account_id: string;
  account_code: string;
  name: string;
  category: string;
  currency: string;
  balance_amount: number | string;
  points_balance: number;
}

export interface CreateVoucherPayload {
  user_id?: string;
  merchant_id: string;
  points_amount: number;
}

export interface VoucherResponse {
  voucher_code: string;
  user_id: string;
  merchant_id: string;
  merchant_name: string;
  points_amount: number;
  usd_value: number | string;
  expires_at: string;
  signature: string;
  message: string;
}

export interface VoucherStatusResponse {
  voucher_code: string;
  status: "ACTIVE" | "CLAIMED" | "EXPIRED" | "CANCELLED";
  points_amount: number;
  usd_value: number | string;
  merchant_id: string;
  merchant_name: string;
  expires_at: string;
  claimed_at?: string | null;
  is_expired: boolean;
  ledger_transaction_id?: string | null;
  message: string;
}

export interface ClaimVoucherPayload {
  voucher_code: string;
  cashier_notes?: string;
}

export interface ClaimVoucherResult {
  success: boolean;
  voucher_code: string;
  merchant_id: string;
  merchant_name: string;
  points_redeemed: number;
  gross_discount_usd: number | string;
  platform_servicing_fee_usd: number | string;
  merchant_net_reimbursement_usd: number | string;
  ledger_transaction_id: string;
  user_remaining_points: number;
  claimed_at: string;
  message: string;
}

export interface VoucherPreviewResult {
  voucher_code: string;
  points_amount: number;
  gross_discount_usd: number | string;
  platform_servicing_fee_usd: number | string;
  merchant_net_reimbursement_usd: number | string;
  status: string;
  is_valid: boolean;
  expires_at: string;
  merchant_id: string;
  merchant_name: string;
  is_merchant_match: boolean;
  user_name: string;
}


