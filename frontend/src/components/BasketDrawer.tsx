"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, Sparkles } from "lucide-react";
import { useSebEtStore } from "@/lib/store";

export const BasketDrawer: React.FC = () => {
  const {
    basket,
    isBasketDrawerOpen,
    toggleBasketDrawer,
    updateQuantity,
    removeFromBasket,
    clearBasket,
    getBasketTotalEstimated,
  } = useSebEtStore();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !isBasketDrawerOpen) return null;

  const totalCost = getBasketTotalEstimated();
  const itemCount = basket.reduce((acc, it) => acc + it.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 border-l border-transparent dark:border-slate-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Səbətim ({itemCount} məhsul)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bakı marketləri üzrə canlı optimizasiya
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleBasketDrawer(false)}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Basket Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {basket.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                Səbətim hələlik boşdur
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                Məhsulların qiymətlərini müqayisə etmək üçün kataloqdan məhsullar əlavə edin.
              </p>
            </div>
          ) : (
            basket.map((item) => {
              const bestPrice = item.product.min_price || 0;
              const lineTotal = bestPrice * item.quantity;

              return (
                <div
                  key={item.product.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-center gap-3 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors"
                >
                  {item.product.image_url && (
                    <img
                      src={item.product.image_url}
                      alt={item.product.canonical_name}
                      className="w-12 h-12 rounded-xl object-cover bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.product.canonical_name}
                    </h4>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {bestPrice.toFixed(2)} ₼
                      </span>
                      <span>× {item.quantity}</span>
                      <span>=</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {lineTotal.toFixed(2)} ₼
                      </span>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-xs shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black px-1 text-slate-800 dark:text-slate-200">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => removeFromBasket(item.product.id)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer & Optimizer CTA */}
        {basket.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Təxmini ən ucuz cəm:
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                ~{totalCost.toFixed(2)} ₼
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearBasket}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors"
              >
                Təmizlə
              </button>

              <Link
                href="/basket"
                onClick={() => toggleBasketDrawer(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ağıllı Səbətə Keç (Optimizasiya)</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

