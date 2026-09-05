import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product, BasketItem } from "./types";

export interface BakuLocation {
  name: string;
  lat: number;
  lon: number;
}

export const BAKU_LOCATIONS: BakuLocation[] = [
  { name: "28 May / Nəsimi", lat: 40.3798, lon: 49.8475 },
  { name: "Nərimanov", lat: 40.4024, lon: 49.8712 },
  { name: "Yasamal / İnşaatçılar", lat: 40.3872, lon: 49.8055 },
  { name: "Elmlər Akademiyası", lat: 40.3735, lon: 49.8142 },
  { name: "Nizami / Tarqovı", lat: 40.3752, lon: 49.8335 },
  { name: "Koroğlu", lat: 40.4208, lon: 49.9192 },
];

interface SebEtState {
  basket: BasketItem[];
  selectedLocation: BakuLocation;
  userPoints: number;
  isBasketDrawerOpen: boolean;

  // Actions
  addToBasket: (product: Product, quantity?: number) => void;
  removeFromBasket: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearBasket: () => void;
  setBasket: (items: BasketItem[]) => void;
  setLocation: (location: BakuLocation) => void;
  addPoints: (points: number) => void;
  setPoints: (points: number) => void;
  toggleBasketDrawer: (open?: boolean) => void;
  getBasketTotalEstimated: () => number;
}

export const useSebEtStore = create<SebEtState>()(
  persist(
    (set, get) => ({
      basket: [],
      selectedLocation: BAKU_LOCATIONS[0],
      userPoints: 250,
      isBasketDrawerOpen: false,

      addToBasket: (product, quantity = 1) => {
        set((state) => {
          const existingIndex = state.basket.findIndex(
            (item) => item.product.id === product.id
          );
          if (existingIndex > -1) {
            const updated = [...state.basket];
            updated[existingIndex].quantity += quantity;
            return { basket: updated };
          } else {
            return { basket: [...state.basket, { product, quantity }] };
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
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : null;
              }
              return item;
            })
            .filter((item): item is BasketItem => item !== null);
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

      getBasketTotalEstimated: () => {
        const state = get();
        return state.basket.reduce((sum, item) => {
          const price = item.product.min_price || 0;
          return sum + price * item.quantity;
        }, 0);
      },
    }),
    {
      name: "sebet-storage-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        basket: state.basket,
        selectedLocation: state.selectedLocation,
        userPoints: state.userPoints,
      }),
    }
  )
);

