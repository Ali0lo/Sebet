"use client";

import React, { useEffect, useState } from "react";

export const SplashScreen: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    try {
      const shown = sessionStorage.getItem("sebet_splash_shown");
      if (!shown) {
        setIsVisible(true);
        const fadeTimer = setTimeout(() => {
          setIsFading(true);
        }, 1500);

        const hideTimer = setTimeout(() => {
          setIsVisible(false);
          sessionStorage.setItem("sebet_splash_shown", "true");
        }, 2000); // 1500ms display + 500ms fade

        return () => {
          clearTimeout(fadeTimer);
          clearTimeout(hideTimer);
        };
      }
    } catch {
      // sessionStorage might fail in some restricted environments
      setIsVisible(false);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-slate-950 transition-opacity duration-500 pointer-events-none ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3.5 animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-3xl bg-[#235434] flex items-center justify-center shadow-xl shadow-[#235434]/25 p-3.5 border border-[#2e6840]/30">
          <img
            src="/sebet-icon-transparent.png"
            alt="Sebet"
            className="w-full h-full object-contain drop-shadow-md"
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-[#235434] dark:text-emerald-400">
            sebet
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Ağıllı Market & Qənaət
          </p>
        </div>
      </div>
    </div>
  );
};

