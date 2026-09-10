"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Barcode,
  Sparkles,
  Flame,
  ShoppingBag,
  Compass,
  ArrowRight,
  TrendingUp,
  Tag,
  Check,
  Percent,
  Layers,
  Store,
} from "lucide-react";
import { searchProducts, getTopDeals, getCategories, getSearchRecommendations } from "@/lib/api";
import { Product, Category, SearchRecommendationsResponse } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { NearbyMarketsModal } from "@/components/NearbyMarketsModal";
import { useSebetStore } from "@/lib/store";

const CATEGORY_ICONS: Record<string, { emoji: string; bg: string; border: string }> = {
  "dairy-eggs": { emoji: "🥛", bg: "from-blue-500/20 to-sky-500/10", border: "border-sky-200 dark:border-sky-800" },
  "bakery": { emoji: "🍞", bg: "from-amber-500/20 to-yellow-500/10", border: "border-amber-200 dark:border-amber-800" },
  "meat-poultry": { emoji: "🥩", bg: "from-rose-500/20 to-red-500/10", border: "border-rose-200 dark:border-rose-800" },
  "pantry-cooking": { emoji: "🥫", bg: "from-emerald-500/20 to-teal-500/10", border: "border-emerald-200 dark:border-emerald-800" },
  "beverages-tea": { emoji: "☕", bg: "from-orange-500/20 to-amber-500/10", border: "border-orange-200 dark:border-orange-800" },
  "snacks-sweets": { emoji: "🍫", bg: "from-purple-500/20 to-pink-500/10", border: "border-purple-200 dark:border-purple-800" },
  "cleaning-household": { emoji: "🧼", bg: "from-teal-500/20 to-cyan-500/10", border: "border-teal-200 dark:border-teal-800" },
  "personal-care-baby": { emoji: "👶", bg: "from-pink-500/20 to-rose-500/10", border: "border-pink-200 dark:border-pink-800" },
};

const SHORT_CATEGORY_NAMES: Record<string, string> = {
  "dairy-eggs": "Süd",
  "cleaning-household": "Təmizlik",
  "beverages-tea": "Çay & Qəhvə",
  "bakery": "Çörək",
  "snacks-sweets": "Şirniyyat",
  "personal-care-baby": "Qulluq",
  "pantry-cooking": "Əsas Ərzaq",
  "meat-poultry": "Ət & Balıq",
};

function getCategoryShortName(cat: Category): string {
  if (cat.slug && SHORT_CATEGORY_NAMES[cat.slug]) {
    return SHORT_CATEGORY_NAMES[cat.slug];
  }
  const name = (cat.name_az || "").toLowerCase();
  if (name.includes("süd")) return "Süd";
  if (name.includes("təmizlik")) return "Təmizlik";
  if (name.includes("çay") || name.includes("qəhvə") || name.includes("içki")) return "Çay & Qəhvə";
  if (name.includes("çörək")) return "Çörək";
  if (name.includes("şirniyyat")) return "Şirniyyat";
  if (name.includes("qulluq") || name.includes("şəxsi")) return "Qulluq";
  if (name.includes("ərzaq") || name.includes("yağ")) return "Əsas Ərzaq";
  if (name.includes("ət") || name.includes("balıq")) return "Ət & Balıq";
  if (name.includes("meyvə") || name.includes("tərəvəz")) return "Meyvə";
  return cat.name_az.split("&")[0].split("(")[0].split(",")[0].trim();
}

const HERO_PROMOS = [
  {
    id: "bravo-promo",
    chain: "Bravo",
    chainSlug: "bravo",
    title: "Həftənin Möhtəşəm Fürsətləri",
    badge: "35%-dək Endirim",
    color: "from-emerald-700 via-emerald-800 to-slate-900",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "araz-promo",
    chain: "Araz",
    chainSlug: "araz",
    title: "Ailəvi Qənaət Günləri",
    badge: "Həftəlik Aksiya",
    color: "from-rose-700 via-red-800 to-slate-900",
    image: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "oba-promo",
    chain: "OBA",
    chainSlug: "oba",
    title: "Qənaətli Xalq Qiymətləri",
    badge: "Xüsusi Təkliflər",
    color: "from-green-700 via-emerald-800 to-slate-900",
    image: "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recommendations, setRecommendations] = useState<SearchRecommendationsResponse | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNearbyModalOpen, setIsNearbyModalOpen] = useState(false);

  const [topDeals, setTopDeals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedDealIds, setAddedDealIds] = useState<{ [key: string]: boolean }>({});

  const { addToBasket } = useSebetStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load initial deals, categories, and initial recommendations
  useEffect(() => {
    async function loadData() {
      try {
        const [dealsData, catsData, recsData] = await Promise.all([
          getTopDeals().catch(() => []),
          getCategories().catch(() => []),
          getSearchRecommendations().catch(() => null),
        ]);
        setTopDeals(dealsData);
        setCategories(catsData);
        if (recsData) setRecommendations(recsData);
      } catch (err) {
        console.error("Home load failed", err);
      }
    }
    loadData();
  }, []);

  // Fetch contextual search recommendations when user types
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const recs = await getSearchRecommendations(searchQuery || undefined);
        if (!isCancelled && recs) {
          setRecommendations(recs);
        }
      } catch {
        // ignore
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Live search when user types query
  useEffect(() => {
    let isCancelled = false;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchProducts(searchQuery, undefined, undefined, 1, 10);
        if (!isCancelled) {
          setSearchResults(res.items);
        }
      } catch {
        // ignore
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Handle clicking outside of search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectRecommendation = (term: string) => {
    setSearchQuery(term);
    setIsSearchFocused(false);
  };

  const handleAddDealToBasket = (prod: Product) => {
    addToBasket(prod, 1);
    setAddedDealIds((prev) => ({ ...prev, [prod.id]: true }));
    setTimeout(() => {
      setAddedDealIds((prev) => ({ ...prev, [prod.id]: false }));
    }, 1800);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Trendyol-Style Modern Search Bar with AI Recommendations */}
      <div ref={searchContainerRef} className="relative z-30">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Məhsul, brend və ya kateqoriya axtarın..."
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-20 py-2.5 sm:py-3 rounded-xl bg-slate-100 dark:bg-zinc-900/80 hover:bg-slate-200/70 dark:hover:bg-zinc-850 focus:bg-white dark:focus:bg-zinc-900 border border-slate-200 dark:border-zinc-800 focus:border-emerald-500 dark:focus:border-emerald-500 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full bg-slate-200/70 dark:bg-zinc-800 transition-colors"
                title="Təmizlə"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800 active:scale-95 transition-colors"
              title="Barkod skaneri aç"
            >
              <Barcode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* OpenAI Search Recommendations Dropdown Overlay */}
        {isSearchFocused && recommendations && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-zinc-800 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* AI or Autocomplete Suggestions */}
            {recommendations.suggestions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Ağıllı Təkliflər (AI)</span>
                  </span>
                  {recommendations.source === "openai" && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-mono">
                      OpenAI
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recommendations.suggestions.map((sug, idx) => (
                    <button
                      key={`sug-${idx}`}
                      onClick={() => handleSelectRecommendation(sug)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
                    >
                      <Search className="w-3 h-3 text-slate-400" />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Supermarket Searches */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Bakıda Populyar Axtarışlar</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recommendations.trending.slice(0, 6).map((trend, idx) => (
                  <button
                    key={`trend-${idx}`}
                    onClick={() => handleSelectRecommendation(trend)}
                    className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium border border-slate-200/60 dark:border-zinc-700/60 flex items-center gap-1 transition-all"
                  >
                    <TrendingUp className="w-3 h-3 text-rose-500" />
                    <span>{trend}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Jump to Category */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                Daha çox axtarış seçimləri
              </span>
              <Link
                href="/flyers"
                onClick={() => setIsSearchFocused(false)}
                className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Bütün Kataloqa Keç</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* PRIORITIZED CATEGORIES: Trendyol-Style Vibrant Stories / Bubbles */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <span>Kateqoriyalar</span>
          </h2>
          <Link
            href="/flyers"
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            <span>Hamısına bax</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 pt-1 -mx-4 px-4 scrollbar-none no-scrollbar">
          {categories.map((cat) => {
            const conf = CATEGORY_ICONS[cat.slug] || {
              emoji: "🛍️",
              bg: "from-emerald-500/20 to-teal-500/10",
              border: "border-slate-200 dark:border-zinc-800",
            };

            return (
              <Link
                key={cat.id}
                href={`/flyers?cat=${cat.slug}`}
                className="flex flex-col items-center gap-1.5 shrink-0 snap-start group focus:outline-hidden"
              >
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${conf.bg} ${conf.border} border flex items-center justify-center text-2xl sm:text-3xl shadow-xs group-hover:scale-105 group-active:scale-95 transition-all`}
                >
                  <span>{conf.emoji}</span>
                </div>
                <span className="whitespace-nowrap text-[11px] font-medium text-slate-700 dark:text-zinc-300 text-center group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {getCategoryShortName(cat)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Active Search Results (if user is actively querying) */}
      {searchQuery.trim() ? (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Axtarış nəticələri: &ldquo;{searchQuery}&rdquo; ({searchResults.length})
            </h3>
            <Link
              href={`/flyers?q=${encodeURIComponent(searchQuery)}`}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Kataloqda tam bax</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isSearching ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-60 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800"
                />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-10 p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-3xl">🔍</div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Məhsul tapılmadı
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Digər açar sözlər və ya kateqoriyalar üzrə axtarın.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {searchResults.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onOpenDetails={() => setIsScannerOpen(true)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* HERO CAMPAIGN BANNERS: Supermarket Weekly Flyers Highlights */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Həftəlik Kampaniyalar
              </span>
              <button
                onClick={() => setIsNearbyModalOpen(true)}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-1 active:scale-95"
              >
                <Compass className="w-3 h-3" />
                <span>Yaxın Filiallar</span>
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none no-scrollbar">
              {HERO_PROMOS.map((promo) => (
                <Link
                  key={promo.id}
                  href={`/flyers?chain=${promo.chainSlug}`}
                  className="w-72 shrink-0 rounded-2xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden relative shadow-sm group active:scale-98 transition-all"
                >
                  <div className="h-36 w-full relative">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 flex flex-col justify-end text-white">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-600 w-fit mb-1 shadow-xs">
                        {promo.badge}
                      </span>
                      <h3 className="text-sm font-black tracking-tight leading-tight">
                        {promo.title}
                      </h3>
                      <span className="text-[11px] text-emerald-300 font-bold mt-1 flex items-center gap-1">
                        <span>{promo.chain} Jurnalını Aç</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* FLASH DEALS CAROUSEL ("Günün Ən Yaxşı Endirimləri") */}
          {topDeals.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Günün Ən Yaxşı Endirimləri
                  </h2>
                </div>
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/50">
                  Super Qənaət
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-4 px-4 scrollbar-none no-scrollbar">
                {topDeals.map((prod) => {
                  const promoPrice = prod.min_price || 0;
                  const origPrice = prod.max_price || promoPrice * 1.25;
                  const discountPct = Math.round(
                    ((origPrice - promoPrice) / origPrice) * 100
                  );
                  const isAdded = addedDealIds[prod.id];
                  const chainName = prod.prices?.[0]?.chain_name || "Bravo";

                  return (
                    <div
                      key={`deal-${prod.id}`}
                      className="w-44 shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all p-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative w-full h-28 rounded-xl bg-slate-50 dark:bg-zinc-850 overflow-hidden mb-2.5 flex items-center justify-center border border-slate-100 dark:border-zinc-800/80">
                          {prod.image_url ? (
                            <img
                              src={prod.image_url}
                              alt={prod.canonical_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">📦</span>
                          )}
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold uppercase tracking-wider shadow-xs border border-white/10 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{chainName}</span>
                          </span>
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black shadow-xs">
                            -{discountPct > 0 ? discountPct : 20}%
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 line-clamp-2 min-h-[32px]">
                          {prod.canonical_name}
                        </h4>

                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {promoPrice.toFixed(2)} ₼
                          </span>
                          <span className="text-xs text-slate-400 dark:text-zinc-500 line-through">
                            {origPrice.toFixed(2)} ₼
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddDealToBasket(prod)}
                        className={`mt-2.5 w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border active:scale-95 ${
                          isAdded
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Əlavə olundu</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Səbətə at</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Direct CTA to Merged Catalog & Products */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-200">
                Bütün Marketlər & Rəflər
              </span>
              <h3 className="text-sm font-black">
                1,200+ Məhsul və Həftəlik Jurnallar
              </h3>
              <p className="text-[11px] text-emerald-100">
                Bravo, Araz, OBA, Bazarstore, Al Market, Neptun, Spar
              </p>
            </div>
            <Link
              href="/flyers"
              className="px-3.5 py-2 rounded-xl bg-white text-emerald-800 text-xs font-black shrink-0 hover:bg-emerald-50 transition-all flex items-center gap-1 shadow-xs active:scale-95"
            >
              <span>Kataloqa Keç</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      )}

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      <NearbyMarketsModal
        isOpen={isNearbyModalOpen}
        onClose={() => setIsNearbyModalOpen(false)}
      />
    </div>
  );
}

