"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Store,
  QrCode,
  Barcode,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  DollarSign,
  Coins,
  Receipt,
  RotateCw,
  Search,
  Check,
  Sliders,
  Layers,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  getAvailableMerchants,
  previewVoucher,
  claimVoucher,
  createRedemptionVoucher,
} from "@/lib/api";
import {
  MerchantChain,
  VoucherPreviewResult,
  ClaimVoucherResult,
} from "@/lib/types";
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

export default function CashierBurnPage() {
  const [isMounted, setIsMounted] = useState(false);

  // Active Cashier Merchant Session
  const [merchants, setMerchants] = useState<MerchantChain[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantChain | null>(null);
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState(false);

  // Scan & Lookup State
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<VoucherPreviewResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Claim State
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedReceipt, setClaimedReceipt] = useState<ClaimVoucherResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // 1-Click Fast Simulation State
  const [isGeneratingTestVoucher, setIsGeneratingTestVoucher] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function loadStores() {
      try {
        const list = await getAvailableMerchants();
        setMerchants(list);

        const savedId = localStorage.getItem("sebet_active_merchant_id");
        if (savedId && list.some((m) => m.id === savedId)) {
          setSelectedMerchant(list.find((m) => m.id === savedId) || list[0]);
        } else if (list.length > 0) {
          setSelectedMerchant(list[0]);
        }
      } catch (err) {
        console.warn("Could not load merchants:", err);
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
  }, []);

  const handleSelectStore = (m: MerchantChain) => {
    setSelectedMerchant(m);
    localStorage.setItem("sebet_active_merchant_id", m.id);
    setIsStoreSwitcherOpen(false);
    // Reset preview if store changed
    setPreviewResult(null);
    setClaimedReceipt(null);
  };

  // Preview & Validate Voucher Action
  const handlePreviewVoucher = async (codeToLookup?: string) => {
    const code = (codeToLookup || voucherCodeInput).trim().toUpperCase();
    if (!code) return;
    if (!selectedMerchant) {
      setLookupError("Zəhmət olmasa aktiv kassa mağazasını seçin.");
      return;
    }

    setIsPreviewLoading(true);
    setLookupError(null);
    setClaimError(null);
    setClaimedReceipt(null);

    try {
      const data = await previewVoucher(code, selectedMerchant.id);
      setPreviewResult(data);
      setVoucherCodeInput(code);
    } catch (err: any) {
      setLookupError(err.message || "Kupon tapılmadı və ya etibarsızdır.");
      setPreviewResult(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Confirm & Burn (Claim Voucher) Action
  const handleClaimVoucher = async () => {
    if (!previewResult || !selectedMerchant) return;

    setIsClaiming(true);
    setClaimError(null);

    try {
      const receipt = await claimVoucher(
        {
          voucher_code: previewResult.voucher_code,
          cashier_notes: `Kassa Terminalı #${Math.floor(10 + Math.random() * 90)} checkout`,
        },
        selectedMerchant.id
      );

      setClaimedReceipt(receipt);
      setPreviewResult(null);

      // Trigger celebration
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10b981", "#3b82f6", "#f59e0b", "#ec4899"],
        });
      } catch {
        // ignore
      }
    } catch (err: any) {
      setClaimError(err.message || "Kupon təsdiqlənərkən xəta baş verdi.");
    } finally {
      setIsClaiming(false);
    }
  };

  // 1-Click Fast Simulation: Generate a 300 bal ($3.00) voucher for this store and preview it
  const handleSimulateTestVoucher = async () => {
    if (!selectedMerchant) return;
    setIsGeneratingTestVoucher(true);
    setLookupError(null);
    setClaimError(null);
    setClaimedReceipt(null);

    try {
      const newVoucher = await createRedemptionVoucher({
        merchant_id: selectedMerchant.id,
        points_amount: 300,
      });

      setVoucherCodeInput(newVoucher.voucher_code);
      // Immediately preview it
      await handlePreviewVoucher(newVoucher.voucher_code);
    } catch (err: any) {
      setLookupError(err.message || "Test kuponu yaradıla bilmədi.");
    } finally {
      setIsGeneratingTestVoucher(false);
    }
  };

  // Reset Scanner View
  const handleReset = () => {
    setVoucherCodeInput("");
    setPreviewResult(null);
    setClaimedReceipt(null);
    setLookupError(null);
    setClaimError(null);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-12">
      {/* 1. Header & Navigation Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/merchant/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard-a Qayıt</span>
        </Link>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/20">
          Kassir Portalı (In-Store POS)
        </span>
      </div>

      {/* 2. Active Cashier Store Indicator & Switcher */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {selectedMerchant?.name || "Kassa Mağazası"}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                Kassa Terminalı #04
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tenant ID: {selectedMerchant?.id.slice(0, 8)}... • Avtorizasiyalı
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsStoreSwitcherOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Dəyiş</span>
        </button>
      </div>

      {/* 3. SETTLED RECEIPT VIEW: Instant Double-Entry Clearinghouse Confirmation */}
      {claimedReceipt && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black">Kupon Uğurla Silindi & Ödənildi!</h3>
                <p className="text-xs text-emerald-100 font-medium">
                  {claimedReceipt.merchant_name} • Kassa çeki hazırlandı
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-white/20 text-xs font-black">
              CLAIMED
            </span>
          </div>

          {/* Breakdown receipt card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <span className="font-bold text-slate-400 uppercase text-[10px]">Kupon Kodu:</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                {claimedReceipt.voucher_code}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span>Müştəriyə Tətbiq Edilən Endirim (Ümumi):</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                ${Number(claimedReceipt.gross_discount_usd).toFixed(2)} USD
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span>Platforma Xidmət Komissiyası (5%):</span>
              <span className="font-semibold text-slate-500">
                -${Number(claimedReceipt.platform_servicing_fee_usd).toFixed(3)} USD
              </span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-bold">
              <span>Mağazaya Ödəniləcək Xalis Məbləğ:</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                ${Number(claimedReceipt.merchant_net_reimbursement_usd).toFixed(3)} USD
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="block text-[10px] text-slate-400 font-bold uppercase">
                Clearinghouse Ledger Tx UUID:
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300 block truncate mt-0.5">
                {claimedReceipt.ledger_transaction_id}
              </span>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Növbəti Müştərinin Kuponunu Skan Et
          </button>
        </div>
      )}

      {/* 4. PRE-BURN SUMMARY CARD: Shows inspection before actual deduction */}
      {previewResult && !claimedReceipt && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Kupon Məlumatları (Təsdiqdən Əvvəl)
              </h3>
            </div>

            {/* Scope Match Indicator */}
            {previewResult.is_merchant_match ? (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mağaza Uyğundur
              </span>
            ) : (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Fərqli Mağaza
              </span>
            )}
          </div>

          {/* Value Display */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Kupon Kodu:</span>
              <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                {previewResult.voucher_code}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Müştəri:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {previewResult.user_name}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Təyinat Mağazası:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {previewResult.merchant_name}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="font-bold">Müştəriyə Endirim:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                ${Number(previewResult.gross_discount_usd).toFixed(2)} USD
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span>Platforma Xidmət Komissiyası (5%):</span>
              <span className="font-semibold text-slate-500">
                -${Number(previewResult.platform_servicing_fee_usd).toFixed(3)} USD
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex justify-between items-center font-bold">
              <span>Kassaya Ödəniləcək Xalis:</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                ${Number(previewResult.merchant_net_reimbursement_usd).toFixed(3)} USD
              </span>
            </div>
          </div>

          {/* Competitor Mismatch Warning if scoped to another store */}
          {!previewResult.is_merchant_match && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p>
                <strong>Diqqət:</strong> Bu kupon <strong>{previewResult.merchant_name}</strong> şəbəkəsi
                üçün buraxılmışdır. Sizin mağazanız tərəfindən təsdiqlənə bilməz (HTTP 403 Forbidden).
              </p>
            </div>
          )}

          {/* Claim Error if any */}
          {claimError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p>{claimError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={isClaiming}
              className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Ləğv et
            </button>
            <button
              onClick={handleClaimVoucher}
              disabled={isClaiming || !previewResult.is_valid || !previewResult.is_merchant_match}
              className="flex-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClaiming ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Təsdiqlə və Tətbiq Et</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 5. SCANNER / INPUT FORM: Enter or scan voucher code */}
      {!claimedReceipt && !previewResult && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span>Müştəri Kuponunun Skanı</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold">QR / Barkod Daxil Et</span>
          </div>

          {/* Code Input Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Kupon Kodunu Daxil Edin və ya Skanerlə Oxudun:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Məs: SEBET-VCH-A1B2C3D4"
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePreviewVoucher();
                }}
                className="flex-1 bg-slate-50 dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono text-sm tracking-wider uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                disabled={isPreviewLoading || !voucherCodeInput.trim()}
                onClick={() => handlePreviewVoucher()}
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPreviewLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Yoxla</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Lookup Error if any */}
          {lookupError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p>{lookupError}</p>
            </div>
          )}

          {/* 1-Click Interactive Test Button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Dərhal Test Edin (1-Kliklə Simulyasiya):
            </label>
            <button
              disabled={isGeneratingTestVoucher}
              onClick={handleSimulateTestVoucher}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 hover:from-emerald-100 hover:to-teal-100 border border-emerald-300 dark:border-emerald-800 text-left transition-all flex items-center justify-between group active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 group-hover:rotate-12 transition-transform" />
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                    Test: 300 Ballıq ($3.00) Kupon Yarat & Yoxla
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Avtomatik olaraq {selectedMerchant?.name} üçün kupon generasiya edir
                  </div>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Store Switcher Modal */}
      {isStoreSwitcherOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <span>Kassa Mağazası Seçimi</span>
              </h3>
              <button
                onClick={() => setIsStoreSwitcherOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Tenant Scoping (X-Merchant-Id) tələbini yoxlamaq üçün kassir mağazasını dəyişin:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {merchants.map((m) => {
                const isSelected = m.id === selectedMerchant?.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectStore(m)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChainLogo slug={getChainSlug(m.name)} size="xs" />
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
          </div>
        </div>
      )}
    </div>
  );
}

