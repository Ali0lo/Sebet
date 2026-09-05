"use client";

import React, { useState } from "react";
import { X, Camera, Search, Barcode, CheckCircle2, ShoppingCart, Sparkles, ExternalLink } from "lucide-react";
import { getProductByBarcode } from "@/lib/api";
import { Product } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_BARCODES = [
  { name: "Milla Süd 1L", barcode: "4760083300124" },
  { name: "Milla Qatıq 450g", barcode: "4760083300254" },
  { name: "Westgold Kərə Yağı", barcode: "9415494000125" },
  { name: "Anchor Kərə Yağı 500g", barcode: "9415494000194" },
  { name: "Ariel Yuyucu Toz 7kg", barcode: "8001090123499" },
  { name: "Fairy Limon 650ml", barcode: "8001090123470" },
  { name: "Sirab Qazsız 1.5L", barcode: "4760048100123" },
  { name: "Bizim Süfrə Mayonez", barcode: "4760098765432" },
];

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const { addToBasket } = useSebEtStore();

  if (!isOpen) return null;

  const handleLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    setScannedProduct(null);

    try {
      const product = await getProductByBarcode(trimmed);
      setScannedProduct(product);
    } catch (err: any) {
      setError(err.message || "Bu barkod üzrə məhsul tapılmadı.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Barkod Skaneri
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kamera ilə oxudun və ya barkodu daxil edin
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setScannedProduct(null);
              setError(null);
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Simulated Live Camera View */}
          <div className="relative w-full h-44 rounded-2xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center border-2 border-emerald-500/40">
            {/* Viewfinder Target corners */}
            <div className="absolute inset-6 border-2 border-dashed border-emerald-400/70 rounded-xl pointer-events-none flex items-center justify-center">
              {/* Laser line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-scan-laser" />
            </div>

            <Camera className="w-8 h-8 text-emerald-400/80 mb-2 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-100 tracking-wide">
              Barkodu çərçivəyə yönəldin
            </span>
            <span className="text-[10px] text-emerald-300/70 mt-0.5">
              EAN-13 avtomatik tanınır
            </span>
          </div>

          {/* Quick 1-Click Test Barcodes */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Sürətli Test Üçün Seçin (1 Kliklə):
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_BARCODES.map((item) => (
                <button
                  key={item.barcode}
                  onClick={() => {
                    setManualCode(item.barcode);
                    handleLookup(item.barcode);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-750 hover:border-emerald-300 dark:hover:border-emerald-600 border border-slate-200 dark:border-slate-700 text-left transition-all group"
                >
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate">
                    {item.name}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                    {item.barcode}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Barcode Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Və ya əllə daxil edin:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Məsələn: 4760083300124"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup(manualCode)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:bg-white dark:focus:bg-slate-850 font-mono"
              />
              <button
                disabled={isLoading || !manualCode.trim()}
                onClick={() => handleLookup(manualCode)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Axtar</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Scanned Result Card */}
          {scannedProduct && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex gap-3">
                {scannedProduct.image_url && (
                  <img
                    src={scannedProduct.image_url}
                    alt={scannedProduct.canonical_name}
                    className="w-16 h-16 rounded-xl object-cover bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                    {scannedProduct.brand || "Bakı"}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 line-clamp-2">
                    {scannedProduct.canonical_name}
                  </h4>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                      Ən ucuz: {scannedProduct.min_price?.toFixed(2)} ₼
                    </span>
                    {scannedProduct.max_price && scannedProduct.max_price > (scannedProduct.min_price || 0) && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through">
                        {scannedProduct.max_price.toFixed(2)} ₼
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Price comparison matrix */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Marketlər üzrə qiymət müqayisəsi:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {scannedProduct.prices.map((sp) => {
                    const isMin =
                      (sp.is_promo && sp.promo_price ? sp.promo_price : sp.price) ===
                      scannedProduct.min_price;
                    const priceVal =
                      sp.is_promo && sp.promo_price ? sp.promo_price : sp.price;

                    return (
                      <div
                        key={sp.store_id}
                        className={`p-2 rounded-xl text-xs flex items-center justify-between border ${
                          isMin
                            ? "bg-emerald-100/60 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 font-bold text-emerald-950 dark:text-emerald-200"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="flex items-center gap-1.5">
                            <ChainLogo slug={sp.chain_slug} size="xs" />
                            <span className="text-[11px] font-bold truncate">
                              {sp.chain_name}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate block">
                            {sp.neighborhood || sp.branch_name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-[12px]">
                            {priceVal.toFixed(2)} ₼
                          </div>
                          {sp.is_promo && (
                            <span className="text-[8px] text-rose-600 dark:text-rose-400 font-bold">
                              Aksiya
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add to Basket Action */}
              <button
                onClick={() => {
                  addToBasket(scannedProduct, 1);
                  setScannedProduct(null);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Səbətə əlavə et ({scannedProduct.min_price?.toFixed(2)} ₼)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

