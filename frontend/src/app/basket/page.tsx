"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  MapPin,
  Footprints,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Store as StoreIcon,
  Navigation,
  ExternalLink,
  Check,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Info,
} from "lucide-react";
import { useSebetStore } from "@/lib/store";
import { optimizeBasket, searchProducts } from "@/lib/api";
import {
  BasketOptimizationResponse,
  BasketItem,
  Product,
  SplitStoreInfo,
  SingleStoreResult,
} from "@/lib/types";
import { ChainLogo } from "@/components/ChainLogo";

function getChainSlug(name?: string | null): string {
  const n = (name || "").toLowerCase();
  if (n.includes("bravo")) return "bravo";
  if (n.includes("araz")) return "araz";
  if (n.includes("oba")) return "oba";
  if (n.includes("bazarstore")) return "bazarstore";
  if (n.includes("almarket") || n.includes("al market")) return "almarket";
  if (n.includes("neptun")) return "neptun";
  if (n.includes("spar")) return "spar";
  return "bravo";
}

export default function BasketPage() {
  const {
    basket,
    selectedLocation,
    updateQuantity,
    removeFromBasket,
    clearBasket,
    setBasket,
    checklistCheckedIds,
    toggleChecklistItem,
    checkAllItems,
    uncheckAllItems,
  } = useSebetStore();

  const [isMounted, setIsMounted] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<"single" | "multi">("single");
  const [walkingRadius, setWalkingRadius] = useState<number>(750);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] =
    useState<BasketOptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Map product id -> product details for fast lookup of image, brand, etc.
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    basket.forEach((item) => {
      map.set(item.product.id, item.product);
    });
    return map;
  }, [basket]);

  // Preset Family Basket loader
  const loadFamilyPreset = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      const res = await searchProducts("", undefined, undefined, 1, 30);
      const staples = [
        "Milla Süd",
        "Westgold Kərə Yağı",
        "Ariel Dağ Təravəti",
        "Azərçay Buket",
        "Bizim Süfrə Klassik",
        "Sirab Mineral Qazsız",
        "Giləzi Kənd Yumurtası",
      ];

      const presetItems: BasketItem[] = [];
      staples.forEach((title) => {
        const found = res.items.find((p) =>
          p.canonical_name.toLowerCase().includes(title.toLowerCase())
        );
        if (found) {
          presetItems.push({ product: found, quantity: 1 });
        }
      });

      if (presetItems.length > 0) {
        setBasket(presetItems);
      }
    } catch (e: any) {
      console.error("Failed to load preset", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Run optimizer with standard 750m walking radius
  const handleRunOptimizer = async () => {
    if (basket.length === 0) return;
    setIsOptimizing(true);
    setError(null);

    try {
      const itemsPayload = basket.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      const res = await optimizeBasket(
        itemsPayload,
        selectedLocation.lat,
        selectedLocation.lon,
        walkingRadius
      );
      setOptimizationResult(res);

      // Default to multi-market if viable, else single market
      if (res.is_split_viable) {
        setOptimizationMode("multi");
      } else {
        setOptimizationMode("single");
      }
    } catch (err: any) {
      setError(err.message || "Optimizasiya zamanı xəta baş verdi.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Re-run optimizer whenever items or quantities in basket change or walking radius / location changes
  const basketSignature = useMemo(
    () => basket.map((i) => `${i.product.id}:${i.quantity}`).join("|"),
    [basket]
  );

  useEffect(() => {
    if (basket.length > 0 && isMounted) {
      handleRunOptimizer();
    } else {
      setOptimizationResult(null);
    }
  }, [basketSignature, selectedLocation.name, walkingRadius, isMounted]);

  if (!isMounted) return null;

  const totalItemsCount = basket.reduce((acc, it) => acc + it.quantity, 0);
  const allProductIds = basket.map((b) => b.product.id);
  const checkedCount = allProductIds.filter((id) =>
    checklistCheckedIds.includes(id)
  ).length;
  const isAllChecked = basket.length > 0 && checkedCount === basket.length;
  const progressPercent =
    basket.length > 0 ? Math.round((checkedCount / basket.length) * 100) : 0;

  const bestSingle = optimizationResult?.best_single_store;
  const bestSplit = optimizationResult?.best_split_store;
  const isSplitViable = !!optimizationResult?.is_split_viable;

  const primaryStore: SplitStoreInfo | undefined =
    bestSplit?.primary_store || bestSplit?.store_1;
  const secondaryStore: SplitStoreInfo | undefined =
    bestSplit?.secondary_store || bestSplit?.store_2;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Ağıllı Səbət</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50">
              Sebet
            </span>
          </h1>
        </div>

        {basket.length > 0 && (
          <button
            onClick={clearBasket}
            className="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Təmizlə</span>
          </button>
        )}
      </div>

      {/* Location & Walking Radius Control */}
      <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium min-w-0">
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">
              Ünvan: <strong className="font-bold text-slate-900 dark:text-slate-100">{selectedLocation.name}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/50">
            <Footprints className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{walkingRadius}m</span>
          </div>
        </div>

        {/* Radius Quick Presets & Slider */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-500 dark:text-slate-400">
              Maksimum gəzinti radiusu:
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {walkingRadius} metr
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "500m", value: 500, desc: "Yaxın" },
              { label: "750m", value: 750, desc: "Standart" },
              { label: "1000m", value: 1000, desc: "Geniş" },
              { label: "1500m", value: 1500, desc: "Uzaq" },
            ].map((p) => {
              const active = walkingRadius === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setWalkingRadius(p.value)}
                  className={`py-1.5 px-2 rounded-xl text-center transition-all ${
                    active
                      ? "bg-emerald-600 text-white shadow-xs font-black ring-1 ring-emerald-600"
                      : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                  }`}
                >
                  <div className="text-xs">{p.label}</div>
                  <div
                    className={`text-[9px] ${
                      active ? "text-emerald-100" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Smooth Slider */}
          <div className="pt-0.5">
            <input
              type="range"
              min="300"
              max="2000"
              step="50"
              value={walkingRadius}
              onChange={(e) => setWalkingRadius(Number(e.target.value))}
              className="w-full accent-emerald-600 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium px-0.5 mt-0.5">
              <span>300m</span>
              <span>750m</span>
              <span>1200m</span>
              <span>2000m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State with 1-Click Preset */}
      {basket.length === 0 ? (
        <div className="p-8 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              Səbətim hələlik boşdur
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Ərzaqlarınızı əlavə edin və ya dərhal test etmək üçün hazır Bakı ailə səbətini yükləyin.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
            <button
              onClick={loadFamilyPreset}
              disabled={isOptimizing}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Hazır Bakı Həftəlik Səbətini Yüklə (7 Məhsul)</span>
            </button>

            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
            >
              Məhsul kataloquna qayıt
            </Link>
          </div>
        </div>
      ) : (
        /* ================= OPTIMIZED BASKET CONTENT ================= */
        <div className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isOptimizing ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Bakı marketlərinin qiymətləri müqayisə edilir...
              </div>
            </div>
          ) : optimizationResult ? (
            <>
              {/* TOP CHOICE CARDS: Tək Market (Sürətli) VS 2 Marketə Böl (Maksimum Qənaət) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CARD 1: Tək Market (Sürətli) */}
                {bestSingle && (
                  <button
                    type="button"
                    onClick={() => setOptimizationMode("single")}
                    className={`text-left p-4 rounded-3xl transition-all relative flex flex-col justify-between select-none ${
                      optimizationMode === "single"
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-600 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Tək Market (Sürətli)
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {bestSingle.distance_km} km
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <ChainLogo
                          slug={bestSingle.chain_slug || getChainSlug(bestSingle.branch_name)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {bestSingle.branch_name}
                          </h4>
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {bestSingle.items.length} məhsul ({bestSingle.coverage_pct}% stokda)
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        Bütün məhsulları bir yerdən alın, vaxta qənaət edin.
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Cəmi Məbləğ:
                      </span>
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {bestSingle.total_cost.toFixed(2)} ₼
                      </span>
                    </div>
                  </button>
                )}

                {/* CARD 2: 2 Marketə Böl (Maksimum Qənaət) */}
                {isSplitViable && bestSplit && primaryStore && secondaryStore ? (
                  <button
                    type="button"
                    onClick={() => setOptimizationMode("multi")}
                    className={`text-left p-4 rounded-3xl transition-all relative flex flex-col justify-between select-none ${
                      optimizationMode === "multi"
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-600 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          2 Marketə Böl
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[11px] shadow-xs">
                          {bestSplit.savings_azn.toFixed(2)} ₼ Qənaət
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5 items-center">
                          <ChainLogo
                            slug={primaryStore.chain_slug || getChainSlug(primaryStore.branch_name)}
                            size="xs"
                          />
                          <ChainLogo
                            slug={secondaryStore.chain_slug || getChainSlug(secondaryStore.branch_name)}
                            size="xs"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {primaryStore.chain_name} + {secondaryStore.chain_name}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {primaryStore.items.length} məhsul + {secondaryStore.items.length} məhsul
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Footprints className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Aralarındakı məsafə: ~{bestSplit.walking_distance_meters || bestSplit.distance_between_stores_m}m</span>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Bölünmüş Cəm:
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {bestSplit.total_cost.toFixed(2)} ₼
                        </span>
                      </div>
                    </div>
                  </button>
                ) : (
                  /* Disabled/Muted Card 2 when split is not viable */
                  <div className="p-4 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-left flex flex-col justify-between opacity-75 select-none">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          2 Marketə Böl
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Tövsiyə edilmir
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          Bu səbət üçün 2 marketə getməyə dəyməz (qənaət 1.50 ₼-dən azdır).
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 gap-2 flex-wrap">
                      <span>Tək marketdən almaq daha rahatdır.</span>
                      {walkingRadius < 1500 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWalkingRadius(walkingRadius < 750 ? 750 : walkingRadius < 1000 ? 1000 : 1500);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-colors flex items-center gap-1"
                        >
                          <Footprints className="w-3 h-3" />
                          <span>Radiusu artır ({walkingRadius < 750 ? "750m" : walkingRadius < 1000 ? "1000m" : "1500m"})</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CHECKLIST PROGRESS & ACTIONS BAR */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Mağazada Götürülənlər: {checkedCount} / {basket.length}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={checkAllItems}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Hamısını seç
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      onClick={uncheckAllItems}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Sıfırla
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* ================================================================ */}
              {/* MODE A: 2 MARKET CHECKLISTS (SPLIT MODE)                         */}
              {/* ================================================================ */}
              {optimizationMode === "multi" && bestSplit && primaryStore && secondaryStore && (
                <div className="space-y-4">
                  {/* Store 1 Checklist */}
                  <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          1
                        </span>
                        <ChainLogo
                          slug={primaryStore.chain_slug || getChainSlug(primaryStore.branch_name)}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {primaryStore.branch_name}-dan alınacaqlar
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {primaryStore.items.length} ədəd —{" "}
                            <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                              {primaryStore.subtotal.toFixed(2)} ₼
                            </strong>
                          </p>
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${selectedLocation.lat},${selectedLocation.lon}&destination=${encodeURIComponent(
                          primaryStore.branch_name + ", " + primaryStore.address + ", Baku"
                        )}&travelmode=walking`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Xəritə</span>
                      </a>
                    </div>

                    {/* Items for Store 1 */}
                    <div className="space-y-2 pt-1">
                      {primaryStore.items.map((item) => {
                        const isChecked = checklistCheckedIds.includes(String(item.product_id));
                        const product = productMap.get(String(item.product_id));

                        return (
                          <div
                            key={String(item.product_id)}
                            onClick={() => toggleChecklistItem(String(item.product_id))}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                              isChecked
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 opacity-80"
                                : "bg-slate-50/70 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Custom Checkbox */}
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              {/* Thumbnail */}
                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-xl object-contain p-0.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 mix-blend-multiply dark:mix-blend-normal"
                                />
                              )}

                              <div className="min-w-0">
                                <h4
                                  className={`text-xs font-bold truncate ${
                                    isChecked
                                      ? "line-through text-slate-400 dark:text-slate-500"
                                      : "text-slate-900 dark:text-slate-100"
                                  }`}
                                >
                                  {item.product_name}
                                </h4>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {item.quantity} ədəd × {item.unit_price.toFixed(2)} ₼
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`text-xs font-black ${
                                  isChecked
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-slate-900 dark:text-slate-100"
                                }`}
                              >
                                {item.total_price.toFixed(2)} ₼
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inter-Store Walking Route Connection Banner */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <Footprints className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Marketlər arası piyada: ~{bestSplit.walking_distance_meters || bestSplit.distance_between_stores_m}m
                      </span>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                        primaryStore.branch_name + ", Baku"
                      )}&destination=${encodeURIComponent(
                        secondaryStore.branch_name + ", Baku"
                      )}&travelmode=walking`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 active:scale-95"
                    >
                      <Navigation className="w-3.5 h-3.5 text-amber-300" />
                      <span>2 Market Arası Marşrut</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  </div>

                  {/* Store 2 Checklist */}
                  <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          2
                        </span>
                        <ChainLogo
                          slug={secondaryStore.chain_slug || getChainSlug(secondaryStore.branch_name)}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {secondaryStore.branch_name}-dən alınacaqlar
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {secondaryStore.items.length} ədəd —{" "}
                            <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                              {secondaryStore.subtotal.toFixed(2)} ₼
                            </strong>
                          </p>
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${primaryStore.latitude},${primaryStore.longitude}&destination=${encodeURIComponent(
                          secondaryStore.branch_name + ", " + secondaryStore.address + ", Baku"
                        )}&travelmode=walking`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Xəritə</span>
                      </a>
                    </div>

                    {/* Items for Store 2 */}
                    <div className="space-y-2 pt-1">
                      {secondaryStore.items.map((item) => {
                        const isChecked = checklistCheckedIds.includes(String(item.product_id));
                        const product = productMap.get(String(item.product_id));

                        return (
                          <div
                            key={String(item.product_id)}
                            onClick={() => toggleChecklistItem(String(item.product_id))}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                              isChecked
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 opacity-80"
                                : "bg-slate-50/70 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Custom Checkbox */}
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              {/* Thumbnail */}
                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-xl object-contain p-0.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 mix-blend-multiply dark:mix-blend-normal"
                                />
                              )}

                              <div className="min-w-0">
                                <h4
                                  className={`text-xs font-bold truncate ${
                                    isChecked
                                      ? "line-through text-slate-400 dark:text-slate-500"
                                      : "text-slate-900 dark:text-slate-100"
                                  }`}
                                >
                                  {item.product_name}
                                </h4>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {item.quantity} ədəd × {item.unit_price.toFixed(2)} ₼
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`text-xs font-black ${
                                  isChecked
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-slate-900 dark:text-slate-100"
                                }`}
                              >
                                {item.total_price.toFixed(2)} ₼
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Split Summary Footer */}
                  <div className="p-4 rounded-3xl bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between shadow-lg">
                    <div>
                      <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                        Ümumi 2-li Səfər Məbləği
                      </div>
                      <div className="text-xl font-black">
                        {bestSplit.total_cost.toFixed(2)} ₼
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400">Xalis Qənaət:</span>
                      <div className="text-base font-black text-emerald-400">
                        +{bestSplit.savings_azn.toFixed(2)} AZN (-{bestSplit.savings_percent}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* MODE B: SINGLE STORE CHECKLIST                                    */}
              {/* ================================================================ */}
              {optimizationMode === "single" && bestSingle && (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChainLogo
                          slug={bestSingle.chain_slug || getChainSlug(bestSingle.branch_name)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {bestSingle.branch_name}-dan alınacaqlar
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {bestSingle.items.length} məhsul —{" "}
                            <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                              {bestSingle.total_cost.toFixed(2)} ₼
                            </strong>
                          </p>
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${selectedLocation.lat},${selectedLocation.lon}&destination=${encodeURIComponent(
                          bestSingle.branch_name + ", " + bestSingle.address + ", Baku"
                        )}&travelmode=walking`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Xəritə</span>
                      </a>
                    </div>

                    {/* Items for Single Store */}
                    <div className="space-y-2 pt-1">
                      {bestSingle.items.map((item) => {
                        const isChecked = checklistCheckedIds.includes(String(item.product_id));
                        const product = productMap.get(String(item.product_id));

                        return (
                          <div
                            key={String(item.product_id)}
                            onClick={() => toggleChecklistItem(String(item.product_id))}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                              isChecked
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 opacity-80"
                                : "bg-slate-50/70 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Checkbox */}
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              {/* Thumbnail */}
                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-xl object-contain p-0.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 mix-blend-multiply dark:mix-blend-normal"
                                />
                              )}

                              <div className="min-w-0">
                                <h4
                                  className={`text-xs font-bold truncate ${
                                    isChecked
                                      ? "line-through text-slate-400 dark:text-slate-500"
                                      : "text-slate-900 dark:text-slate-100"
                                  }`}
                                >
                                  {item.product_name}
                                </h4>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {item.quantity} ədəd × {item.unit_price.toFixed(2)} ₼
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`text-xs font-black ${
                                  isChecked
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-slate-900 dark:text-slate-100"
                                }`}
                              >
                                {item.total_price.toFixed(2)} ₼
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* All Single Stores Comparison Table */}
                  {optimizationResult.all_single_stores.length > 1 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Digər Yaxın Filiallar Üzrə Müqayisə
                      </h4>
                      <div className="space-y-1.5">
                        {optimizationResult.all_single_stores.map((st, index) => {
                          const storeSlug = getChainSlug(st.branch_name);
                          const isCurrent = st.store_id === bestSingle.store_id;

                          return (
                            <div
                              key={String(st.store_id)}
                              className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                                isCurrent
                                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-black text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] shrink-0">
                                  #{index + 1}
                                </span>
                                <ChainLogo slug={storeSlug} size="xs" />
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {st.branch_name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {st.distance_km} km məsafə
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-black text-slate-900 dark:text-slate-100">
                                  {st.total_cost.toFixed(2)} ₼
                                </div>
                                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  {st.coverage_pct}% stokda
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}

          {/* SƏBƏTİN İDARƏ EDİLMƏSİ (Basket Items & Quantity Adjusters) */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Səbətdəki Məhsullar ({totalItemsCount} ədəd)
              </h4>

              <Link
                href="/"
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Məhsul əlavə et</span>
              </Link>
            </div>

            <div className="space-y-2">
              {basket.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.canonical_name}
                        className="w-10 h-10 rounded-xl object-contain p-0.5 bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100/80 dark:border-slate-700/60 shrink-0 mix-blend-multiply dark:mix-blend-normal"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {item.product.canonical_name}
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Ən ucuz: {(item.product.min_price || 0).toFixed(2)} ₼
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs hover:bg-slate-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black px-1.5 text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs hover:bg-emerald-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromBasket(item.product.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
