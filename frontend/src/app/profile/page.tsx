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
    <div className="space-y-6 pb-8">
      {/* SECTION 1: Trendyol-Style User Profile Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-950 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950 text-white shadow-xl space-y-4 border border-slate-800 dark:border-slate-700/60">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-500/30">
            AI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base tracking-tight text-white">
                {user?.full_name || "Ali Iskandarli"}
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                Ağıllı Alıcı
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-mono mt-0.5">
              {user?.phone_number || "+994 50 123 45 67"}
            </p>
          </div>
        </div>

        {/* Points Banner */}
        <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/15 dark:border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 block">
              Mövcud Sebet Xallarım
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-amber-300 tracking-tight">
                {isMounted ? userPoints : 250}
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                xal (~{((isMounted ? userPoints : 250) * 0.01).toFixed(2)} ₼)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              1 Xal = 0.01 AZN
            </span>
          </div>
        </div>
      </div>

      {/* Redeemed Voucher Success Banner */}
      {redeemedCode && (
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 space-y-2 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Kupon Uğurla Əldə Edildi!
            </span>
            <button
              onClick={() => setRedeemedCode(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {redeemedCode.title}
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-center font-mono font-black text-sm tracking-widest text-emerald-800 dark:text-emerald-300 selection:bg-emerald-100">
            {redeemedCode.code}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
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
          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Market Hədiyyələri & Kuponlar</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
            Dərhal aktivləşir
          </span>
        </div>

        <div className="space-y-2.5">
          {rewards.map((r) => {
            const canAfford = (isMounted ? userPoints : 250) >= r.points_cost;

            return (
              <div
                key={r.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                    {getRewardIcon(r.icon)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 block">
                      {r.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
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
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
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
      <section className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-slate-100">
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
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-1.5 shrink-0"
            >
              <ChainLogo slug={chain.slug} size="xs" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {chain.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: Application Settings & Preferences */}
      <section className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
        <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Tətbiq Parametrləri
        </h3>

        <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {/* Theme Toggle */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-semibold">
              {isMounted && theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-500" />
              )}
              <span>Qaranlıq Rejim (Dark Mode)</span>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
            >
              {isMounted && theme === "dark" ? "Aktiv" : "Deaktiv"}
            </button>
          </div>

          {/* Location Preference */}
          <div className="pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-semibold">
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
          <div className="pt-2.5 flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
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
