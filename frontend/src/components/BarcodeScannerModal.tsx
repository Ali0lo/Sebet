"use client";

import React, { useState } from "react";
import { X, Camera, Search, Barcode, CheckCircle2, ShoppingCart, Sparkles, ExternalLink } from "lucide-react";
import { getProductByBarcode } from "@/lib/api";
import { Product } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_BARCODES = [
  { name: "Milla Süd 1L", barcode: "4760083300124" },
  { name: "Westgold Kərə Yağı", barcode: "9415494000125" },
  { name: "Ariel Yuyucu Toz 3kg", barcode: "8001090123456" },
  { name: "Azərçay Buket 250g", barcode: "4760012300124" },
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
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Barkod Skaneri
              </h2>
              <p className="text-[11px] text-slate-500">
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
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
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
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-left transition-all group"
                >
                  <div className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-700 truncate">
                    {item.name}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">
                    {item.barcode}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Barcode Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Və ya əllə daxil edin:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Məsələn: 4760083300124"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup(manualCode)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:bg-white font-mono"
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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Scanned Result Card */}
          {scannedProduct && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex gap-3">
                {scannedProduct.image_url && (
                  <img
                    src={scannedProduct.image_url}
                    alt={scannedProduct.canonical_name}
                    className="w-16 h-16 rounded-xl object-cover bg-white border border-slate-200"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                    {scannedProduct.brand || "Bakı"}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                    {scannedProduct.canonical_name}
                  </h4>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-sm font-black text-emerald-700">
                      Ən ucuz: {scannedProduct.min_price?.toFixed(2)} ₼
                    </span>
                    {scannedProduct.max_price && scannedProduct.max_price > (scannedProduct.min_price || 0) && (
                      <span className="text-[10px] text-slate-400 line-through">
                        {scannedProduct.max_price.toFixed(2)} ₼
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Price comparison matrix */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
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
                            ? "bg-emerald-100/60 border-emerald-300 font-bold text-emerald-950"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: sp.chain_color }}
                            />
                            <span className="text-[11px] font-bold truncate">
                              {sp.chain_name}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 truncate block">
                            {sp.neighborhood || sp.branch_name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-[12px]">
                            {priceVal.toFixed(2)} ₼
                          </div>
                          {sp.is_promo && (
                            <span className="text-[8px] text-rose-600 font-bold">
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

