"use client";

import React, { useState, useEffect } from "react";
import { X, Scale, Plus, Minus, ShoppingCart, Trash2, Sparkles } from "lucide-react";
import { Product } from "@/lib/types";
import { useTranslation } from "@/lib/translations";
import { ChainLogo } from "@/components/ChainLogo";

interface KgSelectorModalProps {
  isOpen: boolean;
  product: Product | null;
  initialQuantity?: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  onRemove?: () => void;
}

const PRESET_WEIGHTS = [0.5, 1, 1.5, 2, 2.5, 3, 5];

export const KgSelectorModal: React.FC<KgSelectorModalProps> = ({
  isOpen,
  product,
  initialQuantity = 1,
  onClose,
  onConfirm,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [weight, setWeight] = useState<number>(initialQuantity > 0 ? initialQuantity : 1);
  const [inputValue, setInputValue] = useState<string>(
    String(initialQuantity > 0 ? initialQuantity : 1)
  );

  useEffect(() => {
    if (isOpen && product) {
      const startQty = initialQuantity > 0 ? initialQuantity : 1;
      setWeight(startQty);
      setInputValue(String(startQty));
    }
  }, [isOpen, product, initialQuantity]);

  if (!isOpen || !product) return null;

  const unitPrice = product.min_price ?? product.prices?.[0]?.price ?? 0;
  const totalPrice = Math.round(weight * unitPrice * 100) / 100;
  const isAlreadyInCart = (initialQuantity ?? 0) > 0;

  const handlePresetSelect = (val: number) => {
    setWeight(val);
    setInputValue(String(val));
  };

  const handleStep = (delta: number) => {
    const nextVal = Math.max(0.1, Math.round((weight + delta) * 10) / 10);
    setWeight(nextVal);
    setInputValue(String(nextVal));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      setWeight(Math.round(parsed * 100) / 100);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || parsed <= 0) {
      setWeight(0.5);
      setInputValue("0.5");
    } else {
      const bounded = Math.min(Math.max(0.1, parsed), 50);
      setWeight(bounded);
      setInputValue(String(bounded));
    }
  };

  const handleConfirm = () => {
    const finalWeight = Math.max(0.1, weight);
    onConfirm(finalWeight);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col scale-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {t.productCard.howMuchKg}
              </h2>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {t.productCard.weightItem} • {t.productCard.pricePerKg}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Product Snippet */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
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
                <Scale className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {product.canonical_name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {unitPrice.toFixed(2)} ₼ / {t.productCard.kgSuffix}
                </span>
                {product.brand && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    • {product.brand}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Large Kg Stepper & Input Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-center space-y-2">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block uppercase tracking-wider">
              {t.productCard.customWeight}
            </label>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleStep(-0.5)}
                disabled={weight <= 0.1}
                className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-base hover:bg-slate-100 dark:hover:bg-slate-750 active:scale-90 transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className="w-28 py-2 text-center text-2xl font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 shadow-xs"
                />
                <span className="absolute right-3 font-extrabold text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
                  {t.productCard.kgSuffix}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleStep(0.5)}
                className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Weight Presets */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
              {t.productCard.quickPresets}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_WEIGHTS.map((preset) => {
                const isSelected = Math.abs(weight - preset) < 0.01;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-600"
                    }`}
                  >
                    {preset} {t.productCard.kgSuffix}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Price Estimation Calculation */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {t.productCard.totalEstimated} ({weight} {t.productCard.kgSuffix} × {unitPrice.toFixed(2)} ₼):
            </span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
              {totalPrice.toFixed(2)} ₼
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {isAlreadyInCart && onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
                className="p-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                title={t.productCard.removeFromCart}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>
                {isAlreadyInCart ? t.productCard.updateWeight : t.productCard.confirmWeight}
              </span>
              <span>•</span>
              <span>{weight} {t.productCard.kgSuffix} ({totalPrice.toFixed(2)} ₼)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

