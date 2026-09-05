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
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900">
                Səbətiniz ({itemCount} məhsul)
              </h2>
              <p className="text-[11px] text-slate-500">
                Bakı marketləri üzrə optimizasiya
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleBasketDrawer(false)}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Basket Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {basket.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-sm text-slate-700">
                Səbətiniz hələlik boşdur
              </h3>
              <p className="text-xs text-slate-500 max-w-xs">
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
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 hover:bg-slate-100/70 transition-colors"
                >
                  {item.product.image_url && (
                    <img
                      src={item.product.image_url}
                      alt={item.product.canonical_name}
                      className="w-12 h-12 rounded-xl object-cover bg-white border border-slate-200 shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">
                      {item.product.canonical_name}
                    </h4>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-emerald-700">
                        {bestPrice.toFixed(2)} ₼
                      </span>
                      <span>× {item.quantity}</span>
                      <span>=</span>
                      <span className="font-bold text-slate-800">
                        {lineTotal.toFixed(2)} ₼
                      </span>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-xs shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black px-1 text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => removeFromBasket(item.product.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
          <div className="p-4 border-t border-slate-100 bg-slate-50/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Təxmini ən ucuz cəm:
              </span>
              <span className="text-lg font-black text-emerald-700">
                ~{totalCost.toFixed(2)} ₼
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearBasket}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
              >
                Təmizlə
              </button>

              <Link
                href="/basket"
                onClick={() => toggleBasketDrawer(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
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

