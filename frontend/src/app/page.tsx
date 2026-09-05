"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Barcode,
  Sparkles,
  Flame,
  ArrowUpDown,
  Filter,
  TrendingDown,
  ShoppingBag,
} from "lucide-react";
import { searchProducts, getTopDeals, getCategories } from "@/lib/api";
import { Product, Category } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { ChainLogo } from "@/components/ChainLogo";
import { useSebEtStore } from "@/lib/store";

const CHAINS_FILTER = [
  { name: "Bütün Marketlər", slug: "" },
  { name: "Bravo", slug: "bravo", color: "#007A3D" },
  { name: "Araz", slug: "araz", color: "#E30613" },
  { name: "OBA", slug: "oba", color: "#009640" },
  { name: "Bazarstore", slug: "bazarstore", color: "#D01026" },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("cheapest");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [topDeals, setTopDeals] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  const { addToBasket } = useSebEtStore();

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [dealsData, catsData] = await Promise.all([
          getTopDeals().catch(() => []),
          getCategories().catch(() => []),
        ]);
        setTopDeals(dealsData);
        setCategories(catsData);
      } catch (err) {
        console.error("Failed to load initial metadata", err);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    async function fetchProductsList() {
      setIsLoading(true);
      try {
        const res = await searchProducts(
          searchQuery,
          selectedCategory || undefined,
          selectedChain || undefined,
          1,
          40
        );
        if (!isCancelled) {
          setProducts(res.items);
          setTotalProducts(res.total);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    const timer = setTimeout(fetchProductsList, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedCategory, selectedChain, sortBy]);

  return (
    <div className="space-y-5">
      {/* Search Bar & Barcode Scanner Trigger */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Məhsul, brend və ya barkod axtarın (məs: Milla, Westgold)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 border border-transparent dark:border-slate-800 focus:border-emerald-500/40 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white hover:opacity-90 active:scale-95 transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center shrink-0"
            title="Barkod skaneri aç"
          >
            <Barcode className="w-5 h-5" />
          </button>
        </div>

        {/* Live Market Counter Pill */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Bravo • Araz • OBA • Bazarstore</span>
          </span>
          <span className="font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40">
            Real rəf qiymətləri
          </span>
        </div>
      </div>

      {/* Top Discounts Today Carousel */}
      {topDeals.length > 0 && !searchQuery && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Flame className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Günün Ən Yaxşı Endirimləri
              </h2>
            </div>
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/50">
              25%-dək qənaət
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-4 px-4 no-scrollbar">
            {topDeals.map((prod) => {
              const promoPrice = prod.min_price || 0;
              const origPrice = prod.max_price || promoPrice * 1.2;
              const discountPct = Math.round(
                ((origPrice - promoPrice) / origPrice) * 100
              );

              return (
                <div
                  key={`deal-${prod.id}`}
                  className="w-48 shrink-0 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 rounded-2xl border border-rose-100/80 dark:border-slate-800 shadow-xs p-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative w-full h-24 rounded-xl bg-white dark:bg-slate-850 overflow-hidden mb-2 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                      {prod.image_url && (
                        <img
                          src={prod.image_url}
                          alt={prod.canonical_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black shadow-xs">
                        -{discountPct > 0 ? discountPct : 18}%
                      </span>
                    </div>

                    <h4 className="text-[11px] font-bold text-slate-900 dark:text-slate-100 line-clamp-2 min-h-[30px]">
                      {prod.canonical_name}
                    </h4>

                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                        {promoPrice.toFixed(2)} ₼
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through">
                        {origPrice.toFixed(2)} ₼
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => addToBasket(prod, 1)}
                    className="mt-2.5 w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-xs active:scale-95"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    <span>Səbətə at</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
              selectedCategory === ""
                ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-800"
            }`}
          >
            Hamısı
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedCategory === cat.id
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-800"
              }`}
            >
              {cat.name_az}
            </button>
          ))}
        </div>
      )}

      {/* Chain Filter Bar with Supermarket Logos */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {CHAINS_FILTER.map((cf) => (
          <button
            key={cf.slug}
            onClick={() => setSelectedChain(cf.slug)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold shrink-0 border flex items-center gap-1.5 transition-all ${
              selectedChain === cf.slug
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 shadow-xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {cf.slug ? (
              <ChainLogo slug={cf.slug} size="xs" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            )}
            <span>{cf.name}</span>
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {searchQuery
              ? `Axtarış nəticələri: "${searchQuery}" (${totalProducts})`
              : `Bakı Marketlərində Məhsullar (${totalProducts})`}
          </h3>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            <ArrowUpDown className="w-3 h-3" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-300 font-bold focus:outline-hidden cursor-pointer"
            >
              <option value="cheapest" className="dark:bg-slate-900">Ən ucuz</option>
              <option value="name" className="dark:bg-slate-900">Ad üzrə</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="text-3xl">🔍</div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Məhsul tapılmadı</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Axtarış sorğusunu dəyişin və ya digər kateqoriyalara baxın.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onOpenDetails={() => setIsScannerOpen(true)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
}

