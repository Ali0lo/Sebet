import { useSebEtStore } from "./store";

export type Language = "az" | "ru" | "en";

export const translations = {
  az: {
    nav: {
      home: "Ana Səhifə",
      catalog: "Kataloq & Məhsullar",
      basket: "Ağıllı Səbət",
      profile: "Profil",
    },
    home: {
      searchPlaceholder: "Məhsul, brend və ya kateqoriya axtarın...",
      categories: "KATEQORİYALAR",
      viewAll: "Hamısına bax",
      weeklyFlyers: "HƏFTƏLİK KAMPANİYALAR",
      openFlyer: "{chain} jurnalına keçid et →",
      topDeals: "Günün Ən Yaxşı Endirimləri",
      addToCart: "Səbətə at",
      added: "Əlavə edildi",
    },
    categoriesList: {
      dairy: "Süd Məhsulları",
      meat: "Ət & Toyuq",
      bakery: "Çörək & Un",
      produce: "Meyvə & Tərəvəz",
      staples: "Əsas Ərzaq",
      teaCoffee: "Çay & Qəhvə",
      sweets: "Şirniyyat",
      drinks: "İçkilər & Su",
      cleaning: "Təmizlik",
      care: "Şəxsi Qulluq",
    },
    basket: {
      title: "Ağıllı Səbət",
      singleStoreTab: "Tək Market",
      splitStoreTab: "2 Marketə Böl",
      checklistMode: "Mağazada Canlı Rejim",
      total: "Cəmi",
      savings: "Qənaət",
      emptyBasket: "Səbətiniz boşdur",
    },
    profile: {
      title: "İstifadəçi Profili",
      pointsBalance: "Xallarım & Balans",
      rewards: "Market Hədiyyələri & Kuponlar",
      partnerChains: "Tərəfdaş Supermarketlər",
      settings: "Tətbiq Parametrləri",
      darkMode: "Qaranlıq rejim",
      language: "Dil",
    },
    weightModal: {
      title: "Çəki seçin",
      confirm: "Səbətə əlavə et",
      customWeight: "Fərqli çəki (qramla)",
    },
  },
  ru: {
    nav: {
      home: "Главная",
      catalog: "Каталог и товары",
      basket: "Умная корзина",
      profile: "Профиль",
    },
    home: {
      searchPlaceholder: "Поиск товаров, брендов или категорий...",
      categories: "КАТЕГОРИИ",
      viewAll: "Все категории",
      weeklyFlyers: "ЕЖЕНЕДЕЛЬНЫЕ АКЦИИ",
      openFlyer: "Перейти в журнал {chain} →",
      topDeals: "Лучшие скидки дня",
      addToCart: "В корзину",
      added: "Добавлено",
    },
    categoriesList: {
      dairy: "Молочные продукты",
      meat: "Мясо и птица",
      bakery: "Хлеб и выпечка",
      produce: "Фрукты и овощи",
      staples: "Бакалея",
      teaCoffee: "Чай и кофе",
      sweets: "Сладости и снеки",
      drinks: "Напитки и вода",
      cleaning: "Бытовая химия",
      care: "Личная гигиена",
    },
    basket: {
      title: "Умная корзина",
      singleStoreTab: "Один магазин",
      splitStoreTab: "Разделить на 2 магазина",
      checklistMode: "Режим покупок в магазине",
      total: "Итого",
      savings: "Экономия",
      emptyBasket: "Ваша корзина пуста",
    },
    profile: {
      title: "Профиль пользователя",
      pointsBalance: "Баллы и баланс",
      rewards: "Подарки и купоны",
      partnerChains: "Супермаркеты-партнеры",
      settings: "Настройки приложения",
      darkMode: "Темная тема",
      language: "Язык",
    },
    weightModal: {
      title: "Выберите вес",
      confirm: "Добавить в корзину",
      customWeight: "Другой вес (в граммах)",
    },
  },
  en: {
    nav: {
      home: "Home",
      catalog: "Catalog & Products",
      basket: "Smart Basket",
      profile: "Profile",
    },
    home: {
      searchPlaceholder: "Search products, brands or categories...",
      categories: "CATEGORIES",
      viewAll: "View all",
      weeklyFlyers: "WEEKLY CAMPAIGNS",
      openFlyer: "Open {chain} catalog →",
      topDeals: "Top Deals of the Day",
      addToCart: "Add to basket",
      added: "Added",
    },
    categoriesList: {
      dairy: "Dairy & Eggs",
      meat: "Meat & Poultry",
      bakery: "Bakery & Bread",
      produce: "Fruits & Veggies",
      staples: "Pantry Staples",
      teaCoffee: "Tea & Coffee",
      sweets: "Sweets & Snacks",
      drinks: "Drinks & Water",
      cleaning: "Cleaning Supplies",
      care: "Personal Care",
    },
    basket: {
      title: "Smart Basket",
      singleStoreTab: "Single Store",
      splitStoreTab: "Split into 2 Stores",
      checklistMode: "In-Store Live Mode",
      total: "Total",
      savings: "Savings",
      emptyBasket: "Your basket is empty",
    },
    profile: {
      title: "User Profile",
      pointsBalance: "Points & Balance",
      rewards: "Store Rewards & Vouchers",
      partnerChains: "Partner Supermarkets",
      settings: "App Settings",
      darkMode: "Dark Mode",
      language: "Language",
    },
    weightModal: {
      title: "Select Weight",
      confirm: "Add to basket",
      customWeight: "Custom weight (in grams)",
    },
  },
} as const;

export interface TranslationSchema {
  nav: {
    home: string;
    catalog: string;
    basket: string;
    profile: string;
  };
  home: {
    searchPlaceholder: string;
    categories: string;
    viewAll: string;
    weeklyFlyers: string;
    openFlyer: string;
    topDeals: string;
    addToCart: string;
    added: string;
  };
  categoriesList: {
    dairy: string;
    meat: string;
    bakery: string;
    produce: string;
    staples: string;
    teaCoffee: string;
    sweets: string;
    drinks: string;
    cleaning: string;
    care: string;
  };
  basket: {
    title: string;
    singleStoreTab: string;
    splitStoreTab: string;
    checklistMode: string;
    total: string;
    savings: string;
    emptyBasket: string;
  };
  profile: {
    title: string;
    pointsBalance: string;
    rewards: string;
    partnerChains: string;
    settings: string;
    darkMode: string;
    language: string;
  };
  weightModal: {
    title: string;
    confirm: string;
    customWeight: string;
  };
}

export type TranslationDictionary = TranslationSchema;

export function normalizeLanguage(lang: string | undefined | null): Language {
  if (lang === "ru" || lang === "rus") return "ru";
  if (lang === "en" || lang === "eng") return "en";
  return "az";
}

export function useTranslation(): { t: TranslationSchema; language: Language } {
  const rawLang = useSebEtStore((state) => state.language);
  const language = normalizeLanguage(rawLang);
  const t: TranslationSchema = translations[language] || translations.az;
  return { t, language };
}
