"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Calendar,
  Sparkles,
  Plus,
  ExternalLink,
  Flame,
  Check,
  Search,
  Layers,
  ShoppingBag,
  Store,
  Milk,
  Beef,
  Croissant,
  Apple,
  Package,
  Coffee,
  Cookie,
  GlassWater,
  Smile,
  Tag,
} from "lucide-react";
import { getActiveFlyers, searchProducts, getCategories, getProductById } from "@/lib/api";
import { Flyer, Product, Category } from "@/lib/types";
import { useSebetStore } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";
import { ProductCard } from "@/components/ProductCard";

const CHAINS_FILTER = [
  { name: "Bütün Marketlər", slug: "" },
  { name: "Bravo", slug: "bravo", color: "#74b826" },
  { name: "Araz", slug: "araz", color: "#E30613" },
  { name: "OBA", slug: "oba", color: "#009640" },
  { name: "Bazarstore", slug: "bazarstore", color: "#D01026" },
  { name: "Al Market", slug: "almarket", color: "#E31E24" },
  { name: "Neptun", slug: "neptun", color: "#f37021" },
  { name: "Spar", slug: "spar", color: "#007A3D" },
];

interface FlyerCategoryMeta {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  shortName: string;
}

const CATEGORY_MAP: Record<string, FlyerCategoryMeta> = {
  "dairy-eggs": { icon: Milk, shortName: "Süd Məhsulları" },
  "meat-poultry": { icon: Beef, shortName: "Ət & Toyuq" },
  "bakery": { icon: Croissant, shortName: "Çörək & Un" },
  "fruit-veg": { icon: Apple, shortName: "Meyvə-Tərəvəz" },
  "pantry-cooking": { icon: Package, shortName: "Əsas Ərzaq" },
  "tea-coffee": { icon: Coffee, shortName: "Çay & Qəhvə" },
  "beverages-tea": { icon: Coffee, shortName: "Çay & Qəhvə" },
  "snacks-sweets": { icon: Cookie, shortName: "Şirniyyat" },
  "drinks-water": { icon: GlassWater, shortName: "İçkilər" },
  "cleaning-household": { icon: Sparkles, shortName: "Təmizlik" },
  "personal-care-baby": { icon: Smile, shortName: "Qulluq" },
};

function getCategoryPillInfo(cat: Category): FlyerCategoryMeta {
  const bySlug = CATEGORY_MAP[cat.slug];
  if (bySlug) return bySlug;

  const name = (cat.name_az || "").toLowerCase();
  if (name.includes("süd") || name.includes("ağartı")) return CATEGORY_MAP["dairy-eggs"];
  if (name.includes("ət") || name.includes("toyuq")) return CATEGORY_MAP["meat-poultry"];
  if (name.includes("çörək") || name.includes("un")) return CATEGORY_MAP["bakery"];
  if (name.includes("meyvə") || name.includes("tərəvəz")) return CATEGORY_MAP["fruit-veg"];
  if (name.includes("ərzaq") || name.includes("yağ")) return CATEGORY_MAP["pantry-cooking"];
  if (name.includes("çay") || name.includes("qəhvə")) return CATEGORY_MAP["tea-coffee"];
  if (name.includes("şirniyyat") || name.includes("qəlyanaltı")) return CATEGORY_MAP["snacks-sweets"];
  if (name.includes("içki") || name.includes("su")) return CATEGORY_MAP["drinks-water"];
  if (name.includes("təmizlik") || name.includes("yuyucu")) return CATEGORY_MAP["cleaning-household"];
  if (name.includes("qulluq") || name.includes("gigiyena")) return CATEGORY_MAP["personal-care-baby"];

  return {
    icon: Tag,
    shortName: cat.name_az.split("&")[0].split("(")[0].trim(),
  };
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const initialChain = searchParams.get("chain") || "bravo";
  const initialCat = searchParams.get("cat") || "";
  const initialQuery = searchParams.get("q") || "";

  const [activeTab, setActiveTab] = useState<"products" | "flyers">(
    initialChain && !initialCat && !initialQuery ? "flyers" : "products"
  );

  // Flyers state
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [selectedChainSlug, setSelectedChainSlug] = useState<string>(initialChain);
  const [isFlyersLoading, setIsFlyersLoading] = useState(true);
  const [addedFlyerIds, setAddedFlyerIds] = useState<{ [key: string]: boolean }>({});

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  const { addToBasket } = useSebetStore();

  // Load initial metadata and flyers
  useEffect(() => {
    async function loadData() {
      setIsFlyersLoading(true);
      try {
        const [flyersData, catsData] = await Promise.all([
          getActiveFlyers().catch(() => []),
          getCategories().catch(() => []),
        ]);
        setFlyers(flyersData);
        setCategories(catsData);
        if (flyersData.length > 0 && !flyersData.find((f) => f.chain_slug === selectedChainSlug)) {
          setSelectedChainSlug(flyersData[0].chain_slug);
        }
      } catch (err) {
        console.error("Failed to load catalog data", err);
      } finally {
        setIsFlyersLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync with searchParams
  useEffect(() => {
    if (initialChain && initialChain !== selectedChainSlug) {
      setSelectedChainSlug(initialChain);
    }
    if (initialCat) {
      setSelectedCategory(initialCat);
      setActiveTab("products");
    }
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setActiveTab("products");
    }
  }, [initialChain, initialCat, initialQuery]);

  // Fetch products
  useEffect(() => {
    let isCancelled = false;
    async function fetchProducts() {
      setIsProductsLoading(true);
      try {
        // If category is a slug, find matching id or pass undefined
        const catObj = categories.find((c) => c.slug === selectedCategory || c.id === selectedCategory);
        const catId = catObj ? catObj.id : undefined;

        const res = await searchProducts(
          searchQuery,
          catId,
          selectedChain || undefined,
          1,
          50
        );
        if (!isCancelled) {
          setProducts(res.items);
          setTotalProducts(res.total);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        if (!isCancelled) setIsProductsLoading(false);
      }
    }

    const timer = setTimeout(fetchProducts, 200);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedCategory, selectedChain, categories]);

  const currentFlyer = flyers.find((f) => f.chain_slug === selectedChainSlug);

  const handleAddFlyerItem = async (item: any) => {
    try {
      let prod: Product | null = null;
      if (item.product_id) {
        try {
          prod = await getProductById(item.product_id);
        } catch {
          // fallback to search if direct lookup fails
        }
      }

      if (!prod) {
        const res = await searchProducts(item.title);
        prod = res.items.find((p) => p.id === item.product_id) || res.items[0];
      }

      if (!prod && item.title) {
        const firstWords = item.title.split(" ").slice(0, 2).join(" ");
        const res = await searchProducts(firstWords);
        prod = res.items.find((p) => p.id === item.product_id) || res.items[0];
      }

      if (prod) {
        addToBasket(prod, 1);
        setAddedFlyerIds((prev) => ({ ...prev, [item.id]: true }));
        setTimeout(() => {
          setAddedFlyerIds((prev) => ({ ...prev, [item.id]: false }));
        }, 1800);
      }
    } catch (e) {
      console.error("Failed to add flyer item to basket", e);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Kataloq & Məhsullar</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50">
              {totalProducts > 0 ? `${totalProducts} məhsul` : "Rəf & Jurnallar"}
            </span>
          </h1>
        </div>
      </div>

      {/* Main Mode Toggle: Rəf Məhsulları vs Həftəlik Jurnallar */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 shadow-2xs gap-1">
        <button
          onClick={() => setActiveTab("products")}
          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "products"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bütün Məhsullar</span>
        </button>

        <button
          onClick={() => setActiveTab("flyers")}
          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "flyers"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Həftəlik Jurnallar</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-bold">
            Aksiya
          </span>
        </button>
      </div>

      {/* VIEW 1: PRODUCTS SHELF CATALOG */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* In-Catalog Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Kataloqda məhsul axtarın..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 border border-slate-200/80 dark:border-slate-800 focus:border-emerald-500 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
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

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                selectedCategory === ""
                  ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-800"
              }`}
            >
              <Store className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Hamısı</span>
            </button>
            {categories.map((cat) => {
              const pillInfo = getCategoryPillInfo(cat);
              const IconComp = pillInfo.icon;
              const isSelected = selectedCategory === cat.slug || selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? "" : cat.slug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-800"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span className="whitespace-nowrap">{pillInfo.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Chain Filter Pills (Unique Bravo, authentic logos) */}
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
          {isProductsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-3xl">🔍</div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Məhsul tapılmadı
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Axtarış sorğusunu dəyişin və ya digər marketləri seçin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: WEEKLY FLYERS CATALOG */}
      {activeTab === "flyers" && (
        <div className="space-y-4">
          {/* Supermarket Chain Tabs with Logos */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {flyers.map((fl) => {
              const isSelected = fl.chain_slug === selectedChainSlug;
              return (
                <button
                  key={fl.id}
                  onClick={() => setSelectedChainSlug(fl.chain_slug)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black shrink-0 transition-all border flex items-center gap-2 ${
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
          {isFlyersLoading ? (
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
                        <span>05 - 15 Sentyabr 2026</span>
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
                    Jurnaldakı Xüsusi Qiymətlər ({currentFlyer.items.length})
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40">
                    1 kliklə səbətə at
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentFlyer.items.map((item) => {
                    const isAdded = addedFlyerIds[item.id];

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
                              className="w-14 h-14 rounded-xl object-contain p-1 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100/80 dark:border-slate-700/60 shrink-0 mix-blend-multiply dark:mix-blend-normal"
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
                          onClick={() => handleAddFlyerItem(item)}
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
      )}
    </div>
  );
}

export default function FlyersPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-3xl bg-slate-100 dark:bg-slate-900 animate-pulse" />}>
      <CatalogContent />
    </Suspense>
  );
}
