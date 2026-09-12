"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  Coins,
  Sparkles,
  Gift,
  CupSoda,
  IceCream,
  ShoppingBag,
  Store,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Moon,
  Sun,
  MapPin,
  Info,
  ExternalLink,
  Globe,
} from "lucide-react";
import { getUserProfile, getAvailableRewards, redeemReward } from "@/lib/api";
import { User, Reward } from "@/lib/types";
import { useSebetStore, SUPPORTED_LANGUAGES } from "@/lib/store";
import { useTranslation } from "@/lib/translations";
import { NearbyMarketsModal } from "@/components/NearbyMarketsModal";
import { ChainLogo } from "@/components/ChainLogo";

const PARTNER_CHAINS = [
  { slug: "bravo", name: "Bravo" },
  { slug: "araz", name: "Araz" },
  { slug: "oba", name: "OBA" },
  { slug: "bazarstore", name: "Bazarstore" },
  { slug: "almarket", name: "Al Market" },
  { slug: "neptun", name: "Neptun" },
  { slug: "spar", name: "Spar" },
];

export default function ProfilePage() {
  const { t } = useTranslation();
  const {
    userPoints,
    setPoints,
    theme,
    toggleTheme,
    selectedLocation,
    language,
    setLanguage,
  } = useSebetStore();

  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemedCode, setRedeemedCode] = useState<{
    title: string;
    code: string;
  } | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [isNearbyModalOpen, setIsNearbyModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function loadProfile() {
      try {
        const [u, r] = await Promise.all([
          getUserProfile().catch(() => null),
          getAvailableRewards().catch(() => []),
        ]);
        if (u) {
          setUser(u);
          setPoints(u.sebet_points);
        }
        setRewards(r);
      } catch (err) {
        console.error("Profile load failed", err);
      }
    }
    loadProfile();
  }, []);

  const handleRedeem = async (r: Reward) => {
    setRedeemingId(r.id);
    setRedeemError(null);
    try {
      const res = await redeemReward(r.id, r.points_cost, r.title);
      setPoints(res.remaining_points);
      setRedeemedCode({ title: r.title, code: res.voucher_code });
    } catch (err: any) {
      setRedeemError(err.message || "Kupon alına bilmədi.");
    } finally {
      setRedeemingId(null);
    }
  };

  const getRewardIcon = (iconName: string) => {
    switch (iconName) {
      case "CupSoda":
        return <CupSoda className="w-6 h-6 text-sky-500" />;
      case "IceCream":
        return <IceCream className="w-6 h-6 text-pink-500" />;
      case "ShoppingBag":
        return <ShoppingBag className="w-6 h-6 text-emerald-600" />;
      case "Gift":
      default:
        return <Gift className="w-6 h-6 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* SECTION 1: Clean Profile Header & User Info Card */}
      <div className="flex items-center justify-between px-0.5">
        <div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            {t.profile.title}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Şəxsi məlumatlar və loyallıq seçimləri
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-800 to-emerald-700 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            AI
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                {user?.full_name || "Ali Iskandarli"}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                Ağıllı Alıcı
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              {user?.phone_number || "+994 50 123 45 67"}
            </p>
          </div>
        </div>

        {/* Secondary Loyalty Status Sub-Card */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/90 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.profile.pointsBalance}</span>
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                {isMounted ? userPoints : 250}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                xal (~{((isMounted ? userPoints : 250) * 0.01).toFixed(2)} ₼)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-2xs">
              1 xal = 0.01 ₼
            </span>
          </div>
        </div>
      </div>

      {/* Redeemed Voucher Success Banner */}
      {redeemedCode && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 space-y-2 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Kupon Uğurla Əldə Edildi!
            </span>
            <button
              onClick={() => setRedeemedCode(null)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
            {redeemedCode.title}
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-center font-mono font-black text-sm tracking-widest text-emerald-800 dark:text-emerald-300 selection:bg-emerald-100">
            {redeemedCode.code}
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
            Bu promokodu tərəfdaş kassa və ya mobil tətbiqində təqdim edin.
          </p>
        </div>
      )}

      {/* Redeem Error */}
      {redeemError && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
          {redeemError}
        </div>
      )}

      {/* SECTION 2: Market Rewards & Gifts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.profile.rewards}</span>
          </h3>
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
            Dərhal aktivləşir
          </span>
        </div>

        <div className="space-y-2.5">
          {rewards.map((r) => {
            const canAfford = (isMounted ? userPoints : 250) >= r.points_cost;

            return (
              <div
                key={r.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/80 flex items-center justify-center shrink-0 shadow-2xs">
                    {getRewardIcon(r.icon)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500 block">
                      {r.category}
                    </span>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {r.title}
                    </h4>
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5 inline-flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {r.points_cost} xal
                    </span>
                  </div>
                </div>

                <button
                  disabled={!canAfford || redeemingId === r.id}
                  onClick={() => handleRedeem(r)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 ${
                    canAfford
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  {redeemingId === r.id ? "..." : canAfford ? "Əldə Et" : "Çatmır"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Partner Supermarkets */}
      <section className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-zinc-100">
            <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.profile.partnerChains}</span>
          </div>
          <button
            onClick={() => setIsNearbyModalOpen(true)}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Xəritədə bax</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PARTNER_CHAINS.map((chain) => (
            <div
              key={chain.slug}
              className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5 shrink-0"
            >
              <ChainLogo slug={chain.slug} size="xs" />
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                {chain.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3.5: Merchant Portal Access */}
      <section className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/20 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100">
              Tərəfdaş Portalı (Merchant Portal)
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Bazar göstəriciləri, gəlir və k-anonymity analitikası
            </p>
          </div>
        </div>
        <Link
          href="/merchant/dashboard"
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center gap-1"
        >
          <span>Daxil Ol</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* SECTION 4: Application Settings & Preferences */}
      <section className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
          {t.profile.settings}
        </h3>

        <div className="space-y-2 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          {/* Language Preference */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 font-semibold">
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t.profile.language}</span>
            </div>
            <div className="flex items-center gap-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const current = isMounted ? language : "az";
                const isSelected = current === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {lang.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 font-semibold">
              {isMounted && theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-400" />
              )}
              <span>{t.profile.darkMode}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors"
            >
              {isMounted && theme === "dark"
                ? (language === "ru" ? "Вкл" : language === "en" ? "Active" : "Aktiv")
                : (language === "ru" ? "Выкл" : language === "en" ? "Disabled" : "Deaktiv")}
            </button>
          </div>

          {/* Location Preference */}
          <div className="pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 font-semibold">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ərazi / Məkan</span>
            </div>
            <button
              onClick={() => setIsNearbyModalOpen(true)}
              className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1"
            >
              <span>{isMounted ? selectedLocation.name : "28 May"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* App Info */}
          <div className="pt-2.5 flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-[11px]">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Sebet Versiya</span>
            </div>
            <span className="font-mono font-bold">1.0.0 (Baku)</span>
          </div>
        </div>
      </section>

      {/* Nearby Supermarkets Modal */}
      <NearbyMarketsModal
        isOpen={isNearbyModalOpen}
        onClose={() => setIsNearbyModalOpen(false)}
      />
    </div>
  );
}
