"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { getUserProfile, getAvailableRewards, redeemReward } from "@/lib/api";
import { User, Reward } from "@/lib/types";
import { useSebetStore } from "@/lib/store";
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
  const {
    userPoints,
    setPoints,
    theme,
    toggleTheme,
    selectedLocation,
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
          <h1 className="text-xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Profil
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Şəxsi məlumatlar və loyallıq seçimləri
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            AI
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-zinc-100 truncate">
                {user?.full_name || "Ali Iskandarli"}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                Ağıllı Alıcı
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
              {user?.phone_number || "+994 50 123 45 67"}
            </p>
          </div>
        </div>

        {/* Secondary Loyalty Status Sub-Card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850/80 border border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Sadiqlik Balansı</span>
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {isMounted ? userPoints : 250}
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                xal (~{((isMounted ? userPoints : 250) * 0.01).toFixed(2)} ₼)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-200/70 dark:border-zinc-700/70 shadow-2xs">
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
              className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 dark:text-zinc-100">
            {redeemedCode.title}
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-center font-mono font-black text-sm tracking-widest text-emerald-800 dark:text-emerald-300 selection:bg-emerald-100">
            {redeemedCode.code}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 text-center">
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
          <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Market Hədiyyələri & Kuponlar</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
            Dərhal aktivləşir
          </span>
        </div>

        <div className="space-y-2.5">
          {rewards.map((r) => {
            const canAfford = (isMounted ? userPoints : 250) >= r.points_cost;

            return (
              <div
                key={r.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/80 flex items-center justify-center shrink-0 shadow-2xs">
                    {getRewardIcon(r.icon)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-zinc-500 block">
                      {r.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
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
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
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
      <section className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100">
            <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Tərəfdaş Supermarketlər</span>
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
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-800 flex items-center gap-1.5 shrink-0"
            >
              <ChainLogo slug={chain.slug} size="xs" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                {chain.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: Application Settings & Preferences */}
      <section className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
          Tətbiq Parametrləri
        </h3>

        <div className="space-y-2 divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
          {/* Theme Toggle */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300 font-semibold">
              {isMounted && theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              )}
              <span>Qaranlıq Rejim (Dark Mode)</span>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs transition-colors"
            >
              {isMounted && theme === "dark" ? "Aktiv" : "Deaktiv"}
            </button>
          </div>

          {/* Location Preference */}
          <div className="pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300 font-semibold">
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
          <div className="pt-2.5 flex items-center justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
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
