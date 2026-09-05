"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  Sparkles,
  Plus,
  ExternalLink,
  Flame,
  Check,
} from "lucide-react";
import { getActiveFlyers, searchProducts } from "@/lib/api";
import { Flyer, Product } from "@/lib/types";
import { useSebEtStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";

export default function FlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [selectedChainSlug, setSelectedChainSlug] = useState<string>("bravo");
  const [isLoading, setIsLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<{ [key: string]: boolean }>({});

  const { addToBasket } = useSebEtStore();

  useEffect(() => {
    async function loadFlyers() {
      setIsLoading(true);
      try {
        const data = await getActiveFlyers();
        setFlyers(data);
        if (data.length > 0 && !data.find((f) => f.chain_slug === selectedChainSlug)) {
          setSelectedChainSlug(data[0].chain_slug);
        }
      } catch (err) {
        console.error("Failed to load flyers", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFlyers();
  }, []);

  const currentFlyer = flyers.find((f) => f.chain_slug === selectedChainSlug);

  const handleAddItemToBasket = async (item: any) => {
    // Find matching product if product_id exists or construct item
    if (item.product_id) {
      try {
        const res = await searchProducts(item.title);
        const prod = res.items.find((p) => p.id === item.product_id) || res.items[0];
        if (prod) {
          addToBasket(prod, 1);
        }
      } catch {
        // fallback
      }
    }

    setAddedIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [item.id]: false }));
    }, 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <span>Həftəlik Kataloqlar</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold flex items-center gap-1 border border-rose-200 dark:border-rose-900/50">
            <Flame className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Aksiyalar
          </span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Bravo, Araz, OBA və Bazarstore-un rəsmi endirim jurnalları
        </p>
      </div>

      {/* Supermarket Chain Tabs with Logos */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {flyers.map((fl) => {
          const isSelected = fl.chain_slug === selectedChainSlug;
          return (
            <button
              key={fl.id}
              onClick={() => setSelectedChainSlug(fl.chain_slug)}
              className={`px-4 py-2 rounded-2xl text-xs font-black shrink-0 transition-all border flex items-center gap-2 ${
                isSelected
                  ? "bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600 shadow-md scale-102"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              <ChainLogo slug={fl.chain_slug} size="xs" />
              <span>{fl.chain_name}</span>
            </button>
          );
        })}
      </div>

      {/* Active Flyer Card */}
      {isLoading ? (
        <div className="h-64 rounded-3xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800" />
      ) : currentFlyer ? (
        <div className="space-y-4">
          {/* Brochure Cover Banner */}
          <div className="relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="h-44 w-full relative">
              <img
                src={currentFlyer.cover_image_url}
                alt={currentFlyer.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex flex-col justify-end p-4 text-white">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                  {currentFlyer.chain_name} Supermarket
                </span>
                <h2 className="text-base font-black tracking-tight leading-tight mt-0.5">
                  {currentFlyer.title}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>05 Sentyabr - 12 Sentyabr 2026</span>
                  </span>
                  {currentFlyer.pdf_url && (
                    <a
                      href={currentFlyer.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>PDF Aç</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Catalog Items Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Kataloqdakı Xüsusi Qiymətlər ({currentFlyer.items.length})
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40">
                1 kliklə səbətə at
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentFlyer.items.map((item) => {
                const isAdded = addedIds[item.id];

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-14 h-14 rounded-xl object-cover bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                          📦
                        </div>
                      )}

                      <div className="min-w-0">
                        {item.badge_text && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 inline-block mb-1 border border-rose-200 dark:border-rose-900/40">
                            {item.badge_text}
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </h4>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                            {item.discount_price.toFixed(2)} ₼
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through">
                            {item.original_price.toFixed(2)} ₼
                          </span>
                          <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
                            -{item.discount_percent}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddItemToBasket(item)}
                      className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all shrink-0 ${
                        isAdded
                          ? "bg-emerald-600 text-white scale-105"
                          : "bg-slate-900 dark:bg-emerald-600 hover:bg-emerald-600 text-white active:scale-95 shadow-xs"
                      }`}
                      title="Səbətə at"
                    >
                      {isAdded ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Bu şəbəkə üzrə aktiv jurnal tapılmadı.
          </p>
        </div>
      )}
    </div>
  );
}

