"use client";

import React, { useState, useEffect } from "react";
import { Plus, Minus, Sparkles, Tag, ShoppingBasket } from "lucide-react";
import { Product, StorePrice } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";

interface ProductCardProps {
  product: Product;
  onOpenDetails?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetails,
}) => {
  const { basket, addToBasket, updateQuantity } = useSebEtStore();
  const [isMounted, setIsMounted] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(product.image_url || null);

  useEffect(() => {
    setIsMounted(true);
    setImgSrc(product.image_url || null);
  }, [product.image_url]);

  const basketItem = isMounted
    ? basket.find((item) => item.product.id === product.id)
    : undefined;
  const inCartQty = basketItem?.quantity || 0;

  // Group prices by chain to show one pill per chain
  const chainPrices: { [key: string]: StorePrice } = {};
  product.prices.forEach((p) => {
    if (!chainPrices[p.chain_slug]) {
      chainPrices[p.chain_slug] = p;
    }
  });

  const bestPrice = product.min_price || 0;
  const maxPrice = product.max_price || 0;
  const hasPromo = product.prices.some((p) => p.is_promo);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all p-3 flex flex-col justify-between group">
      <div>
        {/* Image & Badges */}
        <div className="relative w-full h-32 rounded-xl bg-slate-50 dark:bg-slate-800/60 overflow-hidden mb-2.5 flex items-center justify-center border border-slate-100 dark:border-slate-800">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.canonical_name}
              onError={() => setImgSrc(null)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <ShoppingBasket className="w-8 h-8 opacity-40 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {product.brand || "SebEt"}
              </span>
            </div>
          )}

          {/* Brand Badge */}
          {product.brand && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold tracking-wide">
              {product.brand}
            </span>
          )}

          {/* Promo or Pack size Badge */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {hasPromo && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black flex items-center gap-0.5 shadow-xs">
                <Sparkles className="w-2.5 h-2.5" /> Endirim
              </span>
            )}
            {product.pack_size && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-200 text-[9px] font-bold border border-slate-200 dark:border-slate-700">
                {product.pack_size}
              </span>
            )}
          </div>
        </div>

        {/* Product Title */}
        <h3
          onClick={() => onOpenDetails?.(product)}
          className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer min-h-[32px]"
          title={product.canonical_name}
        >
          {product.canonical_name}
        </h3>

        {/* Price Dispersion Range */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
            {bestPrice.toFixed(2)} ₼
          </span>
          {maxPrice > bestPrice && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through">
              {maxPrice.toFixed(2)} ₼
            </span>
          )}
          {maxPrice > bestPrice && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
              -{(maxPrice - bestPrice).toFixed(2)} ₼
            </span>
          )}
        </div>

        {/* Chain Comparison Pills with Official Logos */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
          {Object.values(chainPrices).map((cp) => {
            const isLowest =
              (cp.is_promo && cp.promo_price ? cp.promo_price : cp.price) ===
              bestPrice;
            const displayPrice =
              cp.is_promo && cp.promo_price ? cp.promo_price : cp.price;

            return (
              <div
                key={cp.chain_slug}
                className={`text-[9px] p-1 rounded-lg font-medium flex items-center gap-1.5 border transition-all ${
                  isLowest
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold"
                    : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {/* Official Market Logo Badge */}
                <ChainLogo slug={cp.chain_slug} size="xs" />
                <span>{displayPrice.toFixed(2)} ₼</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action: Add to Basket */}
      <div className="mt-3 pt-2">
        {inCartQty > 0 ? (
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-1">
            <button
              onClick={() => updateQuantity(product.id, -1)}
              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-black flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-slate-700 active:scale-90 transition-transform shadow-xs"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 px-2">
              {inCartQty} ədəd
            </span>
            <button
              onClick={() => updateQuantity(product.id, 1)}
              className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition-transform shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => addToBasket(product, 1)}
            className="w-full py-1.5 px-3 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Səbətə at</span>
          </button>
        )}
      </div>
    </div>
  );
};
