"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ShoppingBag,
  BookOpen,
  User,
} from "lucide-react";
import { useSebEtStore } from "@/lib/store";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { basket } = useSebEtStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalBasketItems = isMounted
    ? basket.reduce((acc, item) => acc + item.quantity, 0)
    : 0;

  const navItems = [
    { label: "Ana Səhifə", href: "/", icon: Home },
    { label: "Kataloq & Məhsullar", href: "/flyers", icon: BookOpen },
    {
      label: "Ağıllı Səbət",
      href: "/basket",
      icon: ShoppingBag,
      badge: totalBasketItems > 0 ? totalBasketItems : null,
    },
    { label: "Profil", href: "/profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-colors duration-200">
      <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

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

