"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ShoppingBag,
  BookOpen,
  Camera,
  User,
} from "lucide-react";
import { useSebEtStore } from "@/lib/store";
import { useTranslation } from "@/lib/translations";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { basket } = useSebEtStore();
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalBasketItems = isMounted
    ? basket.reduce((acc, item) => acc + item.quantity, 0)
    : 0;

  const navItems = [
    { label: t.nav.home, href: "/", icon: Home },
    { label: t.nav.catalog, href: "/flyers", icon: BookOpen },
    { label: t.nav.scan, href: "/scan", icon: Camera },
    {
      label: t.nav.basket,
      href: "/basket",
      icon: ShoppingBag,
      badge: totalBasketItems > 0 ? totalBasketItems : null,
    },
    { label: t.nav.profile, href: "/profile", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.07)] transition-colors duration-200 pb-safe">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.href === "/scan") {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center -mt-4 group"
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95 border-2 ${
                    isActive
                      ? "bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/40"
                      : "bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white border-white dark:border-slate-900 shadow-emerald-500/25 group-hover:scale-105"
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[10px] mt-0.5 font-bold ${
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all relative ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[10px] font-black rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
