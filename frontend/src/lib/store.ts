import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product, BasketItem } from "./types";

export interface BakuLocation {
  name: string;
  lat: number;
  lon: number;
}

export const BAKU_LOCATIONS: BakuLocation[] = [
  { name: "28 May", lat: 40.3798, lon: 49.8475 },
  { name: "Gənclik", lat: 40.4002, lon: 49.8516 },
  { name: "Nərimanov", lat: 40.4024, lon: 49.8712 },
  { name: "Elmlər", lat: 40.3735, lon: 49.8142 },
  { name: "İnşaatçılar", lat: 40.3890, lon: 49.8028 },
  { name: "Yasamal", lat: 40.3872, lon: 49.8055 },
  { name: "Nizami", lat: 40.3752, lon: 49.8335 },
  { name: "Koroğlu", lat: 40.4208, lon: 49.9192 },
  { name: "Qara Qarayev", lat: 40.4172, lon: 49.9328 },
  { name: "Xalqlar Dostluğu", lat: 40.3975, lon: 49.9525 },
  { name: "Əhmədli", lat: 40.3855, lon: 49.9540 },
  { name: "Həzi Aslanov", lat: 40.3732, lon: 49.9535 },
  { name: "Bakıxanov", lat: 40.4200, lon: 49.9650 },
  { name: "Xırdalan", lat: 40.4520, lon: 49.7560 },
  { name: "Masazır", lat: 40.4720, lon: 49.7420 },
  { name: "Biləcəri", lat: 40.4315, lon: 49.8000 },
  { name: "Mərdəkan", lat: 40.4900, lon: 50.1450 },
  { name: "Sumqayıt", lat: 40.5897, lon: 49.6686 },
];

export type Language = "az" | "ru" | "en";

export interface LanguageOption {
  code: Language;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "az", label: "Azərbaycan dili", shortLabel: "AZE" },
  { code: "ru", label: "Русский", shortLabel: "RUS" },
  { code: "en", label: "English", shortLabel: "ENG" },
];

interface SebEtState {
  basket: BasketItem[];
  selectedLocation: BakuLocation;
  userPoints: number;
  isBasketDrawerOpen: boolean;
  theme: "light" | "dark";
  language: Language;

  // In-Store Shopping Checklist
  checklistCheckedIds: string[];
  checklistSelectedMarket: string;

  // Actions
  addToBasket: (product: Product, quantity?: number) => void;
  removeFromBasket: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearBasket: () => void;
  setBasket: (items: BasketItem[]) => void;
  setLocation: (location: BakuLocation) => void;
  setLanguage: (language: Language) => void;
  addPoints: (points: number) => void;
  setPoints: (points: number) => void;
  toggleBasketDrawer: (open?: boolean) => void;
  toggleTheme: () => void;
  getBasketTotalEstimated: () => number;
  toggleChecklistItem: (productId: string) => void;
  checkAllItems: () => void;
  uncheckAllItems: () => void;
  setChecklistMarket: (marketSlug: string) => void;
}

export const useSebEtStore = create<SebEtState>()(
  persist(
    (set, get) => ({
      basket: [],
      selectedLocation: BAKU_LOCATIONS[0],
      userPoints: 250,
      isBasketDrawerOpen: false,
      theme: "light",
      language: "az",
      checklistCheckedIds: [],
      checklistSelectedMarket: "bravo",

      addToBasket: (product, quantity = 1) => {
        set((state) => {
          const safeQty = Math.round(quantity * 100) / 100;
          const existingIndex = state.basket.findIndex(
            (item) => item.product.id === product.id
          );
          if (existingIndex > -1) {
            const updated = [...state.basket];
            updated[existingIndex].quantity =
              Math.round((updated[existingIndex].quantity + safeQty) * 100) / 100;
            return { basket: updated };
          } else {
            return { basket: [...state.basket, { product, quantity: safeQty }] };
          }
        });
      },

      removeFromBasket: (productId) => {
        set((state) => ({
          basket: state.basket.filter((item) => item.product.id !== productId),
        }));
      },

      updateQuantity: (productId, delta) => {
        set((state) => {
          const updated = state.basket
            .map((item) => {
              if (item.product.id === productId) {
                const newQty = Math.round((item.quantity + delta) * 100) / 100;
                return newQty > 0 ? { ...item, quantity: newQty } : null;
              }
              return item;
            })
            .filter((item): item is BasketItem => item !== null);
          return { basket: updated };
        });
      },

      setQuantity: (productId, quantity) => {
        set((state) => {
          const safeQty = Math.max(0, Math.round(quantity * 100) / 100);
          if (safeQty <= 0) {
            return {
              basket: state.basket.filter((item) => item.product.id !== productId),
            };
          }
          const updated = state.basket.map((item) =>
            item.product.id === productId ? { ...item, quantity: safeQty } : item
          );
          return { basket: updated };
        });
      },

      clearBasket: () => set({ basket: [] }),

      setBasket: (items) => set({ basket: items }),

      setLocation: (selectedLocation) => set({ selectedLocation }),

      addPoints: (points) =>
        set((state) => ({ userPoints: state.userPoints + points })),

      setPoints: (userPoints) => set({ userPoints }),

      toggleBasketDrawer: (open) =>
        set((state) => ({
          isBasketDrawerOpen:
            open !== undefined ? open : !state.isBasketDrawerOpen,
        })),

      toggleTheme: () => {
        set((state) => {
          const nextTheme = state.theme === "light" ? "dark" : "light";
          if (typeof document !== "undefined") {
            if (nextTheme === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }
          return { theme: nextTheme };
        });
      },

      getBasketTotalEstimated: () => {
        const state = get();
        return state.basket.reduce((sum, item) => {
          const price = item.product.min_price || 0;
          return sum + price * item.quantity;
        }, 0);
      },

      toggleChecklistItem: (productId) => {
        set((state) => {
          const exists = state.checklistCheckedIds.includes(productId);
          return {
            checklistCheckedIds: exists
              ? state.checklistCheckedIds.filter((id) => id !== productId)
              : [...state.checklistCheckedIds, productId],
          };
        });
      },

      checkAllItems: () => {
        set((state) => ({
          checklistCheckedIds: state.basket.map((item) => item.product.id),
        }));
      },

      uncheckAllItems: () => {
        set({ checklistCheckedIds: [] });
      },

      setChecklistMarket: (checklistSelectedMarket) => {
        set({ checklistSelectedMarket });
      },

      setLanguage: (lang) => {
        const normalized: Language =
          lang === "ru" || (lang as string) === "rus"
            ? "ru"
            : lang === "en" || (lang as string) === "eng"
            ? "en"
            : "az";
        set({ language: normalized });
      },
    }),
    {
      name: "sebet-storage-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        basket: state.basket,
        selectedLocation: state.selectedLocation,
        userPoints: state.userPoints,
        theme: state.theme,
        language: state.language,
        checklistCheckedIds: state.checklistCheckedIds,
        checklistSelectedMarket: state.checklistSelectedMarket,
      }),
    }
  )
);

// Unified Sebet alias
export const useSebetStore = useSebEtStore;
export type SebetState = SebEtState;

