"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  ShieldAlert,
  AlertCircle,
  Clock,
  RotateCw,
  Lock,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  submitReceipt,
  getLedgerBalance,
  uploadReceipt,
  getSampleReceipts,
  parseSampleReceipt,
} from "@/lib/api";
import {
  ReceiptSubmitResult,
  LedgerBalanceResponse,
  ParsedReceipt,
  SampleReceipt,
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

type OutcomeType = "NONE" | "APPROVED" | "REJECTED" | "FLAGGED_REVIEW";

interface ApprovedDetails {
  receiptId: string;
  merchantName: string;
  totalAmount: number;
  pointsAwarded: number;
  ledgerTransactionId?: string | null;
  receiptNumber?: string;
  purchasedAt: string;
  message: string;
}

interface RejectedDetails {
  reason: string;
  ruleTriggered?: string;
  statusCode?: number;
  attemptedAmount?: number;
}

interface FlaggedDetails {
  receiptId: string;
  merchantName: string;
  totalAmount: number;
  reason: string;
  receiptNumber?: string;
  purchasedAt: string;
}

export default function ScanReceiptPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState(
    "Qəbz OCR və anti-fraud yoxlanışı aparılır..."
  );

  // Outcome States
  const [outcome, setOutcome] = useState<OutcomeType>("NONE");
  const [approvedData, setApprovedData] = useState<ApprovedDetails | null>(null);
  const [rejectedData, setRejectedData] = useState<RejectedDetails | null>(null);
  const [flaggedData, setFlaggedData] = useState<FlaggedDetails | null>(null);

  // Fallback / legacy OCR parsed result for sample receipts
  const [parsedResult, setParsedResult] = useState<ParsedReceipt | null>(null);
  const [samples, setSamples] = useState<SampleReceipt[]>([]);

  // Live Ledger Balance
  const [ledgerBalance, setLedgerBalance] = useState<LedgerBalanceResponse | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addPoints, setPoints, userPoints } = useSebEtStore();

  const fetchLiveBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      const bal = await getLedgerBalance();
      setLedgerBalance(bal);
      setPoints(bal.points_balance);
    } catch (err) {
      console.warn("Could not fetch ledger balance directly:", err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [setPoints]);

  useEffect(() => {
    setIsMounted(true);
    fetchLiveBalance();

    async function loadSamples() {
      try {
        const sampleData = await getSampleReceipts();
        setSamples(sampleData);
      } catch (err) {
        console.error("Failed to load sample receipts", err);
      }
    }
    loadSamples();
  }, [fetchLiveBalance]);

  const triggerCelebration = (points: number) => {
    addPoints(points);
    try {
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"],
      });
    } catch {
      // ignore
    }
  };

  const resetOutcome = () => {
    setOutcome("NONE");
    setApprovedData(null);
    setRejectedData(null);
    setFlaggedData(null);
    setParsedResult(null);
  };

  // -------------------------------------------------------------
  // Real File Upload Handler (Base64 + Hash + Deduplication submit)
  // -------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatusText("Şəkil analizi və kriptoqrafik heş hesablanır...");
    resetOutcome();

    try {
      // 1. Read file as ArrayBuffer to compute deterministic SHA-256 hash
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const imageHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // 2. Read as Base64 for OCR / storage
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.includes(",") ? res.split(",")[1] : res);
        };
        reader.readAsDataURL(file);
      });
      const imageBase64 = await base64Promise;

      setProcessingStatusText("Anti-fraud yoxlanışı və loyallıq qeydiyyatı...");

      // 3. Submit through deduplication & anti-fraud clearinghouse
      const randomReceiptNum = `RCPT-${Math.floor(100000 + Math.random() * 900000)}`;
      const result: ReceiptSubmitResult = await submitReceipt({
        merchant_name: "Bravo Supermarket",
        total_amount: 45.80,
        receipt_number: randomReceiptNum,
        image_hash: imageHash,
        image_base64: imageBase64,
        purchased_at: new Date().toISOString(),
      });

      if (result.status === "APPROVED") {
        setOutcome("APPROVED");
        setApprovedData({
          receiptId: result.receipt_id,
          merchantName: "Bravo Supermarket",
          totalAmount: Number(result.total_amount || 45.80),
          pointsAwarded: result.points_awarded || 137,
          ledgerTransactionId: result.ledger_transaction_id,
          receiptNumber: randomReceiptNum,
          purchasedAt: new Date().toISOString(),
          message: result.message,
        });
        triggerCelebration(result.points_awarded || 137);
        fetchLiveBalance();
      } else if (result.status === "FLAGGED_REVIEW" || result.is_flagged) {
        setOutcome("FLAGGED_REVIEW");
        setFlaggedData({
          receiptId: result.receipt_id,
          merchantName: "Bravo Supermarket",
          totalAmount: Number(result.total_amount || 45.80),
          reason:
            result.rejection_reason ||
            "Kassa terminalında şübhəli əməliyyat aşkarlandı. Qəbz auditor yoxlanışına göndərildi.",
          receiptNumber: randomReceiptNum,
          purchasedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setOutcome("REJECTED");
      setRejectedData({
        reason: err.message || "Qəbz saxtakarlıq qaydalarına uyğun gəlmədiyi üçün rədd edildi.",
        statusCode: 400,
        attemptedAmount: 45.80,
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // -------------------------------------------------------------
  // Preset Simulation Scenarios for 1-Click Interactive Verification
  // -------------------------------------------------------------

  // Scenario 1: Clean $50 Bravo Receipt (Approved -> Confetti + Points)
  const handleTestCleanEarn = async () => {
    setIsProcessing(true);
    setProcessingStatusText("Təmiz qəbz emal edilir ($50.00 Bravo)...");
    resetOutcome();

    try {
      const receiptNo = `BRV-${Math.floor(100000 + Math.random() * 900000)}`;
      const cleanHash = `clean-img-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const result: ReceiptSubmitResult = await submitReceipt({
        merchant_name: "Bravo Supermarket",
        total_amount: 50.00,
        receipt_number: receiptNo,
        image_hash: cleanHash,
        purchased_at: new Date().toISOString(),
      });

      setOutcome("APPROVED");
      setApprovedData({
        receiptId: result.receipt_id,
        merchantName: "Bravo Supermarket",
        totalAmount: 50.00,
        pointsAwarded: result.points_awarded,
        ledgerTransactionId: result.ledger_transaction_id,
        receiptNumber: receiptNo,
        purchasedAt: new Date().toISOString(),
        message: result.message,
      });

      triggerCelebration(result.points_awarded);
      fetchLiveBalance();
    } catch (err: any) {
      setOutcome("REJECTED");
      setRejectedData({
        reason: err.message || "Gözlənilməz xəta baş verdi.",
        statusCode: 400,
        attemptedAmount: 50.00,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Scenario 2: Duplicate Image Rejection (409 Conflict)
  const handleTestDuplicateRejection = async () => {
    setIsProcessing(true);
    setProcessingStatusText("Dublikat şəklin yoxlanışı simulyasiya olunur...");
    resetOutcome();

    try {
      // Deterministic identical image hash submitted twice
      const staticDupHash = `dup-sample-fixed-${Date.now().toString().slice(0, 8)}`;
      const receiptNo = `DUP-${Math.floor(100000 + Math.random() * 900000)}`;

      // First submission primes the DB
      try {
        await submitReceipt({
          merchant_name: "Bravo Supermarket",
          total_amount: 32.50,
          receipt_number: receiptNo,
          image_hash: staticDupHash,
          purchased_at: new Date().toISOString(),
        });
      } catch {
        // If already primed, proceed to trigger duplicate
      }

      setProcessingStatusText("Eyni şəklin təkrar yüklənməsi yoxlanılır (60 günlük pəncərə)...");

      // Second submission triggers HTTP 409 Conflict (Duplicate Image)
      await submitReceipt({
        merchant_name: "Bravo Supermarket",
        total_amount: 32.50,
        receipt_number: `DUP-TRY2-${Math.floor(100000 + Math.random() * 900000)}`,
        image_hash: staticDupHash,
        purchased_at: new Date().toISOString(),
      });

      // If somehow not rejected
      setOutcome("APPROVED");
      fetchLiveBalance();
    } catch (err: any) {
      setOutcome("REJECTED");
      setRejectedData({
        reason:
          err.message ||
          "Duplicate receipt image detected within 60 days window (Təkrar qəbz aşkarlandı).",
        ruleTriggered: "DUPLICATE_IMAGE_60D",
        statusCode: 409,
        attemptedAmount: 32.50,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Scenario 3: 24h Spend Ceiling Velocity Limit (400 Bad Request)
  const handleTestVelocityLimit = async () => {
    setIsProcessing(true);
    setProcessingStatusText("24 saatlıq $500 sürət limiti yoxlanılır...");
    resetOutcome();

    try {
      const receiptNo = `VEL-${Math.floor(100000 + Math.random() * 900000)}`;
      const velHash = `vel-hash-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      // Attempting $501.00 purchase exceeds the $500.00 cumulative 24h ceiling
      await submitReceipt({
        merchant_name: "Bravo Supermarket",
        total_amount: 501.00,
        receipt_number: receiptNo,
        image_hash: velHash,
        purchased_at: new Date().toISOString(),
      });

      // If not rejected
      setOutcome("APPROVED");
      fetchLiveBalance();
    } catch (err: any) {
      setOutcome("REJECTED");
      setRejectedData({
        reason:
          err.message ||
          "Velocity limit exceeded: cumulative receipts exceed $500.00 limit within 24 hours.",
        ruleTriggered: "VELOCITY_DAILY_SPEND_500",
        statusCode: 400,
        attemptedAmount: 501.00,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Scenario 4: Terminal Anomaly / Sweethearting (Flagged Review Queue)
  const handleTestTerminalAnomaly = async () => {
    setIsProcessing(true);
    setProcessingStatusText("Kassa terminalı toqquşması simulyasiya edilir...");
    resetOutcome();

    try {
      const terminalId = `POS-BAKU-LANE-${Date.now().toString().slice(-4)}`;
      const otherUserUuid = `00000000-0000-0000-0000-${Math.floor(
        100000000000 + Math.random() * 900000000000
      )}`;
      const now = new Date();

      // Step 1: User 1 submits from this terminal
      await submitReceipt({
        user_id: otherUserUuid,
        merchant_name: "Bravo Supermarket",
        total_amount: 22.00,
        receipt_number: `ANOM-U1-${Math.floor(100000 + Math.random() * 900000)}`,
        terminal_id: terminalId,
        image_hash: `anom-u1-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        purchased_at: now.toISOString(),
      });

      setProcessingStatusText("Eyni terminaldan qısa müddətdə 2-ci istifadəçi qəbzi yoxlanılır...");

      // Step 2: Current user submits from the SAME terminal within ±2 minutes
      const result: ReceiptSubmitResult = await submitReceipt({
        merchant_name: "Bravo Supermarket",
        total_amount: 38.00,
        receipt_number: `ANOM-U2-${Math.floor(100000 + Math.random() * 900000)}`,
        terminal_id: terminalId,
        image_hash: `anom-u2-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        purchased_at: new Date(now.getTime() + 15000).toISOString(),
      });

      if (result.status === "FLAGGED_REVIEW" || result.is_flagged) {
        setOutcome("FLAGGED_REVIEW");
        setFlaggedData({
          receiptId: result.receipt_id,
          merchantName: "Bravo Supermarket",
          totalAmount: 38.00,
          reason:
            result.rejection_reason ||
            "Sweethearting / terminal anomaly detected: multiple distinct users submitted from the same terminal within ±2 minutes.",
          receiptNumber: "ANOM-U2",
          purchasedAt: new Date().toISOString(),
        });
      } else {
        setOutcome("APPROVED");
      }
    } catch (err: any) {
      setOutcome("REJECTED");
      setRejectedData({
        reason: err.message || "Gözlənilməz xəta baş verdi.",
        statusCode: 400,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Sample Receipt OCR Handler
  const handleSampleClick = async (sampleId: string) => {
    setIsProcessing(true);
    setProcessingStatusText("Nümunə Bakı qəbzi OCR analizi aparılır...");
    resetOutcome();

    try {
      const result = await parseSampleReceipt(sampleId);
      setParsedResult(result);
      triggerCelebration(result.sebet_points_awarded || 50);
      fetchLiveBalance();
    } catch (err: any) {
      setOutcome("REJECTED");
      setRejectedData({
        reason: err.message || "Nümunə qəbz emal edilə bilmədi.",
        statusCode: 400,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Current user balance metrics
  const activePoints = ledgerBalance ? ledgerBalance.points_balance : userPoints;
  const cashEquivalent = (activePoints / 100).toFixed(2);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* 1. Live Wallet Balance Banner */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-emerald-500/30">
        {/* Subtle background circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
                Sebet Loyallıq Balansı
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Ledger Təsdiqli
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-3">
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                {isMounted ? activePoints.toLocaleString() : "250"}
                <span className="text-lg font-bold text-amber-400 ml-1.5">bal</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-emerald-300">
                ≈ ${isMounted ? cashEquivalent : "2.50"} USD
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-1">
              Valyuta məzənnəsi: <strong>100 bal = $1.00 USD</strong> • Hər $50 alış-verişə 150 bal (3%)
            </p>
          </div>

          <button
            onClick={fetchLiveBalance}
            disabled={isLoadingBalance}
            className="self-start sm:self-center px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white flex items-center gap-2 backdrop-blur-md border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Balansı yenilə"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingBalance ? "animate-spin" : ""}`} />
            <span>{isLoadingBalance ? "Yenilənir..." : "Yenilə"}</span>
          </button>
        </div>
      </div>

      {/* 2. Camera / Upload Box */}
      <div className="p-6 rounded-3xl bg-gradient-to-b from-emerald-50/90 to-emerald-100/30 dark:from-slate-800/90 dark:to-slate-900/90 border-2 border-dashed border-emerald-400/80 dark:border-emerald-600/60 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden shadow-sm">
        {/* Laser scanner animation overlay while processing */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center z-20 transition-opacity">
            <div className="absolute left-6 right-6 h-1 bg-emerald-400 shadow-[0_0_20px_#34d399] animate-scan-laser" />
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col items-center gap-3 border border-slate-200 dark:border-slate-800 max-w-xs mx-4 text-center">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                  {processingStatusText}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Kassa kodu, VÖEN, məbləğ və saxtakarlıq qaydaları yoxlanılır
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30">
          <Camera className="w-8 h-8" />
        </div>

        <div>
          <h2 className="font-black text-base text-slate-900 dark:text-slate-100">
            Fiskal Qəbzin Şəklini Yükləyin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            Supermarket çekinin aydın fotosunu çəkin və ya qalereyadan seçin. Dərhal loyallıq xalları qazanın!
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

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Kamera / Şəkil Yüklə</span>
          </button>
        </div>
      </div>

      {/* 3. Outcome Card Presentation (APPROVED, REJECTED, FLAGGED_REVIEW) */}
      {outcome === "APPROVED" && approvedData && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500 dark:border-emerald-500 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Header Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-black">Qəbz Uğurla Təsdiqləndi!</div>
                <div className="text-xs text-emerald-100 font-medium">
                  {approvedData.merchantName} • Loyallıq balı köçürüldü
                </div>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md text-xs font-black flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
              +{approvedData.pointsAwarded} Bal
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Mağaza Şəbəkəsi:
              </span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block">
                {approvedData.merchantName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Qəbz Məbləği:
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block text-sm">
                ${approvedData.totalAmount.toFixed(2)} AZN
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Qazanılan Bal:
              </span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
                +{approvedData.pointsAwarded} bal (≈ ${(approvedData.pointsAwarded / 100).toFixed(2)})
              </span>
            </div>
            <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Ledger Transaction ID:
              </span>
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate block mt-0.5">
                {approvedData.ledgerTransactionId || approvedData.receiptId}
              </span>
            </div>
          </div>

          {/* Reset button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={resetOutcome}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Yenisini Skan Et
            </button>
          </div>
        </div>
      )}

      {outcome === "REJECTED" && rejectedData && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-rose-500 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Header Banner */}
          <div className="p-4 rounded-2xl bg-rose-500 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-black">Qəbz Təsdiqlənmədi (İmtina)</div>
                <div className="text-xs text-rose-100 font-medium">
                  Anti-fraud təhlükəsizlik qaydası işə düşdü
                </div>
              </div>
            </div>
            <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-lg bg-white/20">
              0 Bal
            </span>
          </div>

          {/* Rejection Detail */}
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="font-semibold text-rose-900 dark:text-rose-200 leading-relaxed">
                {rejectedData.reason}
              </p>
            </div>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 pt-1 border-t border-rose-200/60 dark:border-rose-900/60">
              İkitərəfli mühasibatlıq (double-entry ledger) prinsiplərinə uyğun olaraq bu əməliyyat
              üçün heç bir loyallıq balı buraxılmamışdır.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={resetOutcome}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Yenidən Cəhd Et
            </button>
          </div>
        </div>
      )}

      {outcome === "FLAGGED_REVIEW" && flaggedData && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-amber-500 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Header Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-black">Moderator Yoxlanışına Göndərildi</div>
                <div className="text-xs text-amber-100 font-medium">
                  Sweethearting / Kassa anomaliyası qoruması
                </div>
              </div>
            </div>
            <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-lg bg-white/20">
              0 Bal (Dərhal)
            </span>
          </div>

          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  {flaggedData.reason}
                </p>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                  Bu kassa terminalından qısa müddət ərzində fərqli istifadəçilər tərəfindən qəbz
                  təqdim olunduğu üçün sistem şübhəli əməliyyat kimi qeydə aldı. Qəbz arxivə alındı və
                  auditor təsdiqindən sonra xallar avtomatik hesabınıza köçürüləcək.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between text-[11px] text-amber-900 dark:text-amber-300 font-mono">
              <span>Qəbz ID: {flaggedData.receiptId.slice(0, 18)}...</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">Status: FLAGGED_REVIEW</span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={resetOutcome}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Başa Düşdüm, Yenisini Skan Et
            </button>
          </div>
        </div>
      )}

      {/* 4. 1-Click Interactive Test Scenarios Bench */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>1-Kliklə İnteraktiv Test Paneli (Simulyasiyalar)</span>
          </label>
          <span className="text-[10px] text-slate-400 font-semibold">Bütün halları yoxlayın</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Preset 1: Clean Earn */}
          <button
            disabled={isProcessing}
            onClick={handleTestCleanEarn}
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-emerald-50/70 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-left transition-all group shadow-xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                1. Təmiz Qazanma (+150 Bal)
              </span>
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                APPROVED
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              $50.00 Bravo çeki • 3% faizlə 150 bal qazanılır və balans dərhal artır.
            </p>
          </button>

          {/* Preset 2: Duplicate Image */}
          <button
            disabled={isProcessing}
            onClick={handleTestDuplicateRejection}
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-rose-50/70 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 hover:border-rose-400 text-left transition-all group shadow-xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                2. Dublikat Qəbz İmtinası
              </span>
              <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 rounded-md">
                409 CONFLICT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              60 gün ərzində eyni şəklin təkrar yüklənməsi rədd edilir (0 bal).
            </p>
          </button>

          {/* Preset 3: Velocity Limit */}
          <button
            disabled={isProcessing}
            onClick={handleTestVelocityLimit}
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-rose-50/70 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 hover:border-rose-400 text-left transition-all group shadow-xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                3. Sürət Limiti Tavanı
              </span>
              <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 rounded-md">
                400 BAD REQ
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              $501.00 çeki • 24 saatlıq $500.00 xərcləmə tavanı aşıldığı üçün imtina edilir.
            </p>
          </button>

          {/* Preset 4: Terminal Anomaly */}
          <button
            disabled={isProcessing}
            onClick={handleTestTerminalAnomaly}
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-amber-50/70 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-left transition-all group shadow-xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                4. Kassa Anomaliyası (Review)
              </span>
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-md">
                FLAGGED_REVIEW
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Eyni kassadan ±2 dəqiqə içində fərqli istifadəçilər • Auditor növbəsinə alınır.
            </p>
          </button>
        </div>
      </div>

      {/* 5. Preset Baku Supermarket Sample Receipts */}
      <div className="space-y-3 pt-2">
        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
          Hazır Bakı Qəbzləri ilə Test (Real OCR):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {samples.map((s) => (
            <button
              key={s.id}
              disabled={isProcessing}
              onClick={() => handleSampleClick(s.id)}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-emerald-50/70 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-left transition-all group shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
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

      {/* Extracted Sample Receipt Table (if loaded via OCR sample) */}
      {parsedResult && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <div>
                <div className="text-xs font-black">Qəbz Uğurla Təsdiqləndi!</div>
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
        </div>
      )}

      {/* ƏDV Geri Al Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">ƏDV Geri Al ilə birgə qazanın:</span>
          <span className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 block leading-relaxed">
            Bu qəbzi Birbank və ya edvgerial.az-da skan etməzdən əvvəl Sebet-ə yükləməklə həm dövlət ƏDV
            keşbekinizi alırsınız, həm də Sebet tərəfdaş şəbəkəsində dərhal nağd ekvivalenti olan
            loyallıq xalları toplayırsınız!
          </span>
        </div>
      </div>
    </div>
  );
}
