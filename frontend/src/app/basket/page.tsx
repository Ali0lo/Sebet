"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  MapPin,
  Footprints,
  TrendingDown,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Store as StoreIcon,
  Navigation,
} from "lucide-react";
import { useSebEtStore } from "@/lib/store";
import { optimizeBasket, searchProducts } from "@/lib/api";
import { BasketOptimizationResponse, BasketItem } from "@/lib/types";
import { ChainLogo } from "@/components/ChainLogo";

function getChainSlug(name?: string | null): string {
  const n = (name || "").toLowerCase();
  if (n.includes("bravo")) return "bravo";
  if (n.includes("araz")) return "araz";
  if (n.includes("oba")) return "oba";
  if (n.includes("bazarstore")) return "bazarstore";
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
  } = useSebEtStore();

  const [isMounted, setIsMounted] = useState(false);
  const [walkingRadius, setWalkingRadius] = useState<number>(600);
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

  // Auto-run optimizer if basket items change and we had already run it
  useEffect(() => {
    if (basket.length > 0 && isMounted) {
      handleRunOptimizer();
    } else {
      setOptimizationResult(null);
    }
  }, [basket.length, walkingRadius, selectedLocation.name]);

  if (!isMounted) return null;

  const totalItemsCount = basket.reduce((acc, it) => acc + it.quantity, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Ağıllı Səbət</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50">
              Optimizator
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bakı marketləri arasında ən ucuz kombinasiyanı tapır
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
      ) : (
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

          {isOptimizing && (
            <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 animate-pulse">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Bakı supermarketləri üzrə qiymətlər hesablanır...
              </p>
            </div>
          )}

          {optimizationResult && !isOptimizing && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              {/* Dual-Store Split Savings Card (Hero) */}
              {optimizationResult.best_split_store &&
              optimizationResult.best_split_store.savings_vs_single_azn > 0 ? (
                <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-700/20 space-y-3.5 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      Ağıllı Bölünmə Fürsəti
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
                    </div>
                  </div>

                  {/* Total Split Price */}
                  <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs font-bold">
                    <span>İkiqat Səfər Ümumi Cəmi:</span>
                    <span className="text-base font-black">
                      {optimizationResult.best_split_store.total_cost.toFixed(2)} ₼
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Single Store Best Option Card */}
              {optimizationResult.best_single_store && (
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-600 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase">
                      Tək Marketdə Ən Ucuz
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
                </div>
              )}

              {/* Itemized Split Checklist (Which items at which store) */}
              {optimizationResult.best_split_store && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Bölünmüş Alış-veriş Siyahısı
                  </h4>

                  {/* Checklist Store 1 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ChainLogo slug={getChainSlug(optimizationResult.best_split_store.store_1.branch_name)} size="xs" />
                        {optimizationResult.best_split_store.store_1.branch_name}
                      </span>
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {optimizationResult.best_split_store.store_1.subtotal.toFixed(2)} ₼
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {optimizationResult.best_split_store.store_1.items.map((it) => (
                        <div
                          key={it.product_id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-700 dark:text-slate-300 truncate pr-2">
                            • {it.product_name} ({it.quantity} ədəd)
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                            {it.total_price.toFixed(2)} ₼
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Checklist Store 2 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ChainLogo slug={getChainSlug(optimizationResult.best_split_store.store_2.branch_name)} size="xs" />
                        {optimizationResult.best_split_store.store_2.branch_name}
                      </span>
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {optimizationResult.best_split_store.store_2.subtotal.toFixed(2)} ₼
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {optimizationResult.best_split_store.store_2.items.map((it) => (
                        <div
                          key={it.product_id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-700 dark:text-slate-300 truncate pr-2">
                            • {it.product_name} ({it.quantity} ədəd)
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                            {it.total_price.toFixed(2)} ₼
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* All Single Stores Ranking Table */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bütün Yaxın Filiallar Üzrə Müqayisə
                </h4>
                <div className="space-y-1.5">
                  {optimizationResult.all_single_stores.map((st, index) => (
                    <div
                      key={st.store_id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-black text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px]">
                          #{index + 1}
                        </span>
                        <ChainLogo slug={getChainSlug(st.branch_name)} size="xs" />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {st.branch_name}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {st.neighborhood} • {st.distance_km} km
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-slate-900 dark:text-slate-100">
                          {st.total_cost.toFixed(2)} ₼
                        </div>
                        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {st.coverage_pct}% stokda
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Current Basket Items List & Quantity Adjustments */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Səbətdəki Məhsullar ({totalItemsCount})
            </h4>

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

