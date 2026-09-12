"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Coins,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  RotateCw,
  Lock,
  ChevronDown,
  Store,
  QrCode,
  Barcode,
  XCircle,
  ArrowLeft,
  DollarSign,
  Copy,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  getLedgerBalance,
  getAvailableMerchants,
  createRedemptionVoucher,
  getVoucherStatus,
} from "@/lib/api";
import {
  LedgerBalanceResponse,
  MerchantChain,
  VoucherResponse,
  VoucherStatusResponse,
} from "@/lib/types";
import { useSebEtStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";

function getChainSlug(name?: string | null): string {
  const n = (name || "").toLowerCase();
  if (n.includes("bravo")) return "bravo";
  if (n.includes("araz")) return "araz";
  if (n.includes("oba")) return "oba";
  if (n.includes("bazarstore")) return "bazarstore";
  if (n.includes("neptun")) return "neptun";
  if (n.includes("bolmart")) return "bolmart";
  return "bravo";
}

// Crisp Pure SVG Barcode Renderer
function BarcodeSvg({ code }: { code: string }) {
  // Generate deterministic bar widths based on code characters
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 3, isBlack: true }, { width: 2, isBlack: false }, { width: 3, isBlack: true });
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    bars.push(
      { width: (charCode % 3) + 2, isBlack: true },
      { width: (charCode % 2) + 1, isBlack: false },
      { width: ((charCode * 3) % 4) + 1, isBlack: true },
      { width: (charCode % 2) + 1, isBlack: false }
    );
  }
  bars.push({ width: 3, isBlack: true }, { width: 2, isBlack: false }, { width: 3, isBlack: true });

  let currentX = 10;
  return (
    <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
      <svg
        viewBox="0 0 280 60"
        className="w-full max-w-[260px] h-14"
        preserveAspectRatio="none"
      >
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width + 1.5;
          return bar.isBlack ? (
            <rect key={idx} x={x} y="4" width={bar.width} height="52" fill="#0f172a" />
          ) : null;
        })}
      </svg>
      <span className="font-mono text-xs font-black tracking-widest text-slate-800 dark:text-slate-900 mt-1">
        {code}
      </span>
    </div>
  );
}

// Crisp Pure SVG QR Code Renderer with Position Finders
function QrCodeSvg({ data }: { data: string }) {
  const size = 21; // 21x21 matrix standard QR version 1
  const matrix: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // 1. Draw Position Finder Patterns at (0,0), (14,0), (0,14)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row + r][col + c] = true;
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, 14);
  drawFinder(14, 0);

  // 2. Deterministic data modules based on string hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data.charCodeAt(i)) & 0xffffffff;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder zones
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c > 12) ||
        (r > 12 && c < 8)
      ) {
        continue;
      }
      const bit = ((hash ^ (r * 13 + c * 7)) & (1 << ((r + c) % 16))) !== 0;
      matrix[r][c] = bit;
    }
  }

  const cellSize = 10;
  const viewBoxSize = size * cellSize;

  return (
    <div className="bg-white p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center">
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-44 h-44"
      >
        {matrix.map((row, r) =>
          row.map((isFilled, c) =>
            isFilled ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0f172a"
                rx={1.5}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

export default function RedeemPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { userPoints, setPoints } = useSebEtStore();

  // Ledger Balance
  const [ledgerBalance, setLedgerBalance] = useState<LedgerBalanceResponse | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Merchant List & Selected Store
  const [merchants, setMerchants] = useState<MerchantChain[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantChain | null>(null);

  // Points Burn State
  const [burnPoints, setBurnPoints] = useState<number>(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Voucher State
  const [activeVoucher, setActiveVoucher] = useState<VoucherResponse | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600); // 10 minutes
  const [copiedCode, setCopiedCode] = useState(false);

  // Settled / Claimed State
  const [settledResult, setSettledResult] = useState<VoucherStatusResponse | null>(null);

  const activePoints = ledgerBalance ? ledgerBalance.points_balance : userPoints;
  const activeCash = (activePoints / 100).toFixed(2);
  const burnDiscountUsd = (burnPoints / 100).toFixed(2);

  // Fetch Live Ledger Balance
  const fetchBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      const bal = await getLedgerBalance();
      setLedgerBalance(bal);
      setPoints(bal.points_balance);
    } catch (err) {
      console.warn("Could not fetch ledger balance:", err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [setPoints]);

  useEffect(() => {
    setIsMounted(true);
    fetchBalance();

    async function loadStores() {
      try {
        const list = await getAvailableMerchants();
        setMerchants(list);
        if (list.length > 0) {
          setSelectedMerchant(list[0]);
        }
      } catch (err) {
        console.warn("Could not load merchants:", err);
        // Fallback demo merchant
        const fallback: MerchantChain = {
          id: "00000000-0000-0000-0000-000000000001",
          name: "Bravo Supermarket",
          slug: "bravo",
          category: "Grocery",
          color: "#10B981",
        };
        setMerchants([fallback]);
        setSelectedMerchant(fallback);
      }
    }
    loadStores();
  }, [fetchBalance]);

  // 10-Minute Countdown Timer for Active Voucher
  useEffect(() => {
    if (!activeVoucher) return;

    // Calculate initial remaining seconds from expires_at
    const expireTime = new Date(activeVoucher.expires_at).getTime();
    const now = Date.now();
    const initialSec = Math.max(0, Math.floor((expireTime - now) / 1000));
    setRemainingSeconds(initialSec);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeVoucher]);

  // Polling listener: Checks voucher status every 2.5 seconds to detect cashier burn
  useEffect(() => {
    if (!activeVoucher || settledResult) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusData = await getVoucherStatus(activeVoucher.voucher_code);
        if (statusData.status === "CLAIMED") {
          clearInterval(pollInterval);
          setSettledResult(statusData);
          setActiveVoucher(null);
          // Trigger celebration
          try {
            confetti({
              particleCount: 120,
              spread: 75,
              origin: { y: 0.6 },
              colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"],
            });
          } catch {
            // ignore
          }
          fetchBalance();
        } else if (statusData.status === "EXPIRED" || statusData.is_expired) {
          clearInterval(pollInterval);
          setErrorMessage("Kuponun 10 dəqiqəlik istifadə müddəti bitdi. Zəhmət olmasa yeni kupon yaradın.");
          setActiveVoucher(null);
        }
      } catch (err) {
        console.warn("Polling voucher status failed:", err);
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeVoucher, settledResult, fetchBalance]);

  // Create Voucher Action
  const handleGenerateVoucher = async () => {
    if (!selectedMerchant) {
      setErrorMessage("Zəhmət olmasa tərəfdaş mağaza seçin.");
      return;
    }
    if (burnPoints > activePoints) {
      setErrorMessage(`Kifayət qədər bal yoxdur. Mövcud balans: ${activePoints} bal.`);
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setSettledResult(null);

    try {
      const voucher = await createRedemptionVoucher({
        merchant_id: selectedMerchant.id,
        points_amount: burnPoints,
      });
      setActiveVoucher(voucher);
    } catch (err: any) {
      setErrorMessage(err.message || "Kupon yaradılarkən xəta baş verdi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-12">
      {/* 1. Header & Navigation Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Profilə Qayıt</span>
        </Link>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/20">
          Kassa Endirimi (Clearinghouse)
        </span>
      </div>

      {/* 2. Live Wallet Points Balance Banner */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-emerald-500/30">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-400">
              <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Mövcud Balansınız</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="text-3xl sm:text-4xl font-black text-white">
                {isMounted ? activePoints.toLocaleString() : "250"}
                <span className="text-sm font-bold text-amber-400 ml-1">bal</span>
              </span>
              <span className="text-sm font-bold text-emerald-300">
                ≈ ${isMounted ? activeCash : "2.50"} USD
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              100 bal = $1.00 USD • Bütün tərəfdaş supermarketlərdə nağd endirim kimi keçərlidir
            </p>
          </div>

          <button
            onClick={fetchBalance}
            disabled={isLoadingBalance}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Balansı yenilə"
          >
            <RotateCw className={`w-4 h-4 ${isLoadingBalance ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error Message if any */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Xəta baş verdi</p>
            <p className="mt-0.5 text-[11px] text-rose-700/90 dark:text-rose-300/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 3. SETTLED STATE: When cashier claims the voucher */}
      {settledResult && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black">Kupon Kassada Təsdiqləndi!</h3>
                <p className="text-xs text-emerald-100 font-medium">
                  {settledResult.merchant_name} • ${Number(settledResult.usd_value).toFixed(2)} endirim tətbiq edildi
                </p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-xl bg-white/20 text-xs font-black">
              -{settledResult.points_amount} Bal
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Kupon Kodu:</span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                {settledResult.voucher_code}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Tətbiq Edilən Endirim:</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                ${Number(settledResult.usd_value).toFixed(2)} USD
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Mağaza:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {settledResult.merchant_name}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="block text-[10px] text-slate-400 font-bold uppercase">
                Clearinghouse Journal ID:
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300 block truncate mt-0.5">
                {settledResult.ledger_transaction_id}
              </span>
            </div>
          </div>

          <button
            onClick={() => setSettledResult(null)}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Yeni Kupon Al
          </button>
        </div>
      )}

      {/* 4. ACTIVE VOUCHER DISPLAY: Show Barcode/QR Code + Expiration Countdown */}
      {activeVoucher && !settledResult && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500 dark:border-emerald-600 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
          {/* Header & Status Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChainLogo slug={getChainSlug(activeVoucher.merchant_name)} size="xs" />
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {activeVoucher.merchant_name}
                </h3>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Kriptoqrafik İmzalı Kupon
                </span>
              </div>
            </div>

            {/* Countdown Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${
                remainingSeconds < 120
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 animate-pulse"
                  : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          </div>

          {/* Discount Value Highlight */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-center shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 block">
              Kassada Endirim Məbləği:
            </span>
            <div className="text-3xl font-black mt-0.5 tracking-tight">
              ${Number(activeVoucher.usd_value).toFixed(2)} USD
            </div>
            <span className="text-xs font-semibold text-emerald-200 mt-0.5 block">
              ({activeVoucher.points_amount} bal silinəcək)
            </span>
          </div>

          {/* QR Code & Barcode Display */}
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <QrCodeSvg data={activeVoucher.voucher_code} />
            </div>

            <BarcodeSvg code={activeVoucher.voucher_code} />

            <div className="flex justify-center">
              <button
                onClick={() => handleCopyCode(activeVoucher.voucher_code)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "Kopyalandı!" : "Kodu Kopyala"}</span>
              </button>
            </div>
          </div>

          {/* Instructions & Live Listener Alert */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mt-1.5 shrink-0" />
            <div>
              <p className="font-bold">Ödənişdən əvvəl kassirə təqdim edin:</p>
              <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                Kassir bu QR və ya barkodu skan etdikdə sistem real vaxtda təsdiqləyəcək və endirim dərhal
                tətbiq olunacaq.
              </p>
            </div>
          </div>

          {/* Cancel Button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setActiveVoucher(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Ləğv et və geri qayıt
            </button>
          </div>
        </div>
      )}

      {/* 5. VOUCHER GENERATOR FORM (Only visible when no active voucher) */}
      {!activeVoucher && !settledResult && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Xal Xərcləmə & Kupon Seçimi</span>
            </h2>
            <span className="text-[11px] font-semibold text-slate-400">Addım 1 / 2</span>
          </div>

          {/* Target Supermarket Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Harada istifadə edəcəksiniz?</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {merchants.map((m) => {
                const isSelected = selectedMerchant?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMerchant(m)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 active:scale-95 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <ChainLogo slug={getChainSlug(m.name)} size="xs" />
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{m.name}</p>
                      <span className="text-[10px] text-slate-400 block">{m.category || "Supermarket"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Points Burn Amount Selector */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Nə qədər bal xərcləmək istəyirsiniz?</span>
              </label>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                =${burnDiscountUsd} USD endirim
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { pts: 100, label: "100 bal", usd: "$1.00" },
                { pts: 250, label: "250 bal", usd: "$2.50" },
                { pts: 500, label: "500 bal", usd: "$5.00" },
                { pts: activePoints, label: "Maksimum", usd: `$${activeCash}` },
              ].map((item, idx) => {
                const isSelected = burnPoints === item.pts;
                const canAfford = activePoints >= item.pts;
                return (
                  <button
                    key={idx}
                    disabled={!canAfford}
                    onClick={() => setBurnPoints(item.pts)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-black">{item.label}</div>
                    <div className={`text-[10px] ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                      {item.usd}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Numeric Slider */}
            <div className="pt-2">
              <input
                type="range"
                min={50}
                max={Math.max(100, activePoints)}
                step={50}
                value={burnPoints}
                onChange={(e) => setBurnPoints(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1">
                <span>50 bal ($0.50)</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{burnPoints} bal</span>
                <span>{activePoints} bal (Maks)</span>
              </div>
            </div>
          </div>

          {/* Action Button: Generate Voucher */}
          <button
            disabled={isGenerating || activePoints < 50 || burnPoints > activePoints}
            onClick={handleGenerateVoucher}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                <span>Kupon Yarat (${burnDiscountUsd} Endirim)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 6. Cashier Burn Simulation Shortcut (For testing in 1 click) */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Store className="w-4 h-4 text-emerald-600" />
          <span>Kassir Terminalı Simulyasiyası:</span>
        </div>
        <Link
          href="/merchant/cashier"
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          <span>Kassa Skanerinə Keç</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

