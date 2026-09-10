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
  ArrowLeft,
  ChevronDown,
  Info,
} from "lucide-react";
import { useSebEtStore, BAKU_LOCATIONS } from "@/lib/store";
import { useTranslation } from "@/lib/translations";
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

const GPS_RADIUS_OPTIONS = [
  { label: "1 km", value: 1000, desc: "1000m" },
  { label: "3 km", value: 3000, desc: "3000m" },
  { label: "5 km", value: 5000, desc: "5000m" },
];

export default function BasketPage() {
  const {
    basket,
    selectedLocation,
    setLocation,
    updateQuantity,
    removeFromBasket,
    clearBasket,
    setBasket,
    checklistCheckedIds,
    toggleChecklistItem,
    checkAllItems,
    uncheckAllItems,
  } = useSebEtStore();
  const { t } = useTranslation();

  const [isMounted, setIsMounted] = useState(false);
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [locationMode, setLocationMode] = useState<"gps" | "area">("area");
  const [walkingRadius, setWalkingRadius] = useState<number>(1000);
  const [isLocating, setIsLocating] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<"single" | "multi">("single");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] =
    useState<BasketOptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Exit shopping mode if basket is cleared
  useEffect(() => {
    if (basket.length === 0 && isShoppingMode) {
      setIsShoppingMode(false);
    }
  }, [basket.length, isShoppingMode]);

  // Product map for quick item lookups
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    basket.forEach((item) => {
      map.set(item.product.id, item.product);
    });
    return map;
  }, [basket]);

  // Estimated baseline subtotal for items in basket
  const estimatedBasketTotal = useMemo(() => {
    return basket.reduce((acc, item) => {
      const price = item.product.min_price ?? item.product.prices?.[0]?.price ?? 0;
      return acc + price * item.quantity;
    }, 0);
  }, [basket]);

  // Handle GPS detection
  const handleGetLiveGPS = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            name: "Cari Məkanım (GPS)",
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
          alert("GPS koordinatları alına bilmədi. Zəhmət olmasa siyahıdan ərazi seçin.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

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

  // Run basket optimizer
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

      setOptimizationMode((prev) => {
        if (prev === "multi" && res.best_split_store) return "multi";
        return res.is_split_viable ? "multi" : "single";
      });
    } catch (err: any) {
      setError(err.message || "Optimizasiya zamanı xəta baş verdi.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Trigger optimizer on basket changes, radius or location updates
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

  // Active stores and plan
  const bestSingle = optimizationResult?.best_single_store;
  const bestSplit = optimizationResult?.best_split_store;
  const isSplitViable = !!optimizationResult?.is_split_viable;

  const primaryStore: SplitStoreInfo | undefined =
    bestSplit?.primary_store || bestSplit?.store_1;
  const secondaryStore: SplitStoreInfo | undefined =
    bestSplit?.secondary_store || bestSplit?.store_2;

  const primaryStoreQty =
    primaryStore?.items.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;
  const secondaryStoreQty =
    secondaryStore?.items.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;
  const singleStoreQty =
    bestSingle?.items.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;

  // Active items for the current checklist view
  const activePlanItems =
    optimizationMode === "multi" && bestSplit && primaryStore && secondaryStore
      ? [...primaryStore.items, ...secondaryStore.items]
      : bestSingle?.items || [];

  // Live dynamic calculation strictly based on currently ticked/checked items
  const tickedSubtotal = activePlanItems
    .filter((item) => checklistCheckedIds.includes(String(item.product_id)))
    .reduce((sum, item) => sum + item.unit_price * (item.quantity || 1), 0);

  const tickedCount = activePlanItems.filter((item) =>
    checklistCheckedIds.includes(String(item.product_id))
  ).length;

  const progressPercent =
    activePlanItems.length > 0
      ? Math.round((tickedCount / activePlanItems.length) * 100)
      : 0;

  return (
    <div className="space-y-5 pb-10">
      {/* ========================================================================= */}
      {/* 1. VIEW MODE A: STANDARD BASKET LIST & CONFIGURATION                     */}
      {/* ========================================================================= */}
      {!isShoppingMode ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>{t.basket.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50">
                Sebet
              </span>
            </h1>

            {basket.length > 0 && (
              <button
                onClick={clearBasket}
                className="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Təmizlə</span>
              </button>
            )}
          </div>

          {/* Location & Area Selection Card */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3.5">
            {/* Mode Toggle: Cari Məkan (GPS) vs Ərazi Seçimi */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 gap-1">
              <button
                type="button"
                onClick={() => {
                  setLocationMode("area");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  locationMode === "area"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{t.basket.chooseArea}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocationMode("gps");
                  if (walkingRadius < 1000) setWalkingRadius(1000);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  locationMode === "gps"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{t.basket.currentLocation}</span>
              </button>
            </div>

            {/* Sub-Panel: Ərazi Seçimi (Dropdown) */}
            {locationMode === "area" && (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedLocation.name}
                    onChange={(e) => {
                      const found = BAKU_LOCATIONS.find((loc) => loc.name === e.target.value);
                      if (found) {
                        setLocation(found);
                        setWalkingRadius(1500);
                      }
                    }}
                    className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    {BAKU_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="dark:bg-slate-900">
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Seçilmiş ərazi daxilindəki bütün tərəfdaş supermarketlər avtomatik müqayisə edilir.
                </p>
              </div>
            )}

            {/* Sub-Panel: Cari Məkan (GPS) & Radius Pills */}
            {locationMode === "gps" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGetLiveGPS}
                  disabled={isLocating}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all cursor-pointer"
                >
                  <Navigation className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
                  <span>{isLocating ? "Məkan təyin edilir..." : t.basket.detectGps}</span>
                </button>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span>Cari koordinatlar:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}
                  </span>
                </div>

                {/* Radius Pills: 1 km (1000m), 3 km (3000m), 5 km (5000m) */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      {t.basket.radius}:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {walkingRadius} metr
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {GPS_RADIUS_OPTIONS.map((opt) => {
                      const isSelected = walkingRadius === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setWalkingRadius(opt.value)}
                          className={`py-2 px-2.5 rounded-xl text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white font-black shadow-xs ring-2 ring-emerald-500/20"
                              : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold"
                          }`}
                        >
                          <div className="text-xs">{opt.label}</div>
                          <div
                            className={`text-[9px] ${
                              isSelected ? "text-emerald-100" : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Empty Basket View */}
          {basket.length === 0 ? (
            <div className="p-8 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  {t.basket.emptyBasket}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Məhsullarınızı əlavə edin və ya dərhal test etmək üçün hazır Bakı ailə səbətini yükləyin.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
                <button
                  onClick={loadFamilyPreset}
                  disabled={isOptimizing}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Hazır Bakı Həftəlik Səbətini Yüklə (7 Məhsul)</span>
                </button>

                <Link
                  href="/flyers"
                  className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                >
                  Məhsul kataloquna keç
                </Link>
              </div>
            </div>
          ) : (
            /* Basket Items List (`Səbət məhsulları`) with direct quantity controls & line subtotal */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  {t.basket.itemsListTitle} ({totalItemsCount} {t.basket.itemsCount})
                </h2>

                <Link
                  href="/flyers"
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Məhsul əlavə et</span>
                </Link>
              </div>

              {/* Product Cards List */}
              <div className="space-y-2.5">
                {basket.map((item) => {
                  const unitPrice =
                    item.product.min_price ?? item.product.prices?.[0]?.price ?? 0;
                  const lineTotal = unitPrice * item.quantity;

                  return (
                    <div
                      key={item.product.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.canonical_name}
                            className="w-12 h-12 rounded-xl object-contain p-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 shrink-0 mix-blend-multiply dark:mix-blend-normal"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <StoreIcon className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.product.canonical_name}
                          </h4>
                          {item.product.brand && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                              {item.product.brand}
                            </span>
                          )}
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            {unitPrice.toFixed(2)} ₼ / ədəd
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity Adjusters, Line Subtotal, Trash Button */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                            {lineTotal.toFixed(2)} ₼
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black px-1.5 text-slate-900 dark:text-slate-100">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs hover:bg-emerald-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromBasket(item.product.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Basket Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                    Təxmini İlkin Cəmi:
                  </span>
                  <span className="text-xs text-slate-400">
                    {totalItemsCount} {t.basket.itemsCount}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {estimatedBasketTotal.toFixed(2)} ₼
                  </span>
                </div>
              </div>

              {/* Action CTA Button: "Alış-verişə başla" */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsShoppingMode(true)}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>{t.basket.startShopping}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. VIEW MODE B: INTERACTIVE CHECKLIST SHOPPING MODE                      */
        /* ========================================================================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between pb-1">
            <button
              onClick={() => setIsShoppingMode(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.basket.backToBasket}</span>
            </button>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t.basket.shoppingChecklist}
              </span>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                {selectedLocation.name.split("/")[0].trim()}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isOptimizing ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Bakı marketlərinin qiymətləri müqayisə edilir...
              </div>
            </div>
          ) : optimizationResult ? (
            <>
              {/* TOP CHOICE CARDS: Tək Market vs 2 Marketə Böl */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CARD 1: Tək Market (Sürətli) */}
                {bestSingle && (
                  <button
                    type="button"
                    onClick={() => setOptimizationMode("single")}
                    className={`text-left p-4 rounded-3xl transition-all relative flex flex-col justify-between select-none cursor-pointer ${
                      optimizationMode === "single"
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-600 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {t.basket.singleStoreTab}
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
                            {singleStoreQty} {t.basket.itemsCount} ({bestSingle.coverage_pct}% stokda)
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        Bütün məhsulları bir yerdən alın, vaxta qənaət edin.
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {t.basket.total}:
                      </span>
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {bestSingle.total_cost.toFixed(2)} ₼
                      </span>
                    </div>
                  </button>
                )}

                {/* CARD 2: 2 Marketə Böl */}
                {bestSplit && primaryStore && secondaryStore ? (
                  <button
                    type="button"
                    onClick={() => setOptimizationMode("multi")}
                    className={`text-left p-4 rounded-3xl transition-all relative flex flex-col justify-between select-none cursor-pointer ${
                      optimizationMode === "multi"
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-600 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          {t.basket.splitStoreTab}
                        </span>
                        {isSplitViable ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[11px] shadow-xs">
                            {bestSplit.savings_azn.toFixed(2)} ₼ {t.basket.savings}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                            +{bestSplit.savings_azn.toFixed(2)} ₼ {t.basket.savings}
                          </span>
                        )}
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
                            {primaryStoreQty} + {secondaryStoreQty} {t.basket.itemsCount}
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
                        {t.basket.total}:
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {bestSplit.total_cost.toFixed(2)} ₼
                        </span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="p-4 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-left flex flex-col justify-between opacity-75 select-none">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          2 Marketə Böl
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Cütlük tapılmadı
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
                        <span>
                          {walkingRadius}m daxilində səbəti 100% təmin edən 2-li market cütü tapılmadı.
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Tək marketdən almaq tövsiyə olunur.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE DYNAMIC TICKED SUBTOTAL COUNTER CARD */}
              <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                    {t.basket.tickedTotal}
                  </div>
                  <div className="text-2xl font-black">
                    {tickedSubtotal.toFixed(2)} ₼
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black bg-white/20 px-3 py-1.5 rounded-xl inline-block">
                    {tickedCount} / {activePlanItems.length} {t.basket.itemsCount}
                  </span>
                </div>
              </div>

              {/* CHECKLIST PROGRESS & ACTIONS BAR */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {t.basket.checklistMode}: {tickedCount} / {activePlanItems.length}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={checkAllItems}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Hamısını seç
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      onClick={uncheckAllItems}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
              {/* CHECKLIST MODE A: 2 MARKET SPLIT                                 */}
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
                            {primaryStore.branch_name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {primaryStoreQty} {t.basket.itemsCount} —{" "}
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

                    {/* Store 1 Items */}
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
                                ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 opacity-80"
                                : "bg-slate-50/70 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-xl object-contain p-0.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shrink-0 mix-blend-multiply dark:mix-blend-normal"
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
                      <span>Marşrutu Aç</span>
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
                            {secondaryStore.branch_name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {secondaryStoreQty} {t.basket.itemsCount} —{" "}
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

                    {/* Store 2 Items */}
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
                                ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 opacity-80"
                                : "bg-slate-50/70 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-xl object-contain p-0.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shrink-0 mix-blend-multiply dark:mix-blend-normal"
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
              {/* CHECKLIST MODE B: SINGLE STORE                                   */}
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
                            {bestSingle.branch_name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {singleStoreQty} {t.basket.itemsCount} —{" "}
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

                    {/* Single Store Items */}
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
                                ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 opacity-80"
                                : "bg-slate-50/70 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded-xl object-contain p-0.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shrink-0 mix-blend-multiply dark:mix-blend-normal"
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
                                  ? "bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                                  : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800"
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
        </div>
      )}
    </div>
  );
}
