"use client";

import React, { useState, useEffect } from "react";
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
  CheckSquare,
  Check,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { useSebetStore } from "@/lib/store";
import { optimizeBasket, searchProducts } from "@/lib/api";
import { BasketOptimizationResponse, BasketItem, Product } from "@/lib/types";
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

const AVAILABLE_CHAINS = [
  { slug: "bravo", name: "Bravo", color: "#74b826" },
  { slug: "araz", name: "Araz", color: "#E30613" },
  { slug: "oba", name: "OBA", color: "#009640" },
  { slug: "bazarstore", name: "Bazarstore", color: "#D01026" },
  { slug: "almarket", name: "Al Market", color: "#E31E24" },
  { slug: "neptun", name: "Neptun", color: "#f37021" },
  { slug: "spar", name: "Spar", color: "#007A3D" },
];

function getProductPriceForChain(
  product: Product,
  chainSlug: string
): { price: number; isPromo: boolean; isEstimated: boolean } {
  const match = product.prices?.find(
    (p) => p.chain_slug?.toLowerCase() === chainSlug.toLowerCase()
  );
  if (match) {
    const effectivePrice =
      match.is_promo && match.promo_price ? match.promo_price : match.price;
    return {
      price: effectivePrice,
      isPromo: match.is_promo,
      isEstimated: false,
    };
  }
  const fallback =
    product.min_price || product.prices?.[0]?.price || 1.99;
  return { price: fallback, isPromo: false, isEstimated: true };
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
    checklistSelectedMarket,
    toggleChecklistItem,
    checkAllItems,
    uncheckAllItems,
    setChecklistMarket,
  } = useSebetStore();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"optimizer" | "checklist">("optimizer");
  const [checklistFilter, setChecklistFilter] = useState<"all" | "remaining" | "obtained">("all");
  const [walkingRadius, setWalkingRadius] = useState<number>(600);
  const [optimizationMode, setOptimizationMode] = useState<"single" | "multi">("single");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] =
    useState<BasketOptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Preset Family Basket
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
    } catch (err: any) {
      setError(err.message || "Optimizasiya zamanı xəta baş verdi.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Auto-run optimizer if basket items change
  useEffect(() => {
    if (basket.length > 0 && isMounted) {
      handleRunOptimizer();
    } else {
      setOptimizationResult(null);
    }
  }, [basket.length, walkingRadius, selectedLocation.name]);

  if (!isMounted) return null;

  const totalItemsCount = basket.reduce((acc, it) => acc + it.quantity, 0);

  // In-Store Checklist Calculations for current selected market
  const currentChainInfo =
    AVAILABLE_CHAINS.find((c) => c.slug === checklistSelectedMarket) ||
    AVAILABLE_CHAINS[0];

  const obtainedItems = basket.filter((it) =>
    checklistCheckedIds.includes(it.product.id)
  );
  const remainingItems = basket.filter(
    (it) => !checklistCheckedIds.includes(it.product.id)
  );

  const obtainedTotal = obtainedItems.reduce((sum, it) => {
    const pInfo = getProductPriceForChain(it.product, checklistSelectedMarket);
    return sum + pInfo.price * it.quantity;
  }, 0);

  const remainingTotal = remainingItems.reduce((sum, it) => {
    const pInfo = getProductPriceForChain(it.product, checklistSelectedMarket);
    return sum + pInfo.price * it.quantity;
  }, 0);

  const totalMarketCost = obtainedTotal + remainingTotal;
  const progressPercent =
    basket.length > 0
      ? Math.round((obtainedItems.length / basket.length) * 100)
      : 0;

  // Filtered list for checklist view
  const visibleChecklistItems =
    checklistFilter === "all"
      ? basket
      : checklistFilter === "remaining"
      ? remainingItems
      : obtainedItems;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Ağıllı Səbət</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50">
              Sebet
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Qiymət müqayisəsi və mağazada canlı alış-veriş rejimi
          </p>
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

      {/* Mode Switcher Tabs */}
      {basket.length > 0 && (
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
          <button
            onClick={() => setActiveTab("optimizer")}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "optimizer"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Səbət & Optimizasiya</span>
          </button>

          <button
            onClick={() => setActiveTab("checklist")}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "checklist"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Mağazada Canlı Rejim</span>
            {checklistCheckedIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/25 text-white font-mono">
                {checklistCheckedIds.length}/{basket.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Empty State with 1-Click Preset */}
      {basket.length === 0 ? (
        <div className="p-6 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
              Səbətiniz hələlik boşdur
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
              Ərzaqlarınızı əlavə edin və ya dərhal test etmək üçün hazır Bakı ailə səbətini yükləyin.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2 max-w-xs mx-auto">
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
      ) : activeTab === "checklist" ? (
        /* ================= IN-STORE SHOPPING CHECKLIST VIEW ================= */
        <div className="space-y-4">
          {/* Market Selection Banner */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <StoreIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Hansı Marketdəsiniz?</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Aktiv: <strong className="text-slate-900 dark:text-slate-100">{currentChainInfo.name}</strong>
              </span>
            </div>

            {/* Horizontal Chain Picker */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {AVAILABLE_CHAINS.map((chain) => {
                const isSelected = checklistSelectedMarket === chain.slug;
                return (
                  <button
                    key={chain.slug}
                    onClick={() => setChecklistMarket(chain.slug)}
                    className={`flex items-center gap-2 py-2 px-3 rounded-2xl border transition-all shrink-0 active:scale-95 ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80"
                    }`}
                  >
                    <ChainLogo slug={chain.slug} size="xs" />
                    <span className="text-xs font-extrabold whitespace-nowrap">
                      {chain.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live In-Store Price & Progress Dashboard */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 text-white shadow-xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Obtained / Got Price */}
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Səbətdə (Götürülüb)</span>
                  </span>
                  <span>{obtainedItems.length} məhsul</span>
                </div>
                <div className="text-2xl font-black text-white">
                  {obtainedTotal.toFixed(2)} ₼
                </div>
                <p className="text-[10px] text-emerald-200/80">
                  Hazırda arabanızdakı məbləğ
                </p>
              </div>

              {/* Remaining Price */}
              <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                  <span>Qalan (Axtarılır)</span>
                  <span>{remainingItems.length} məhsul</span>
                </div>
                <div className="text-2xl font-black text-slate-200">
                  {remainingTotal.toFixed(2)} ₼
                </div>
                <p className="text-[10px] text-slate-300/80">
                  Rəfdə hələ tapılmalı olanlar
                </p>
              </div>
            </div>

            {/* Total Market Estimate & Progress Bar */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <ChainLogo slug={checklistSelectedMarket} size="xs" />
                  <span>{currentChainInfo.name} Kassada Yekun:</span>
                </span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {totalMarketCost.toFixed(2)} ₼
                </span>
              </div>

              {/* Visual Progress Track */}
              <div className="w-full bg-white/15 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
                <span>
                  {obtainedItems.length} / {basket.length} növ məhsul götürülüb
                </span>
                <span className="font-bold text-emerald-300">{progressPercent}%</span>
              </div>

              {/* Completion Banner */}
              {basket.length > 0 && obtainedItems.length === basket.length && (
                <div className="p-2.5 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    🎉 Əla! Siyahınızdakı bütün məhsullar götürüldü. Kassaya yaxınlaşa bilərsiniz!
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Checklist Controls: Filters & Mass Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { id: "all", label: `Hamısı (${basket.length})` },
                { id: "remaining", label: `Qalanlar (${remainingItems.length})` },
                { id: "obtained", label: `Götürülüb (${obtainedItems.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setChecklistFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                    checklistFilter === f.id
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Mass check / uncheck */}
            <div className="flex items-center gap-1">
              {obtainedItems.length < basket.length ? (
                <button
                  onClick={checkAllItems}
                  className="px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-300 transition-all flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>Hamısını seç</span>
                </button>
              ) : (
                <button
                  onClick={uncheckAllItems}
                  className="px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-300 transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sıfırla</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Checklist Items */}
          <div className="space-y-2">
            {visibleChecklistItems.map((item) => {
              const isChecked = checklistCheckedIds.includes(item.product.id);
              const priceInfo = getProductPriceForChain(
                item.product,
                checklistSelectedMarket
              );
              const lineTotal = priceInfo.price * item.quantity;

              return (
                <div
                  key={item.product.id}
                  onClick={() => toggleChecklistItem(item.product.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                    isChecked
                      ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 opacity-85"
                      : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-emerald-300"
                  }`}
                >
                  {/* Checkbox & Product Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Big Custom Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 transition-all border ${
                        isChecked
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent"
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>

                    {/* Image */}
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.canonical_name}
                        className="w-11 h-11 rounded-xl object-cover bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shrink-0"
                      />
                    )}

                    {/* Texts */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.product.brand && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {item.product.brand}
                          </span>
                        )}
                        {priceInfo.isPromo && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
                            Endirim
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-xs font-bold truncate ${
                          isChecked
                            ? "line-through text-slate-400 dark:text-slate-500"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {item.product.canonical_name}
                      </h4>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="font-semibold">
                          {item.quantity} ədəd × {priceInfo.price.toFixed(2)} ₼
                        </span>
                        {priceInfo.isEstimated && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400">
                            (rəf qiyməti)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line Total & Quantity Controls */}
                  <div
                    className="text-right shrink-0 flex flex-col items-end gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`text-sm font-black ${
                        isChecked
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {lineTotal.toFixed(2)} ₼
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-5 h-5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="text-xs font-bold px-1 text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Return to Catalog / Add Items */}
          <div className="pt-2 flex items-center justify-between">
            <Link
              href="/"
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Siyahıya daha çox məhsul əlavə et</span>
            </Link>

            <button
              onClick={() => setActiveTab("optimizer")}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-bold flex items-center gap-1"
            >
              <span>Optimizasiyaya qayıt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ================= OPTIMIZER & BASKET OVERVIEW ================= */
        <>
          {/* Walking Radius & Location Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Ünvan: {selectedLocation.name}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Gəzinti radiusu: {walkingRadius}m
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="200"
                max="1200"
                step="100"
                value={walkingRadius}
                onChange={(e) => setWalkingRadius(Number(e.target.value))}
                className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold px-0.5">
                <span>300m (Qonşu market)</span>
                <span>600m (Standard piyada)</span>
                <span>1000m (Geniş axtarış)</span>
              </div>
            </div>
          </div>

          {/* Optimizer Result Card */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isOptimizing ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Bakı marketlərinin qiymətləri müqayisə edilir...
              </div>
            </div>
          ) : optimizationResult ? (
            <div className="space-y-4">
              {/* Strategy Selector: Single Place vs Multiple Places */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">
                    Alış-veriş Strategiyasını Seçin:
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {optimizationMode === "single" ? "Tək Market seçilib" : "Çoxlu Market seçilib"}
                  </span>
                </div>

                <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 shadow-2xs gap-1.5">
                  <button
                    onClick={() => setOptimizationMode("single")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center text-center gap-1 ${
                      optimizationMode === "single"
                        ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-500/30 ring-1 ring-emerald-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black">
                      <StoreIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Tək Market (Bir Məkan)</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      Bütün səbət 1 marketdən • Vaxta qənaət
                    </span>
                  </button>

                  <button
                    onClick={() => setOptimizationMode("multi")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center text-center gap-1 ${
                      optimizationMode === "multi"
                        ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Çoxlu Market (Split)</span>
                    </div>
                    <span className={`text-[10px] font-medium ${optimizationMode === "multi" ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
                      2 market arasında bölüşdürmə • Maksimum qənaət
                    </span>
                  </button>
                </div>
              </div>

              {/* MODE 1: MULTIPLE PLACES (SPLIT BASKET) */}
              {optimizationMode === "multi" && (
                <div className="space-y-4">
                  {optimizationResult.best_split_store &&
                  optimizationResult.best_split_store.savings_vs_single_azn > 0.1 ? (
                    <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                          Maksimum Qənaət Təklifi (2 Market)
                        </span>
                        <span className="text-xs font-bold text-emerald-100 flex items-center gap-1">
                          <Footprints className="w-3.5 h-3.5" />
                          {optimizationResult.best_split_store.distance_between_stores_m}m məsafə
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-2xl font-black tracking-tight">
                          Qənaət: {optimizationResult.best_split_store.savings_vs_single_azn.toFixed(2)} AZN
                          <span className="text-sm font-normal text-emerald-200 ml-2">
                            (-{optimizationResult.best_split_store.savings_percent}%)
                          </span>
                        </div>
                        <p className="text-xs text-emerald-100">
                          Səbəti bir-birinə yaxın 2 market arasında bölüşdürərək ən aşağı qiyməti əldə edin:
                        </p>
                      </div>

                      {/* Split stores breakdown */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Store 1 */}
                        <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-emerald-200">
                              1-ci Dayanacaq
                            </span>
                            <ChainLogo slug={getChainSlug(optimizationResult.best_split_store.store_1.branch_name)} size="xs" />
                          </div>
                          <div className="font-extrabold text-xs truncate">
                            {optimizationResult.best_split_store.store_1.branch_name}
                          </div>
                          <div className="text-emerald-300 text-xs font-black">
                            {optimizationResult.best_split_store.store_1.subtotal.toFixed(2)} ₼
                          </div>
                          <div className="text-[10px] text-emerald-200/90">
                            {optimizationResult.best_split_store.store_1.items.length} məhsul
                          </div>

                          <button
                            onClick={() => {
                              setChecklistMarket(getChainSlug(optimizationResult.best_split_store!.store_1.branch_name));
                              setActiveTab("checklist");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="w-full py-1.5 px-2 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1 mt-1 active:scale-95"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Canlı Siyahı</span>
                          </button>
                        </div>

                        {/* Store 2 */}
                        <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-emerald-200">
                              2-ci Dayanacaq
                            </span>
                            <ChainLogo slug={getChainSlug(optimizationResult.best_split_store.store_2.branch_name)} size="xs" />
                          </div>
                          <div className="font-extrabold text-xs truncate">
                            {optimizationResult.best_split_store.store_2.branch_name}
                          </div>
                          <div className="text-emerald-300 text-xs font-black">
                            {optimizationResult.best_split_store.store_2.subtotal.toFixed(2)} ₼
                          </div>
                          <div className="text-[10px] text-emerald-200/90">
                            {optimizationResult.best_split_store.store_2.items.length} məhsul
                          </div>

                          <button
                            onClick={() => {
                              setChecklistMarket(getChainSlug(optimizationResult.best_split_store!.store_2.branch_name));
                              setActiveTab("checklist");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="w-full py-1.5 px-2 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1 mt-1 active:scale-95"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Canlı Siyahı</span>
                          </button>
                        </div>
                      </div>

                      {/* Total Split Price */}
                      <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs font-bold">
                        <span>İkiqat Səfər Ümumi Cəmi:</span>
                        <span className="text-base font-black">
                          {optimizationResult.best_split_store.total_cost.toFixed(2)} ₼
                        </span>
                      </div>

                      {/* Google Maps Directions between Split Stores */}
                      <div className="pt-1">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                            optimizationResult.best_split_store.store_1.branch_name + ", Baku"
                          )}&destination=${encodeURIComponent(
                            optimizationResult.best_split_store.store_2.branch_name + ", Baku"
                          )}&travelmode=walking`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"
                        >
                          <Navigation className="w-3.5 h-3.5 text-amber-300" />
                          <span>Google Maps-də Marşrutu Aç (2 Market Arası)</span>
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                      <StoreIcon className="w-8 h-8 text-slate-400 mx-auto" />
                      <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                        Cari radiusda tək marketdən almaq daha sərfəlidir
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Seçilmiş {walkingRadius}m radiusda 2 market arasında bölüşdürmə əhəmiyyətli dərəcədə əlavə qənaət vermir. Bir marketdən rahat alış-veriş edə bilərsiniz.
                      </p>
                      <button
                        onClick={() => setOptimizationMode("single")}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs active:scale-95"
                      >
                        Tək Market Rejiminə Bax
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: SINGLE PLACE (1 STOP BEST STORE) */}
              {optimizationMode === "single" && optimizationResult.best_single_store && (
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-600 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase">
                      Tək Marketdə Ən Ucuz (1 Dayanacaq)
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {optimizationResult.best_single_store.distance_km} km məsafədə
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChainLogo slug={getChainSlug(optimizationResult.best_single_store.branch_name)} size="sm" />
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {optimizationResult.best_single_store.branch_name}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {optimizationResult.best_single_store.address}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                        {optimizationResult.best_single_store.total_cost.toFixed(2)} ₼
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                        {optimizationResult.best_single_store.coverage_pct}% tapıldı
                      </span>
                    </div>
                  </div>

                  {/* Actions: Start Checklist Mode or Google Maps */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setChecklistMarket(getChainSlug(optimizationResult.best_single_store!.branch_name));
                        setActiveTab("checklist");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Bu Marketdə Alış-veriş</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${selectedLocation.lat},${selectedLocation.lon}&destination=${encodeURIComponent(
                        optimizationResult.best_single_store.branch_name + ", " + optimizationResult.best_single_store.address + ", Baku"
                      )}&travelmode=walking`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Xəritədə Marşrut</span>
                    </a>
                  </div>
                </div>
              )}

              {/* All Single Stores Ranking Table (for Single Store mode) */}
              {optimizationMode === "single" && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Bütün Yaxın Filiallar Üzrə Müqayisə
                  </h4>
                  <div className="space-y-1.5">
                    {optimizationResult.all_single_stores.map((st, index) => {
                      const storeSlug = getChainSlug(st.branch_name);
                      return (
                        <div
                          key={st.store_id}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
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
                                {st.neighborhood} • {st.distance_km} km
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="font-black text-slate-900 dark:text-slate-100">
                                {st.total_cost.toFixed(2)} ₼
                              </div>
                              <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                                {st.coverage_pct}% stokda
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setChecklistMarket(storeSlug);
                                setActiveTab("checklist");
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              title="Bu marketdə canlı yoxlama siyahısını aç"
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1 transition-colors"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>Seç</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Current Basket Items List & Quantity Adjustments */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Səbətdəki Məhsullar ({totalItemsCount})
              </h4>
              <button
                onClick={() => setActiveTab("checklist")}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Mağazada Canlı Rejimə Keç</span>
              </button>
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
                        className="w-10 h-10 rounded-xl object-cover bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0"
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
                        className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black px-1 text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs"
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
        </>
      )}
    </div>
  );
}
