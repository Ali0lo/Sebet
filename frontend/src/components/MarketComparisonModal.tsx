"use client";

import React from "react";
import { X, Store, Sparkles, CheckCircle2, TrendingDown } from "lucide-react";
import { Product, StorePrice } from "@/lib/types";
import { ChainLogo } from "@/components/ChainLogo";
import { useTranslation } from "@/lib/translations";

interface MarketComparisonModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
}

export const MarketComparisonModal: React.FC<MarketComparisonModalProps> = ({
  isOpen,
  product,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen || !product) return null;

  // Group and sort prices by effective price ascending
  const chainPrices: { [key: string]: StorePrice } = {};
  product.prices.forEach((p) => {
    if (!chainPrices[p.chain_slug]) {
      chainPrices[p.chain_slug] = p;
    }
  });

  const sortedStores = Object.values(chainPrices).sort((a, b) => {
    const priceA = a.is_promo && a.promo_price ? a.promo_price : a.price;
    const priceB = b.is_promo && b.promo_price ? b.promo_price : b.price;
    return priceA - priceB;
  });

  const lowestPrice =
    sortedStores.length > 0
      ? sortedStores[0].is_promo && sortedStores[0].promo_price
        ? sortedStores[0].promo_price
        : sortedStores[0].price
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[85vh] scale-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {t.productCard.compareInMarkets}
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {sortedStores.length} market üzrə müqayisə
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Summary */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/40 dark:bg-slate-800/30">
          {product.image_url ? (
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700/50 p-1 border border-slate-200/70 dark:border-slate-700 shrink-0 flex items-center justify-center">
              <img
                src={product.image_url}
                alt={product.canonical_name}
                className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {product.canonical_name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              {product.brand && (
                <span className="text-[10px] text-slate-400 dark:text-slate-400 truncate">
                  {product.brand}
                </span>
              )}
              {product.pack_size && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  • {product.pack_size}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stores List */}
        <div className="p-4 overflow-y-auto space-y-2">
          {sortedStores.map((cp, idx) => {
            const isLowest = idx === 0;
            const effectivePrice =
              cp.is_promo && cp.promo_price ? cp.promo_price : cp.price;
            const priceDiff = effectivePrice - lowestPrice;

            return (
              <div
                key={cp.chain_slug}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  isLowest
                    ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/70 shadow-2xs"
                    : "bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <ChainLogo slug={cp.chain_slug} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {cp.chain_name}
                      </span>
                      {isLowest && (
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-600 text-white text-[9px] font-black tracking-wide">
                          Ən ucuz
                        </span>
                      )}
                      {cp.is_promo && (
                        <span className="px-1.5 py-0.2 rounded-md bg-rose-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Promo
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                      {cp.neighborhood || cp.branch_name || "Bütün filiallar"}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-black ${
                      isLowest
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {effectivePrice.toFixed(2)} ₼
                  </div>
                  {cp.is_promo && cp.promo_price && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through block">
                      {cp.price.toFixed(2)} ₼
                    </span>
                  )}
                  {!isLowest && priceDiff > 0 && (
                    <span className="text-[9px] font-semibold text-rose-500 dark:text-rose-400 block">
                      +{priceDiff.toFixed(2)} ₼
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
};
