"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Camera,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  Receipt as ReceiptIcon,
  Store,
  Coins,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  QrCode,
  Zap,
  Tag,
  Flame,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { submitReceipt } from "@/lib/api";
import { BrandCampaign, ReceiptSubmitResult } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";
import { useTranslation } from "@/lib/translations";

interface OfferReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: BrandCampaign | null;
}

interface SimulatedLineItem {
  raw_name: string;
  name: string;
  quantity: number;
  price: number;
  total_price: number;
}

export const OfferReceiptScannerModal: React.FC<OfferReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  campaign,
}) => {
  const { t } = useTranslation();
  const { userPoints, setPoints } = useSebEtStore();

  const [isScanning, setIsScanning] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ReceiptSubmitResult | null>(null);
  const [detectedBrandItems, setDetectedBrandItems] = useState<{
    count: number;
    items: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualQrText, setManualQrText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !campaign) return null;

  const targetKeywords = (campaign.target_sku_keywords || []).map((k) => k.toLowerCase().trim());
  const brandName = campaign.brand_name || "Sponsorlu Brend";
  const multiplier = campaign.multiplier || 5.0;

  const handleReset = () => {
    setIsScanning(false);
    setProcessingStatus(null);
    setScanResult(null);
    setDetectedBrandItems(null);
    setError(null);
    setManualQrText("");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Helper to run receipt evaluation through backend API
  const processReceiptData = async (
    merchantName: string,
    totalAmount: number,
    receiptNo: string,
    lineItems: SimulatedLineItem[],
    rawText: string
  ) => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);
    setDetectedBrandItems(null);

    try {
      // Step 1: Simulating QR reading
      setProcessingStatus("Fiskal QR kod oxunur və NÖŞ yoxlanılır...");
      await new Promise((r) => setTimeout(r, 600));

      // Step 2: Itemizing line items and matching brand keywords
      setProcessingStatus(`Çekdəki məhsullar təhlil edilir: ${brandName} axtarılır...`);
      await new Promise((r) => setTimeout(r, 700));

      // Detect matching items
      const matchedNames: string[] = [];
      let matchedCount = 0;

      for (const it of lineItems) {
        const itemLower = it.raw_name.toLowerCase();
        const isMatch = targetKeywords.some((kw) => itemLower.includes(kw));
        if (isMatch) {
          matchedNames.push(`${it.quantity}x ${it.name}`);
          matchedCount += it.quantity;
        }
      }

      // If no specific line items matched keywords, check rawText
      if (matchedCount === 0 && rawText) {
        const rawLower = rawText.toLowerCase();
        for (const kw of targetKeywords) {
          if (rawLower.includes(kw)) {
            matchedNames.push(`1x ${brandName}`);
            matchedCount = 1;
            break;
          }
        }
      }

      setDetectedBrandItems({
        count: matchedCount,
        items: matchedNames,
      });

      // Step 3: Submitting to clearinghouse backend
      setProcessingStatus("Sebet Ledger təsdiqlənir və multiplikator bal hesablanır...");
      const payload = {
        merchant_name: merchantName,
        total_amount: totalAmount,
        receipt_number: receiptNo,
        terminal_id: "POS-BAKU-01",
        earn_rate: 0.03,
        raw_ocr_text: rawText,
        line_items: lineItems,
      };

      const result = await submitReceipt(payload);
      setScanResult(result);

      if (result.success && result.points_awarded > 0) {
        // Update user's live balance in global store
        setPoints(userPoints + result.points_awarded);

        // Celebration confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10B981", "#F59E0B", "#34D399", "#FBBF24"],
        });
      }
    } catch (err: any) {
      setError(err.message || "Qəbz emal edilərkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setIsScanning(false);
      setProcessingStatus(null);
    }
  };

  // 1-Click Simulated Receipt Scenarios
  const handleRunPreset = (presetType: "brand" | "partial" | "general") => {
    const timestamp = Date.now().toString().slice(-6);

    if (presetType === "brand") {
      // Guaranteed high-value match with 2x brand items
      const items: SimulatedLineItem[] = [
        {
          raw_name: `${brandName} Original 500ml`,
          name: `${brandName} Original 500ml`,
          quantity: 2,
          price: 2.5,
          total_price: 5.0,
        },
        {
          raw_name: "Azərduz Yodlaşdırılmış Duz 1kg",
          name: "Azərduz Yodlaşdırılmış Duz 1kg",
          quantity: 1,
          price: 1.2,
          total_price: 1.2,
        },
        {
          raw_name: "Çörək Zavod No1",
          name: "Çörək Zavod No1",
          quantity: 2,
          price: 0.65,
          total_price: 1.3,
        },
      ];

      processReceiptData(
        "Bravo",
        50.0,
        `FISKAL-BRV-${timestamp}`,
        items,
        `BRAVO SUPERMARKET\nVÖEN: 1401502441\nFISKAL ID: NÖŞ-992014-${timestamp}\n2x ${brandName} Original 500ml 5.00 AZN\nYEKUN: 50.00 AZN\nhttps://monitoring.e-kassa.gov.az/v1/receipts?id=${timestamp}`
      );
    } else if (presetType === "partial") {
      // 1x item match
      const items: SimulatedLineItem[] = [
        {
          raw_name: `${brandName} Təbii Məhsul`,
          name: `${brandName} Təbii Məhsul`,
          quantity: 1,
          price: 3.5,
          total_price: 3.5,
        },
        {
          raw_name: "Qarabağ Düyü 900g",
          name: "Qarabağ Düyü 900g",
          quantity: 1,
          price: 4.8,
          total_price: 4.8,
        },
      ];

      processReceiptData(
        "Araz",
        30.0,
        `FISKAL-ARZ-${timestamp}`,
        items,
        `ARAZ SUPERMARKET\nVÖEN: 1302819441\n1x ${brandName} Təbii Məhsul 3.50 AZN\nYEKUN: 30.00 AZN`
      );
    } else {
      // Generic receipt with no brand match
      const items: SimulatedLineItem[] = [
        {
          raw_name: "Meyvə Şirəsi Təbii 1L",
          name: "Meyvə Şirəsi Təbii 1L",
          quantity: 2,
          price: 2.1,
          total_price: 4.2,
        },
      ];

      processReceiptData(
        "OBA",
        15.0,
        `FISKAL-OBA-${timestamp}`,
        items,
        `OBA MARKET\nVÖEN: 1700912441\n2x Meyvə Şirəsi Təbii 1L 4.20 AZN\nYEKUN: 15.00 AZN`
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate OCR text parsing from image
    handleRunPreset("brand");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  Fiskal QR & Çek Skaneri
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  {multiplier}x Bal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {brandName} kampaniyası üçün qəbzi skan edin
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Active Target Brand Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {campaign.banner_image_url ? (
                <img
                  src={campaign.banner_image_url}
                  alt={brandName}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
                  {brandName[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                  {brandName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-1 mt-0.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Hədəf SKU:</span>
                  {targetKeywords.slice(0, 3).map((kw) => (
                    <span key={kw} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{multiplier}x BONUS</span>
              </span>
            </div>
          </div>

          {/* VIEW A: SUCCESS RESULT CELEBRATION */}
          {scanResult && scanResult.success && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800/95 border-2 border-emerald-500 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Fiskal Qəbz Təsdiqləndi!
                    </h3>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      Ledger hesabatı tamamlandı
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {scanResult.receipt_id.slice(0, 8)}
                </span>
              </div>

              {/* Detected Products Breakdown */}
              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Aşkar Edilən Sponsor Məhsullar:</span>
                  </span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg shadow-2xs">
                    {detectedBrandItems?.count || 1} ədəd
                  </span>
                </div>

                {detectedBrandItems?.items && detectedBrandItems.items.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-emerald-200/50 dark:border-slate-800">
                    {detectedBrandItems.items.map((itemName, idx) => (
                      <div key={idx} className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>{itemName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Points Calculation Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Ümumi Qazanılan Bal</span>
                    </span>
                    <div className="text-3xl font-black text-white mt-0.5 flex items-baseline gap-1.5">
                      <span>+{scanResult.points_awarded}</span>
                      <span className="text-xs font-bold text-amber-400">BAL</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1 text-xs">
                    <div className="text-slate-300">
                      Əsas Qəbz: <span className="font-bold text-white">+{scanResult.base_points || 150}</span>
                    </div>
                    <div className="text-amber-400 font-black">
                      {brandName} {multiplier}x Bonusu:{" "}
                      <span>+{scanResult.bonus_points || (scanResult.points_awarded - (scanResult.base_points || 150))}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Hesabınızdakı yeni balans:</span>
                  <span className="font-extrabold text-white text-xs">
                    {userPoints} Bal (~{(userPoints * 0.01).toFixed(2)} ₼)
                  </span>
                </div>
              </div>

              {/* Done Button */}
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md"
              >
                Tamamlandı
              </button>
            </div>
          )}

          {/* VIEW B: ACTIVE SCANNING OR IDLE STATE */}
          {!scanResult && (
            <>
              {/* Simulated Camera Scanner Viewfinder */}
              <div className="relative w-full h-48 rounded-3xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center border-2 border-emerald-500/50 shadow-inner">
                {/* Viewfinder Target corners */}
                <div className="absolute inset-5 border-2 border-dashed border-emerald-400/60 rounded-2xl pointer-events-none flex items-center justify-center">
                  {/* Laser line animation */}
                  <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-scan-laser" />
                </div>

                {isScanning ? (
                  <div className="z-10 text-center px-4 space-y-2 animate-in fade-in">
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto" />
                    <p className="text-xs font-bold text-emerald-300">
                      {processingStatus || "Fiskal qəbz emal edilir..."}
                    </p>
                  </div>
                ) : (
                  <div className="z-10 text-center px-4 space-y-2">
                    <Camera className="w-9 h-9 text-emerald-400 mx-auto animate-pulse" />
                    <p className="text-xs font-bold text-emerald-100">
                      Fiskal kassa çekinin altındakı QR kodu kadr daxilində saxlayın
                    </p>
                    <p className="text-[10px] text-emerald-300/80">
                      Sistem avtomatik olaraq {brandName} məhsullarını aşkar edəcək
                    </p>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action 1: Upload File */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Çek Şəkli Yüklə</span>
                </button>

                <button
                  onClick={() => handleRunPreset("brand")}
                  disabled={isScanning}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR Kodu Oxu</span>
                </button>
              </div>

              {/* Action 2: Quick 1-Click Presentation Test Scenarios */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Təqdimat Üçün Sürətli Test Çekləri:</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRunPreset("brand")}
                    disabled={isScanning}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-left border border-slate-200/80 dark:border-slate-700/80 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                        Bravo Çeki (2x {brandName})
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                        +{multiplier}x Bal
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Cəmi $50.00 • 2 ədəd {brandName} məhsulu
                    </p>
                  </button>

                  <button
                    onClick={() => handleRunPreset("partial")}
                    disabled={isScanning}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-left border border-slate-200/80 dark:border-slate-700/80 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                        Araz Çeki (1x {brandName})
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                        +{multiplier}x Bal
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Cəmi $30.00 • 1 ədəd {brandName} məhsulu
                    </p>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
