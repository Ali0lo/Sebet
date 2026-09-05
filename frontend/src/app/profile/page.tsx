"use client";

import React, { useState, useEffect } from "react";
import {
  User as UserIcon,
  Coins,
  Sparkles,
  Gift,
  Coffee,
  PhoneCall,
  Film,
  Car,
  CheckCircle2,
  Receipt,
  ChevronRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { getUserProfile, getAvailableRewards, redeemReward } from "@/lib/api";
import { User, Reward } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";

export default function ProfilePage() {
  const { userPoints, setPoints } = useSebEtStore();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemedCode, setRedeemedCode] = useState<{
    title: string;
    code: string;
  } | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

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
      case "Coffee":
        return <Coffee className="w-5 h-5 text-amber-600" />;
      case "PhoneCall":
        return <PhoneCall className="w-5 h-5 text-blue-600" />;
      case "Film":
        return <Film className="w-5 h-5 text-purple-600" />;
      case "Car":
        return <Car className="w-5 h-5 text-emerald-600" />;
      default:
        return <Gift className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* User Header Profile Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-950 text-white shadow-xl space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-500/30">
            Aİ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base tracking-tight">
                {user?.full_name || "Ali İsgəndərli"}
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                Ağıllı Alıcı
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {user?.phone_number || "+994 50 123 45 67"}
            </p>
          </div>
        </div>

        {/* Points Banner */}
        <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 block">
              Mövcud SebEt Xalları
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-amber-300 tracking-tight">
                {isMounted ? userPoints : 250}
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                xal
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              1 Xal = 0.01 AZN
            </span>
          </div>
        </div>
      </div>

      {/* Redeemed Voucher Success Banner */}
      {redeemedCode && (
        <div className="p-4 rounded-3xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 space-y-2 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Kupon Uğurla Əldə Edildi!
            </span>
            <button
              onClick={() => setRedeemedCode(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="text-xs font-bold text-slate-800">
            {redeemedCode.title}
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-center font-mono font-black text-sm tracking-widest text-emerald-800 selection:bg-emerald-100">
            {redeemedCode.code}
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Bu promokodu tərəfdaş kassa və ya mobil tətbiqində təqdim edin.
          </p>
        </div>
      )}

      {/* Redeem Error */}
      {redeemError && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {redeemError}
        </div>
      )}

      {/* Rewards Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-emerald-600" />
            <span>Xalları Dəyişdir (Tərəfdaş Hədiyyələri)</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-500">
            Dərhal aktivləşir
          </span>
        </div>

        <div className="space-y-2">
          {rewards.map((r) => {
            const canAfford = (isMounted ? userPoints : 250) >= r.points_cost;

            return (
              <div
                key={r.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    {getRewardIcon(r.icon)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">
                      {r.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {r.title}
                    </h4>
                    <span className="text-xs font-black text-amber-600 mt-0.5 inline-flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {r.points_cost} xal
                    </span>
                  </div>
                </div>

                <button
                  disabled={!canAfford || redeemingId === r.id}
                  onClick={() => handleRedeem(r)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 ${
                    canAfford
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {redeemingId === r.id ? "..." : canAfford ? "Al" : "Çatmır"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scanned Receipts History Summary */}
      <div className="space-y-2.5 pt-2">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-emerald-600" />
          <span>Skan Edilmiş Qəbzlər</span>
        </h3>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Bravo 28 Mall Qəbzi</span>
            <span className="font-black text-emerald-700">+50 Xal</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>05 Sentyabr 2026 • 26.50 AZN</span>
            <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
              Təsdiqləndi
            </span>
          </div>
        </div>
      </div>

      {/* Info Card: ƏDV Geri Al Synergy */}
      <div className="p-4 rounded-3xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
        <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>INMerge 2026 Baku — ƏDV Geri Al Sinergiyası</span>
        </div>
        <p className="text-[11px] text-emerald-800/90 leading-relaxed">
          SebEt Azərbaycanda POS inteqrasiyasına ehtiyac duymadan real rəf qiymətlərini kütləvi qəbz OCR və broşür analizi vasitəsilə toplayır. Hər skan olunan qəbz həm istifadəçiyə qənaət təklif edir, həm də pərakəndə qiymət şəffaflığını təmin edir.
        </p>
      </div>
    </div>
  );
}

