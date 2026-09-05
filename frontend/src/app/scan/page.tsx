"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  FileText,
  Store,
  Coins,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { uploadReceipt, getSampleReceipts, parseSampleReceipt } from "@/lib/api";
import { ParsedReceipt, SampleReceipt } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";

function getChainSlug(name?: string | null): string {
  const n = (name || "").toLowerCase();
  if (n.includes("bravo")) return "bravo";
  if (n.includes("araz")) return "araz";
  if (n.includes("oba")) return "oba";
  if (n.includes("bazarstore")) return "bazarstore";
  return "bravo";
}

export default function ScanReceiptPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedReceipt | null>(null);
  const [samples, setSamples] = useState<SampleReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addPoints, userPoints } = useSebEtStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function loadSamples() {
      try {
        const sampleData = await getSampleReceipts();
        setSamples(sampleData);
      } catch (err) {
        console.error("Failed to load sample receipts", err);
      }
    }
    loadSamples();
  }, []);

  const triggerCelebration = (points: number) => {
    addPoints(points);
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b", "#ec4899"],
      });
    } catch {
      // ignore
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setParsedResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadReceipt(formData);
      setParsedResult(result);
      triggerCelebration(result.sebet_points_awarded || 50);
    } catch (err: any) {
      setError(err.message || "Qəbz emal edilə bilmədi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSampleClick = async (sampleId: string) => {
    setIsProcessing(true);
    setError(null);
    setParsedResult(null);

    try {
      const result = await parseSampleReceipt(sampleId);
      setParsedResult(result);
      triggerCelebration(result.sebet_points_awarded || 50);
    } catch (err: any) {
      setError(err.message || "Nümunə qəbz emal edilə bilmədi.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Fiskal Qəbz Skaneri</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-800/50">
              <Sparkles className="w-3 h-3 text-amber-500" />
              +50 Xal
            </span>
          </h1>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-200">
            <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{isMounted ? userPoints : 250}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">xal</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          "ƏDV Geri Al" qəbzlərini yükləyin, rəf qiymətlərini yeniləyin və Sebet xalları qazanın!
        </p>
      </div>

      {/* Camera / Upload Box */}
      <div className="p-6 rounded-3xl bg-gradient-to-b from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20 border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
        {/* Laser scanner animation while processing */}
        {isProcessing && (
          <div className="absolute inset-0 bg-emerald-950/30 backdrop-blur-xs flex flex-col items-center justify-center z-10">
            <div className="absolute left-4 right-4 h-1 bg-emerald-400 shadow-[0_0_15px_#34d399] animate-scan-laser" />
            <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-xl flex flex-col items-center gap-2 border border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Qəbz OCR analizi aparılır...
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                VÖEN, Obyekt Kodu və məhsul sətirləri oxunur
              </div>
            </div>
          </div>
        )}

        <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
          <Camera className="w-7 h-7" />
        </div>

        <div>
          <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
            Qəbzin şəklini çəkin və ya fayl seçin
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-0.5">
            Kassadan verilən fiskal çekin aydın şəklini yükləyin (JPEG / PNG)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex gap-2 pt-1">
          <button
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4" />
            <span>Kamera / Fayl Seç</span>
          </button>
        </div>
      </div>

      {/* Preset 1-Click Baku Sample Receipts */}
      <div className="space-y-2">
        <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          Dərhal Test Edin (Hazır Bakı Qəbzləri):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {samples.map((s) => (
            <button
              key={s.id}
              disabled={isProcessing}
              onClick={() => handleSampleClick(s.id)}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 hover:bg-emerald-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition-all group shadow-2xs active:scale-95"
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <ChainLogo slug={getChainSlug(s.store_name)} size="xs" />
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate">
                    {s.store_name}
                  </span>
                </div>
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                  {s.total_amount.toFixed(2)} ₼
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1 font-mono">
                <span>VÖEN: {s.voen}</span>
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                <span>Avtomatik oxut</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Extracted Receipt Result */}
      {parsedResult && (
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-600 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Success Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <div>
                <div className="text-xs font-black">
                  Qəbz Uğurla Təsdiqləndi!
                </div>
                <div className="text-[10px] text-emerald-100">
                  {parsedResult.store_name} filialı tanındı
                </div>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-white/20 backdrop-blur-md text-xs font-black flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              +{parsedResult.sebet_points_awarded} Xal
            </div>
          </div>

          {/* Receipt Metadata Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">
                Market Filialı:
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ChainLogo slug={getChainSlug(parsedResult.store_name)} size="xs" />
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {parsedResult.store_name || "Bakı Filialı"}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">
                Ümumi Məbləğ:
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                {(parsedResult.total_amount || 0).toFixed(2)} AZN
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">
                VÖEN:
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {parsedResult.voen || "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">
                Obyekt Kodu:
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {parsedResult.obyekt_kodu || "—"}
              </span>
            </div>
          </div>

          {/* Extracted Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Tanınan Məhsullar ({parsedResult.items.length})</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-bold border border-emerald-100 dark:border-emerald-900/40">
                Rəf Qiymətinə Əlavə Edildi
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-850/50">
              {parsedResult.items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {it.matched_product_name || it.raw_name}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      {it.raw_name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {it.total_price.toFixed(2)} ₼
                    </div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500">
                      {it.quantity} × {it.unit_price.toFixed(2)} ₼
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ƏDV Geri Al Habit Explanation Banner */}
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">ƏDV Geri Al ilə birgə qazanın:</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                Bu qəbzi Birbank və ya edvgerial.az-da skan etməzdən əvvəl Sebet-ə yükləməklə həm ƏDV keşbekinizi alırsınız, həm də Sebet xalları toplayırsınız!
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

