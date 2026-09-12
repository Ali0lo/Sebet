"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Flame,
  Clock,
  ArrowRight,
  TrendingUp,
  Tag,
  Store,
  DollarSign,
  Coins,
  ShieldCheck,
  Eye,
  MousePointerClick,
  BarChart3,
  Layers,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Info,
  X,
  Camera,
} from "lucide-react";
import { getSponsoredCampaigns, trackAdEvent, getBrandAnalytics } from "@/lib/api";
import {
  BrandCampaign,
  BrandAnalyticsResponse,
  BrandAnalyticsCampaignItem,
} from "@/lib/types";

const CATEGORIES = [
  { id: "ALL", label: "Hamısı" },
  { id: "İçkilər", label: "İçkilər" },
  { id: "Süd Məhsulları", label: "Süd Məhsulları" },
  { id: "Məişət", label: "Məişət & Yuyucu" },
  { id: "Qida & Ərzaq", label: "Qida & Ərzaq" },
];

const PARTNER_STORES = [
  { name: "Bravo", color: "#10B981" },
  { name: "Araz", color: "#F59E0B" },
  { name: "Bazarstore", color: "#3B82F6" },
  { name: "OBA", color: "#06B6D4" },
  { name: "Neptun", color: "#8B5CF6" },
  { name: "Al Market", color: "#EC4899" },
  { name: "Spar", color: "#16A34A" },
];

export default function OffersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"consumer" | "advertiser">("consumer");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [activeModalCampaign, setActiveModalCampaign] = useState<BrandCampaign | null>(null);

  // Advertiser Analytics State
  const [analytics, setAnalytics] = useState<BrandAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("");

  // Telemetry: Impression deduplication set
  const loggedImpressions = useRef<Set<string>>(new Set());

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSponsoredCampaigns(
        selectedCategory === "ALL" ? undefined : selectedCategory
      );
      setCampaigns(data);
    } catch (err: any) {
      console.error("Failed to load campaigns:", err);
      setError("Sponsorlu kampaniyaları yükləmək mümkün olmadı.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const data = await getBrandAnalytics(
        selectedBrandFilter || undefined
      );
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load advertiser analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [selectedBrandFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (activeTab === "advertiser") {
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

  // Telemetry: IntersectionObserver for impressions
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (activeTab !== "consumer" || campaigns.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const campaignId = entry.target.getAttribute("data-campaign-id");
            if (campaignId && !loggedImpressions.current.has(campaignId)) {
              loggedImpressions.current.add(campaignId);
              trackAdEvent({
                campaign_id: campaignId,
                event_type: "IMPRESSION",
              }).catch((e) => console.warn("Impression log error:", e));
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [campaigns, activeTab]);

  const handleCardClick = async (campaign: BrandCampaign) => {
    // Open details modal
    setActiveModalCampaign(campaign);

    // Track click event (atomically deducts CPC in backend)
    try {
      await trackAdEvent({
        campaign_id: campaign.id,
        event_type: "CLICK",
      });
    } catch (e) {
      console.warn("Click log error:", e);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Mode Switcher */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 sm:p-6 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Retail Media Şəbəkəsi (RMN)
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Sponsorlu SKU Boostları
              </h1>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                CPG brendləri tərəfindən birbaşa maliyyələşdirilən yüksək dəyərli bal multiplikatorları.
              </p>
            </div>

            {/* Mode Switcher Pills */}
            <div className="flex items-center bg-white/10 p-1 rounded-2xl backdrop-blur-md border border-white/10 self-start sm:self-center">
              <button
                onClick={() => setActiveTab("consumer")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "consumer"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                İstehlakçı Lenti
              </button>
              <button
                onClick={() => setActiveTab("advertiser")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === "advertiser"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Brend Portalı</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONSUMER VIEW */}
      {activeTab === "consumer" && (
        <div className="space-y-5">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-md scale-102"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-64 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Campaign Cards Grid */}
          {!isLoading && campaigns.length === 0 && (
            <div className="text-center py-12 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
              <Tag className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Seçilmiş kateqoriyada aktiv sponsorlu kampaniya tapılmadı.
              </div>
              <p className="text-xs text-slate-500">
                Digər kateqoriyalara baxın və ya tezliklə yenidən yoxlayın.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {campaigns.map((camp) => {
              return (
                <div
                  key={camp.id}
                  data-campaign-id={camp.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(camp.id, el);
                  }}
                  onClick={() => handleCardClick(camp)}
                  className="group bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                >
                  {/* Banner Image Container */}
                  <div className="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                    <img
                      src={
                        camp.banner_image_url ||
                        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={camp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                    {/* Multiplier Pill Top Left */}
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-slate-950" />
                      <span>{camp.multiplier}X BAL BONUS</span>
                    </div>

                    {/* Sponsor Badge Top Right */}
                    <div className="absolute top-3 right-3 bg-slate-950/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Sponsorlu</span>
                    </div>

                    {/* Brand Name on Banner Bottom */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                      <span className="text-xs font-black tracking-wider uppercase drop-shadow-md">
                        {camp.brand_name}
                      </span>
                      <span className="text-[10px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-md font-semibold">
                        {camp.category}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {camp.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {camp.description || "Bu brendin məhsullarını alaraq qəbzi skan edin və multiplikator bal qazanın."}
                      </p>

                      {/* Keyword Pills Preview */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {camp.target_sku_keywords.slice(0, 3).map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          >
                            #{kw}
                          </span>
                        ))}
                        {camp.target_sku_keywords.length > 3 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500">
                            +{camp.target_sku_keywords.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom CTA / Action Strip */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>Aktiv Təklif</span>
                      </div>

                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        <span>5x Bal Qazan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ADVERTISER ANALYTICS VIEW */}
      {activeTab === "advertiser" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Brend Reklam İdarəetmə Paneli
                </h3>
                <p className="text-xs text-slate-500">
                  Göstəriş, klik, CPC xərcləri və loyallıq konversiyaları üzrə canlı hesabat.
                </p>
              </div>
            </div>

            <button
              onClick={fetchAnalytics}
              disabled={isLoadingAnalytics}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
              <span>Yenilə</span>
            </button>
          </div>

          {/* KPI Metric Summary Cards */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Impressions */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>Göstərişlər</span>
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {analytics.total_impressions.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">Ümumi lent təsirləri</div>
              </div>

              {/* Clicks */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>Kliklər (CPC)</span>
                  <MousePointerClick className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {analytics.total_clicks.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">Kart açılışları</div>
              </div>

              {/* CTR */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>CTR (%)</span>
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {analytics.ctr_percent}%
                </div>
                <div className="text-[10px] text-slate-400">Keçid faizi</div>
              </div>

              {/* Conversions (Receipt Earns) */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>Qəbz Konversiyası</span>
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {analytics.total_conversions.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">Multiplikatorla təsdiq</div>
              </div>

              {/* Total Spent */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>Xərclənən Büdcə</span>
                  <DollarSign className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ${analytics.total_spent_usd.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">CPC + bal subsidiyaları</div>
              </div>

              {/* Remaining Pool */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>Qalan Fond</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ${analytics.total_budget_remaining_usd.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">Aktiv media balansı</div>
              </div>
            </div>
          )}

          {/* Campaign Breakdown Table */}
          {analytics && analytics.campaigns.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 font-black text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Aktiv Kampaniyalar üzrə İcmal</span>
                <span className="text-xs text-slate-400 font-medium">
                  {analytics.campaigns.length} Kampaniya
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Brend / Başlıq</th>
                      <th className="py-3 px-4">Multiplikator</th>
                      <th className="py-3 px-4">Göstəriş</th>
                      <th className="py-3 px-4">Klik (CTR)</th>
                      <th className="py-3 px-4">Konversiya</th>
                      <th className="py-3 px-4">Qalan Büdcə</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    {analytics.campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-900 dark:text-slate-100">
                            {c.brand_name}
                          </div>
                          <div className="text-[10px] text-slate-400">{c.title}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                            {c.multiplier}x Bal
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {c.impressions}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {c.clicks}
                          </span>
                          <span className="text-slate-400 text-[10px] ml-1">
                            ({c.ctr_percent}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          {c.conversions}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            ${c.budget_pool_remaining.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            CPC: ${c.cpc_bid.toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. OFFER DETAILS MODAL */}
      {activeModalCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 space-y-0 animate-in zoom-in-95">
            {/* Header Image */}
            <div className="relative h-44 w-full bg-slate-950">
              <img
                src={
                  activeModalCampaign.banner_image_url ||
                  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80"
                }
                alt={activeModalCampaign.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

              {/* Close Button */}
              <button
                onClick={() => setActiveModalCampaign(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Brand & Multiplier Floating Pill */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                <div>
                  <span className="text-xs font-black uppercase text-amber-400">
                    {activeModalCampaign.brand_name}
                  </span>
                  <h3 className="text-base font-black leading-tight text-white">
                    {activeModalCampaign.title}
                  </h3>
                </div>
                <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black text-xs shadow-lg">
                  {activeModalCampaign.multiplier}X BAL
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* How it works info box */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                <div className="font-black flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  Brend Tərəfindən Subsidiyalaşdırılır
                </div>
                <p className="leading-relaxed text-[11px]">
                  Bu təklif çərçivəsində qazanılan əlavə multiplikator balları birbaşa brendin reklam büdcəsindən ödənilir və marketin marjasına toxunmur.
                </p>
              </div>

              {/* Eligible SKU Keywords */}
              <div className="space-y-1.5">
                <div className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Tələb Olunan Məhsul / Açar Sözlər:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeModalCampaign.target_sku_keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Participating Supermarkets */}
              <div className="space-y-1.5">
                <div className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Keçərli Olduğu Partnyor Marketlər:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PARTNER_STORES.map((s, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => setActiveModalCampaign(null)}
                  className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Bağla
                </button>
                <button
                  onClick={() => {
                    setActiveModalCampaign(null);
                    router.push("/scan");
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Qəbzi Skan Et</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
