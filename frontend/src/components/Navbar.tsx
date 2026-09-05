"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin,
  ShoppingBasket,
  Coins,
  Sparkles,
  ChevronDown,
  Moon,
  Sun,
} from "lucide-react";
import { useSebEtStore, BAKU_LOCATIONS } from "@/lib/store";

export const Navbar: React.FC = () => {
  const {
    basket,
    selectedLocation,
    setLocation,
    userPoints,
    toggleBasketDrawer,
    theme,
    toggleTheme,
  } = useSebEtStore();
  const [isMounted, setIsMounted] = useState(false);
  const [isLocMenuOpen, setIsLocMenuOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const totalBasketItems = isMounted
    ? basket.reduce((acc, item) => acc + item.quantity, 0)
    : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-emerald-100/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
            <ShoppingBasket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                Seb<span className="text-emerald-600 dark:text-emerald-400">Et</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                Baku
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none">
              Səbətini SebEt
            </p>
          </div>
        </Link>

        {/* Location & Theme Toggle & Points & Cart */}
        <div className="flex items-center gap-1.5">
          {/* Location Picker */}
          <div className="relative">
            <button
              onClick={() => setIsLocMenuOpen(!isLocMenuOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="max-w-[75px] truncate">
                {isMounted ? selectedLocation.name.split("/")[0].trim() : "28 May"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isLocMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Bakı Ərazisi
                </div>
                {BAKU_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => {
                      setLocation(loc);
                      setIsLocMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors ${
                      selectedLocation.name === loc.name
                        ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/60 dark:bg-slate-800/80"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>{loc.name}</span>
                    {selectedLocation.name === loc.name && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 transition-colors"
            title={isMounted && theme === "dark" ? "İşıqlı rejimə keç" : "Qaranlıq rejimə keç (Dark Mode)"}
          >
            {isMounted && theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* SebEt Points */}
          <Link
            href="/profile"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-700/40 text-amber-900 dark:text-amber-300 text-xs font-bold hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors"
          >
            <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{isMounted ? userPoints : 250}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">xal</span>
          </Link>

          {/* Floating Cart Button */}
          <button
            onClick={() => toggleBasketDrawer(true)}
            className="relative p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            title="Səbət"
          >
            <ShoppingBasket className="w-4 h-4" />
            {isMounted && totalBasketItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-600 text-white rounded-full text-[11px] font-black flex items-center justify-center shadow-xs">
                {totalBasketItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
