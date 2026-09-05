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
  Navigation,
  Compass,
} from "lucide-react";
import { useSebEtStore, BAKU_LOCATIONS } from "@/lib/store";
import { NearbyMarketsModal } from "@/components/NearbyMarketsModal";

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
  const [isNearbyModalOpen, setIsNearbyModalOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

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

  const handleGetLiveGPS = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            name: "Cari Məkanım (GPS)",
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setIsLocating(false);
          setIsLocMenuOpen(false);
        },
        () => {
          setIsLocating(false);
          // If denied, open nearby modal for manual/preset choice
          setIsLocMenuOpen(false);
          setIsNearbyModalOpen(true);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsLocMenuOpen(false);
      setIsNearbyModalOpen(true);
    }
  };

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
                Seb<span className="text-emerald-600 dark:text-emerald-400">et</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                Baku
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none">
              Səbətini Sebet
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
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 space-y-1">
                {/* Live GPS Button */}
                <div className="px-2">
                  <button
                    onClick={handleGetLiveGPS}
                    disabled={isLocating}
                    className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isLocating ? "animate-spin" : ""}`} />
                    <span>{isLocating ? "Məkan təyin edilir..." : "Cari Məkanımı Tap (GPS)"}</span>
                  </button>
                </div>

                {/* Open Nearby Map Modal */}
                <div className="px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsLocMenuOpen(false);
                      setIsNearbyModalOpen(true);
                    }}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Yaxın Marketlər Xəritəsi</span>
                  </button>
                </div>

                <div className="px-3 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Bakı Əraziləri
                </div>
                {BAKU_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => {
                      setLocation(loc);
                      setIsLocMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors ${
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

          {/* Sebet Points */}
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

      {/* Nearby Supermarkets & Live Map Modal */}
      <NearbyMarketsModal
        isOpen={isNearbyModalOpen}
        onClose={() => setIsNearbyModalOpen(false)}
      />
    </header>
  );
};
