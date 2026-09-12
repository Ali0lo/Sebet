import {
  Product,
  BasketOptimizationResponse,
  ParsedReceipt,
  SampleReceipt,
  Flyer,
  Category,
  User,
  Reward,
  NearbyStore,
  SearchRecommendationsResponse,
  MerchantChain,
  MerchantSummaryMetrics,
  MerchantBenchmarkResponse,
  RawTransaction,
  ReceiptSubmitPayload,
  ReceiptSubmitResult,
  LedgerBalanceResponse,
  CreateVoucherPayload,
  VoucherResponse,
  VoucherStatusResponse,
  ClaimVoucherPayload,
  ClaimVoucherResult,
  VoucherPreviewResult,
  BrandCampaign,
  AdEventRequest,
  AdEventResponse,
  BrandAnalyticsResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = "API request failed";
    try {
      const err = await res.json();
      errorDetail = err.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export async function searchProducts(
  q?: string,
  categoryId?: string,
  chainSlug?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ total: number; page: number; page_size: number; items: Product[] }> {
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (categoryId) params.append("category_id", categoryId);
  if (chainSlug) params.append("chain_slug", chainSlug);
  params.append("page", page.toString());
  params.append("page_size", pageSize.toString());

  return fetchJson(`/api/v1/products/search?${params.toString()}`);
}

export async function getTopDeals(): Promise<Product[]> {
  return fetchJson("/api/v1/products/top-deals?limit=10");
}

export async function getProductByBarcode(barcode: string): Promise<Product> {
  return fetchJson(`/api/v1/products/${encodeURIComponent(barcode)}`);
}

export async function getProductById(id: string): Promise<Product> {
  return fetchJson(`/api/v1/products/${encodeURIComponent(id)}`);
}

export async function optimizeBasket(
  items: { product_id: string; quantity: number }[],
  latitude: number = 40.3800,
  longitude: number = 49.8475,
  maxWalkingDistanceM: number = 750.0
): Promise<BasketOptimizationResponse> {
  return fetchJson("/api/v1/basket/optimize", {
    method: "POST",
    body: JSON.stringify({
      items,
      latitude,
      longitude,
      max_walking_distance_m: maxWalkingDistanceM,
    }),
  });
}

export async function uploadReceipt(formData: FormData): Promise<ParsedReceipt> {
  const res = await fetch(`${API_BASE}/api/v1/receipts/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = "Receipt upload failed";
    try {
      const err = await res.json();
      errorDetail = err.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export async function getSampleReceipts(): Promise<SampleReceipt[]> {
  return fetchJson("/api/v1/receipts/samples");
}

export async function parseSampleReceipt(sampleId: string): Promise<ParsedReceipt> {
  const res = await fetch(`${API_BASE}/api/v1/receipts/parse-sample/${sampleId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error("Failed to process sample receipt");
  }

  return res.json();
}

export async function getActiveFlyers(): Promise<Flyer[]> {
  return fetchJson("/api/v1/flyers/active");
}

export async function getCategories(): Promise<Category[]> {
  return fetchJson("/api/v1/categories");
}

export async function getUserProfile(): Promise<User> {
  return fetchJson("/api/v1/users/me");
}

export async function getAvailableRewards(): Promise<Reward[]> {
  return fetchJson("/api/v1/users/rewards");
}

export async function redeemReward(
  rewardId: string,
  pointsCost: number,
  title: string
): Promise<{ success: boolean; voucher_code: string; remaining_points: number; message: string }> {
  return fetchJson("/api/v1/users/redeem", {
    method: "POST",
    body: JSON.stringify({
      reward_id: rewardId,
      points_cost: pointsCost,
      title,
    }),
  });
}

export async function getNearbyStores(
  latitude: number,
  longitude: number,
  radiusKm: number = 5.0
): Promise<NearbyStore[]> {
  return fetchJson(
    `/api/v1/stores/nearby?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`
  );
}

export async function getSearchRecommendations(
  query?: string
): Promise<SearchRecommendationsResponse> {
  const params = new URLSearchParams();
  if (query) params.append("q", query);
  return fetchJson(`/api/v1/search/recommendations?${params.toString()}`);
}

export async function getAvailableMerchants(): Promise<MerchantChain[]> {
  return fetchJson("/api/v1/analytics/merchants");
}

export async function getMerchantSummary(
  merchantId: string
): Promise<MerchantSummaryMetrics> {
  return fetchJson("/api/v1/analytics/merchant/me/summary", {
    headers: { "X-Merchant-Id": merchantId },
  });
}

export async function getMerchantBenchmark(
  merchantId: string
): Promise<MerchantBenchmarkResponse> {
  return fetchJson("/api/v1/analytics/merchant/me/benchmark", {
    headers: { "X-Merchant-Id": merchantId },
  });
}

export async function getMerchantTransactions(
  merchantId: string
): Promise<RawTransaction[]> {
  return fetchJson("/api/v1/analytics/merchant/transactions", {
    headers: { "X-Merchant-Id": merchantId },
  });
}

export async function submitReceipt(
  payload: ReceiptSubmitPayload
): Promise<ReceiptSubmitResult> {
  return fetchJson("/api/v1/receipts/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLedgerBalance(
  userId?: string
): Promise<LedgerBalanceResponse> {
  const url = userId ? `/api/v1/ledger/balance/${userId}` : "/api/v1/ledger/balance";
  return fetchJson(url);
}

export async function createRedemptionVoucher(
  payload: CreateVoucherPayload
): Promise<VoucherResponse> {
  return fetchJson("/api/v1/redemption/create-voucher", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getVoucherStatus(
  voucherCode: string
): Promise<VoucherStatusResponse> {
  return fetchJson(`/api/v1/redemption/voucher/${encodeURIComponent(voucherCode)}/status`);
}

export async function previewVoucher(
  voucherCode: string,
  merchantId: string
): Promise<VoucherPreviewResult> {
  return fetchJson(`/api/v1/redemption/voucher/${encodeURIComponent(voucherCode)}/preview`, {
    headers: { "X-Merchant-Id": merchantId },
  });
}

export async function claimVoucher(
  payload: ClaimVoucherPayload,
  merchantId: string
): Promise<ClaimVoucherResult> {
  return fetchJson("/api/v1/redemption/claim-voucher", {
    method: "POST",
    headers: { "X-Merchant-Id": merchantId },
    body: JSON.stringify(payload),
  });
}

export async function getSponsoredCampaigns(
  category?: string,
  limit: number = 20
): Promise<BrandCampaign[]> {
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (limit) query.set("limit", limit.toString());
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/v1/media/campaigns${queryString}`);
}

export async function trackAdEvent(
  payload: AdEventRequest
): Promise<AdEventResponse> {
  return fetchJson("/api/v1/media/track", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBrandAnalytics(
  brandName?: string,
  campaignId?: string
): Promise<BrandAnalyticsResponse> {
  const query = new URLSearchParams();
  if (brandName) query.set("brand_name", brandName);
  if (campaignId) query.set("campaign_id", campaignId);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/v1/media/brand-analytics${queryString}`);
}


