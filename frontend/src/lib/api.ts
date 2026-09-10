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


