"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBasket,
  Coins,
  ChevronDown,
  Moon,
  Sun,
  Globe,
  Home,
  BookOpen,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react";
import { useSebEtStore, SUPPORTED_LANGUAGES } from "@/lib/store";
import { SebetLogo } from "@/components/SebetLogo";
import { useTranslation } from "@/lib/translations";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const {
    basket,
    userPoints,
    toggleBasketDrawer,
    theme,
    toggleTheme,
    language,
    setLanguage,
  } = useSebEtStore();
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Click outside to dismiss menu
  useEffect(() => {
    if (!isLangMenuOpen) return;
    const handleDismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".relative")) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDismiss);
    return () => document.removeEventListener("mousedown", handleDismiss);
  }, [isLangMenuOpen]);

  const totalBasketItems = isMounted
    ? basket.reduce((acc, item) => acc + item.quantity, 0)
    : 0;

  const desktopNavItems = [
    { label: t.nav.home, href: "/", icon: Home },
    { label: t.nav.catalog, href: "/flyers", icon: BookOpen },
    {
      label: t.nav.basket,
      href: "/basket",
      icon: ShoppingBag,
      badge: totalBasketItems > 0 ? totalBasketItems : null,
    },
    { label: t.nav.offers, href: "/offers", icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center group shrink-0" aria-label={`Sebet ${t.nav.home}`}>
          <SebetLogo variant="full" size="md" className="group-hover:opacity-90 transition-opacity" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
          {desktopNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                  isActive
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                <span>{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span className="bg-emerald-600 text-white text-[10px] font-black rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Language, Theme Toggle, Points & Cart */}
        <div className="flex items-center gap-1.5">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              title={t.nav.changeLang}
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="uppercase text-[11px]">
                {isMounted
                  ? language === "ru"
                    ? "RUS"
                    : language === "en"
                    ? "ENG"
                    : "AZE"
                  : "AZE"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isLangMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 space-y-0.5">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t.profile.language}
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const current = isMounted ? language : "az";
                  const isSelected = current === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors ${
                        isSelected
                          ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/60 dark:bg-slate-800/80"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{lang.label}</span>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                        {lang.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 transition-colors"
            title={isMounted && theme === "dark" ? t.nav.lightMode : t.nav.darkMode}
          >
            {isMounted && theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Sebet Points - Compact Coin Counter */}
          <Link
            href="/profile"
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold transition-colors shrink-0"
            title={t.nav.pointsTitle}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="tabular-nums font-extrabold">{isMounted ? userPoints : 250}</span>
          </Link>

          {/* Floating Cart Button */}
          <button
            onClick={() => toggleBasketDrawer(true)}
            className="relative p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shrink-0"
            title={t.nav.myBasket}
          >
            <ShoppingBasket className="w-4 h-4" />
            {isMounted && totalBasketItems > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-emerald-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-xs">
                {totalBasketItems}
              </span>
            )}
          </button>

          {/* Desktop Profile Link */}
          <Link
            href="/profile"
            className="hidden md:flex items-center p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
            title={t.nav.profile}
          >
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};
