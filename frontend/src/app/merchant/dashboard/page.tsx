"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Store,
  DollarSign,
  Coins,
  Users,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Info,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sliders,
  AlertCircle,
  QrCode,
} from "lucide-react";
import {
  getAvailableMerchants,
  getMerchantSummary,
  getMerchantBenchmark,
  getMerchantTransactions,
} from "@/lib/api";
import {
  MerchantChain,
  MerchantSummaryMetrics,
  MerchantBenchmarkResponse,
  RawTransaction,
} from "@/lib/types";

export default function MerchantDashboardPage() {
  const [merchants, setMerchants] = useState<MerchantChain[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantChain | null>(null);

  const [summary, setSummary] = useState<MerchantSummaryMetrics | null>(null);
  const [benchmark, setBenchmark] = useState<MerchantBenchmarkResponse | null>(null);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);
  const [customUuidInput, setCustomUuidInput] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("30d");

  // 1. Initial load: fetch participating merchant list
  useEffect(() => {
    async function loadMerchants() {
      try {
        const list = await getAvailableMerchants();
        setMerchants(list);

        // Load saved merchant ID from localStorage, or select first merchant
        const savedId = localStorage.getItem("sebet_active_merchant_id");
        if (savedId && list.some((m) => m.id === savedId)) {
          setSelectedMerchantId(savedId);
          setSelectedMerchant(list.find((m) => m.id === savedId) || null);
        } else if (list.length > 0) {
          setSelectedMerchantId(list[0].id);
          setSelectedMerchant(list[0]);
          localStorage.setItem("sebet_active_merchant_id", list[0].id);
        }
      } catch (err: any) {
        console.warn("Could not load merchant list from API:", err);
        // Fallback default merchant for demo
        const fallbackBravo: MerchantChain = {
          id: "00000000-0000-0000-0000-000000000001",
          name: "Bravo Supermarket",
          slug: "bravo",
          category: "Grocery",
          color: "#74b826",
        };
        setMerchants([fallbackBravo]);
        setSelectedMerchantId(fallbackBravo.id);
        setSelectedMerchant(fallbackBravo);
      }
    }
    loadMerchants();
  }, []);

  // 2. Fetch scoped data whenever selectedMerchantId changes
  useEffect(() => {
    if (!selectedMerchantId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function fetchDashboardData() {
      try {
        const [sumRes, benchRes, txsRes] = await Promise.allSettled([
          getMerchantSummary(selectedMerchantId),
          getMerchantBenchmark(selectedMerchantId),
          getMerchantTransactions(selectedMerchantId),
        ]);

        if (!isMounted) return;

        if (sumRes.status === "fulfilled") {
          setSummary(sumRes.value);
        } else {
          console.warn("Summary fetch error:", sumRes.reason);
        }

        if (benchRes.status === "fulfilled") {
          setBenchmark(benchRes.value);
        } else {
          console.warn("Benchmark fetch error:", benchRes.reason);
        }

        if (txsRes.status === "fulfilled") {
          setTransactions(txsRes.value);
        } else {
          console.warn("Transactions fetch error:", txsRes.reason);
        }

        // If all three failed, surface general error
        if (
          sumRes.status === "rejected" &&
          benchRes.status === "rejected" &&
          txsRes.status === "rejected"
        ) {
          setError("Mağaza məlumatlarını yükləmək mümkün olmadı. Zəhmət olmasa ID-ni yoxlayın.");
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Gözlənilməz xəta baş verdi.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [selectedMerchantId]);

  const handleSelectMerchant = (m: MerchantChain) => {
    setSelectedMerchantId(m.id);
    setSelectedMerchant(m);
    localStorage.setItem("sebet_active_merchant_id", m.id);
    setIsSwitcherOpen(false);
  };

  const handleCustomUuidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUuidInput.trim()) return;
    const cleanId = customUuidInput.trim();
    setSelectedMerchantId(cleanId);
    setSelectedMerchant({
      id: cleanId,
      name: `Tərəfdaş (${cleanId.slice(0, 8)})`,
      slug: "custom",
      category: "Grocery",
      color: "#10B981",
    });
    localStorage.setItem("sebet_active_merchant_id", cleanId);
    setCustomUuidInput("");
    setIsSwitcherOpen(false);
  };

  const currentCategory =
    benchmark?.category || summary?.category || selectedMerchant?.category || "Grocery";

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Navigation Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shrink-0"
              style={{
                backgroundColor: selectedMerchant?.color || "#10B981",
              }}
            >
              {selectedMerchant?.name ? selectedMerchant.name[0] : "S"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {summary?.merchant_name || selectedMerchant?.name || "Tərəfdaş Mağaza"}
                </h1>
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {currentCategory}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Tərəfdaş Portalı • ID: {selectedMerchantId.slice(0, 8)}...</span>
              </p>
            </div>
          </div>

          {/* Quick Actions: Store Switcher & Date Range */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* POS Cashier Scanner Link */}
            <Link
              href="/merchant/cashier"
              className="flex items-center gap-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-colors border border-slate-700/50"
              title="Kassa Skaneri və Kupon Tətbiqi"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kassa Skaneri (POS)</span>
            </Link>

            {/* Date Range Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 gap-1.5 border border-slate-200 dark:border-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Son 30 Gün</span>
            </div>

            {/* Switch Store Button */}
            <button
              onClick={() => setIsSwitcherOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Mağazanı Dəyiş</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Security & Multi-Tenancy Scope Banner */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Məlumatlar ciddi şəkildə təcrid olunub (Tenant Scoped: X-Merchant-Id)</span>
          </div>
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 transition-colors"
          >
            <span>İstehlakçı görünüşünə qayıt</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Error Banner if any */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="text-xs">
            <p className="font-bold">Məlumatları yeniləmək mümkün olmadı</p>
            <p className="mt-0.5 text-rose-700/80 dark:text-rose-400/80">{error}</p>
          </div>
        </div>
      )}

      {/* 2. KPI Metric Cards (Private Data) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Əsas Nəticələr (KPI)</span>
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">Məxfi Tərəfdaş Göstəriciləri</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Revenue */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Platforma Dövriyyəsi
              </span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isLoading ? (
                <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ) : (
                `$${Number(summary?.total_revenue || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Səbət qəbzləri ilə təsdiqlənmiş
            </p>
          </div>

          {/* Card 2: Points Distributed */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Verilmiş Ballar
              </span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isLoading ? (
                <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ) : (
                `${(summary?.total_points_issued || 0).toLocaleString()} bal`
              )}
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
              ≈ ${(Number(summary?.total_points_issued || 0) / 100).toFixed(2)} ekvivalent
            </p>
          </div>

          {/* Card 3: Unique Customers */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Aktiv Müştərilər
              </span>
              <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isLoading ? (
                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ) : (
                `${summary?.unique_customer_count || 0} nəfər`
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {summary?.total_transactions || 0} ümumi tranzaksiya
            </p>
          </div>

          {/* Card 4: Repeat Customer Rate */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                30 Günlük Qayıdış
              </span>
              <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isLoading ? (
                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ) : (
                `${Number(summary?.repeat_customer_rate || 0).toFixed(1)}%`
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              ≥2 dəfə gələn təkrar alıcılar
            </p>
          </div>
        </div>
      </div>

      {/* 3. k-Anonymized Category Benchmark Section */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Bazar & Kateqoriya Göstəriciləri (Benchmark)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentCategory} kateqoriyası üzrə k-anonymity ilə qorunan bazar ortalaması
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>k-Anonymity (k = 5)</span>
          </div>
        </div>

        {/* State A: Benchmark Available (k >= 5) */}
        {benchmark?.benchmark_available && benchmark.category_benchmark ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Metric 1: Average Basket Size */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Orta Səbət Məbləği
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Sizin Mağaza</span>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                      ${Number(benchmark.merchant_metrics.average_basket_size).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Bazar Medianı</span>
                    <p className="text-lg font-black text-slate-600 dark:text-slate-400">
                      ${Number(benchmark.category_benchmark.average_basket_size).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Comparative Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (Number(benchmark.merchant_metrics.average_basket_size) /
                            Math.max(
                              1,
                              Number(benchmark.merchant_metrics.average_basket_size) +
                                Number(benchmark.category_benchmark.average_basket_size)
                            )) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Siz</span>
                    <span>Bazar</span>
                  </div>
                </div>
              </div>

              {/* Metric 2: Points per Transaction */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Qəbz Başına Bal
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Sizin Mağaza</span>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {benchmark.merchant_metrics.average_points_earned_per_transaction.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Bazar Medianı</span>
                    <p className="text-lg font-black text-slate-600 dark:text-slate-400">
                      {benchmark.category_benchmark.average_points_earned_per_transaction.toFixed(1)}
                    </p>
                  </div>
                </div>

                {/* Comparative Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (benchmark.merchant_metrics.average_points_earned_per_transaction /
                            Math.max(
                              1,
                              benchmark.merchant_metrics.average_points_earned_per_transaction +
                                benchmark.category_benchmark.average_points_earned_per_transaction
                            )) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">Siz</span>
                    <span>Bazar</span>
                  </div>
                </div>
              </div>

              {/* Metric 3: Repeat Customer Rate */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  30 Günlük Qayıdış Faizi
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Sizin Mağaza</span>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {benchmark.merchant_metrics.repeat_customer_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Bazar Medianı</span>
                    <p className="text-lg font-black text-slate-600 dark:text-slate-400">
                      {benchmark.category_benchmark.repeat_customer_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Comparative Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (benchmark.merchant_metrics.repeat_customer_rate /
                            Math.max(
                              1,
                              benchmark.merchant_metrics.repeat_customer_rate +
                                benchmark.category_benchmark.repeat_customer_rate
                            )) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">Siz</span>
                    <span>Bazar</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-right">
              {benchmark.category_benchmark.participating_merchants_count} aktiv regional tərəfdaşın
              anonim məlumatları əsasında hesablanmışdır.
            </p>
          </div>
        ) : (
          /* State B: Privacy Guardrail Active (k < 5) */
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/5 via-emerald-500/5 to-slate-100 dark:to-slate-900/40 border border-amber-500/30 dark:border-amber-500/20 text-center relative overflow-hidden">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-sm">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>

            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Kateqoriya Göstəriciləri Məxfilik Səbəbilə Gizlədilib ($k &lt; 5$)
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Kateqoriya göstəriciləri region üzrə ən azı <strong>5 aktiv tərəfdaş mağaza</strong>{" "}
              iştirak etdikdə aktivləşir. Mağazanızın fərdi kommersiya göstəricilərinin heç bir rəqib
              tərəfindən təxmin edilməməsi üçün k-anonymity məxfilik standartı tətbiq olunur.
            </p>

            {/* Density Progress Indicator */}
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                <span>Məxfilik Ehtiyatı</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {merchants.filter((m) => m.category === currentCategory).length} / 5 Mağaza
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (merchants.filter((m) => m.category === currentCategory).length / 5) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mağazanızın fərdi dövriyyəsi tam qorunur</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Cross-Shopping Affinity Visualizer */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Müştərilərin Digər Kateqoriyalara Marağı (Cross-Shopping)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sizin alıcıların digər hansı xidmət və mağazalardan istifadə etdiyini göstərən anonim təhlil
            </p>
          </div>
        </div>

        {/* Affinity List */}
        {benchmark?.cross_shopping_affinities && benchmark.cross_shopping_affinities.length > 0 ? (
          <div className="space-y-3">
            {benchmark.cross_shopping_affinities.map((aff, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60"
              >
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px]">
                      #{idx + 1}
                    </span>
                    <span>{aff.category}</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                    {aff.affinity_percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, aff.affinity_percentage)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{aff.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
            Hazırda cross-shopping məlumatı kifayət qədər tranzaksiya olmadığından formalaşmayıb.
          </div>
        )}

        {/* Explicit Privacy & Trust Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3 text-emerald-900 dark:text-emerald-300">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <p className="text-xs leading-relaxed">
            <strong>Məxfilik Zəmanəti:</strong> Təhlillər ümumiləşdirilmiş müştəri davranış
            kohortlarından formalaşır. Birbaşa rəqib mağazaların adları, dövriyyəsi və ya qalıqları
            heç bir halda izlənilmir və ya göstərilmir.
          </p>
        </div>
      </div>

      {/* 5. Recent Verified Transactions Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Son Təsdiqlənmiş Tranzaksiyalar (Loyalty Ledger)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Yalnız sizin mağazanıza aid qəbzlər (Tenant Scoped: X-Merchant-Id)
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
            {transactions.length} qəbz
          </span>
        </div>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Tarix & Saat</th>
                  <th className="py-2.5 px-3">Qəbz No</th>
                  <th className="py-2.5 px-3 text-right">Səbət Məbləği</th>
                  <th className="py-2.5 px-3 text-right">Qazanılan Bal</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                      {new Date(tx.purchased_at).toLocaleString("az-AZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {tx.receipt_number || tx.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      ${Number(tx.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      +{tx.sebet_points_awarded} bal
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Təsdiqləndi</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4">
            <Store className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Bu mağaza üçün hələ tranzaksiya qeydə alınmayıb.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              İstehlakçılar qəbz skan etdikcə əməliyyatlar real vaxtda burada əks olunacaq.
            </p>
          </div>
        )}
      </div>

      {/* 6. Store Switcher Modal */}
      {isSwitcherOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Tərəfdaş Mağaza Seçimi
                </h3>
              </div>
              <button
                onClick={() => setIsSwitcherOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Məlumatların izolasiyası və k-anonymity məxfiliyini yoxlamaq üçün fərqli mağaza seçin:
            </p>

            {/* List of active chains */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {merchants.map((m) => {
                const isSelected = m.id === selectedMerchantId;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMerchant(m)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: m.color || "#10B981" }}
                      >
                        {m.name[0]}
                      </div>
                      <div>
                        <p>{m.name}</p>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {m.category || "Grocery"} • {m.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>

            {/* Custom UUID Input */}
            <form
              onSubmit={handleCustomUuidSubmit}
              className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2"
            >
              <label className="text-[11px] font-bold text-slate-500 block">
                Fərdi Merchant UUID daxil edin:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={customUuidInput}
                  onChange={(e) => setCustomUuidInput(e.target.value)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Tətbiq et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

