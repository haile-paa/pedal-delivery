import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Language = "en" | "am";

// Starter dictionary covering navigation chrome and the Settings screen.
// Any screen can adopt more keys over time by adding entries here and
// swapping its hardcoded strings for t('key').
const translations: Record<string, Record<Language, string>> = {
  // Navigation chrome
  dashboard: { en: "Dashboard", am: "ዳሽቦርድ" },
  orders: { en: "Orders", am: "ትዕዛዞች" },
  earnings: { en: "Earnings", am: "ገቢ" },
  profile: { en: "Profile", am: "መገለጫ" },
  home: { en: "Home", am: "መነሻ" },
  cart: { en: "Cart", am: "ጋሪ" },

  // Settings screen
  settings: { en: "Settings", am: "ቅንብሮች" },
  appearance: { en: "Appearance", am: "ገጽታ" },
  darkMode: { en: "Dark Mode", am: "ጨለማ ገጽታ" },
  darkModeDesc: {
    en: "Easier on the eyes in low light",
    am: "ብርሃን ባነሰበት ቦታ ለዓይን ምቹ",
  },
  language: { en: "Language", am: "ቋንቋ" },
  languageDesc: {
    en: "Choose the app's display language",
    am: "የመተግበሪያውን ቋንቋ ይምረጡ",
  },
  english: { en: "English", am: "እንግሊዝኛ" },
  amharic: { en: "Amharic", am: "አማርኛ" },
  account: { en: "Account", am: "መለያ" },
  notifications: { en: "Notifications", am: "ማሳወቂያዎች" },
  pushNotifications: { en: "Push Notifications", am: "የግፋ ማሳወቂያዎች" },
  save: { en: "Save", am: "አስቀምጥ" },
  back: { en: "Back", am: "ተመለስ" },

  // Common / shared actions
  cancel: { en: "Cancel", am: "ይቅር" },
  remove: { en: "Remove", am: "አስወግድ" },
  clearAll: { en: "Clear All", am: "ሁሉንም አጽዳ" },
  retry: { en: "Retry", am: "እንደገና ሞክር" },
  enable: { en: "Enable", am: "አንቃ" },
  goBack: { en: "Go Back", am: "ተመለስ" },
  guest: { en: "Guest", am: "እንግዳ" },
  loadingEllipsis: { en: "Loading...", am: "በመጫን ላይ..." },
  note: { en: "Note", am: "ማስታወሻ" },
  more: { en: "more", am: "ተጨማሪ" },
  add: { en: "Add", am: "ጨምር" },
  unavailable: { en: "Unavailable", am: "አይገኝም" },
  away: { en: "away", am: "ርቀት ላይ" },
  minAbbrev: { en: "min", am: "ደቂቃ" },
  birr: { en: "Birr", am: "ብር" },

  // Home screen
  helloGreeting: { en: "Hello", am: "ሰላም" },
  whatToOrderToday: {
    en: "What would you like to order today?",
    am: "ዛሬ ምን ማዘዝ ይፈልጋሉ?",
  },
  gettingLocation: { en: "Getting your location...", am: "አካባቢዎን በማግኘት ላይ..." },
  showingNearby: {
    en: "Showing restaurants near you",
    am: "በአቅራቢያዎ ያሉ ምግብ ቤቶች እያሳየ ነው",
  },
  locationNotEnabled: { en: "Location not enabled", am: "አካባቢ አልነቃም" },
  searchRestaurantsPlaceholder: {
    en: "Search restaurants or cuisines...",
    am: "ምግብ ቤቶችን ወይም ምግቦችን ይፈልጉ...",
  },
  filters: { en: "Filters", am: "ማጣሪያዎች" },
  filtersComingSoon: {
    en: "Filter functionality coming soon!",
    am: "የማጣሪያ ተግባር በቅርቡ ይመጣል!",
  },
  allRestaurants: { en: "All Restaurants", am: "ሁሉም ምግብ ቤቶች" },
  noRestaurantsAvailable: {
    en: "No restaurants available",
    am: "ምንም ምግብ ቤት አይገኝም",
  },
  noRestaurantsMatch: {
    en: "No restaurants match your search",
    am: "ከፍለጋዎ ጋር የሚዛመድ ምግብ ቤት የለም",
  },
  checkBackLater: {
    en: "Please check back later or contact support",
    am: "እባክዎ ቆይተው ይሞክሩ ወይም ድጋፍን ያግኙ",
  },
  adjustSearchFilters: {
    en: "Try adjusting your search or filters",
    am: "ፍለጋዎን ወይም ማጣሪያዎችን ይቀይሩ",
  },

  // Favorites screen
  favoriteRestaurants: { en: "Favorite Restaurants", am: "ተወዳጅ ምግብ ቤቶች" },
  noFavoritesYet: { en: "No favorites yet", am: "እስካሁን ተወዳጅ የለም" },
  noFavoritesDesc: {
    en: "Tap the heart on any restaurant to save it here.",
    am: "እዚህ ለማስቀመጥ በማንኛውም ምግብ ቤት ላይ ያለውን ልብ ይንኩ።",
  },

  // Restaurant card
  unnamedRestaurant: { en: "Unnamed Restaurant", am: "ስም ያልተሰጠው ምግብ ቤት" },
  noCuisineType: { en: "No cuisine type", am: "የምግብ ዓይነት የለም" },

  // Cart screen
  yourCart: { en: "Your Cart", am: "የእርስዎ ጋሪ" },
  cartEmptyTitle: { en: "Your cart is empty", am: "ጋሪዎ ባዶ ነው" },
  cartEmptyDesc: {
    en: "Add delicious food from restaurants to get started!",
    am: "ለመጀመር ጣፋጭ ምግብ ከምግብ ቤቶች ይጨምሩ!",
  },
  browseRestaurants: { en: "Browse Restaurants", am: "ምግብ ቤቶችን ያስሱ" },
  removeItemTitle: { en: "Remove Item", am: "ዕቃ አስወግድ" },
  removeItemConfirm: {
    en: "Are you sure you want to remove this item from your cart?",
    am: "ይህን ዕቃ ከጋሪዎ ማስወገድ እርግጠኛ ነዎት?",
  },
  clearCartTitle: { en: "Clear Cart", am: "ጋሪ አጽዳ" },
  clearCartConfirm: {
    en: "Are you sure you want to clear your entire cart?",
    am: "ጋሪዎን ሙሉ በሙሉ ማጽዳት እርግጠኛ ነዎት?",
  },
  emptyCartTitle: { en: "Empty Cart", am: "ባዶ ጋሪ" },
  emptyCartDesc: {
    en: "Your cart is empty. Add some items first!",
    am: "ጋሪዎ ባዶ ነው። መጀመሪያ ዕቃዎችን ይጨምሩ!",
  },
  restaurantInfoNeededTitle: {
    en: "Restaurant Information Needed",
    am: "የምግብ ቤት መረጃ ያስፈልጋል",
  },
  restaurantInfoNeededDesc: {
    en: "We need restaurant information to proceed with checkout. Please go back to the restaurant page and try again.",
    am: "ግዢውን ለመቀጠል የምግብ ቤት መረጃ ያስፈልገናል። እባክዎ ወደ ምግብ ቤቱ ገጽ ተመልሰው እንደገና ይሞክሩ።",
  },
  addons: { en: "Add-ons", am: "ተጨማሪዎች" },
  subtotal: { en: "Subtotal", am: "ንዑስ ድምር" },
  deliveryFee: { en: "Delivery Fee", am: "የመላኪያ ክፍያ" },
  serviceCharge: { en: "Service Charge", am: "የአገልግሎት ክፍያ" },
  tax: { en: "Tax", am: "ታክስ" },
  total: { en: "Total", am: "ጠቅላላ" },
  itemSingular: { en: "item", am: "ዕቃ" },
  itemPlural: { en: "items", am: "ዕቃዎች" },
  proceedToCheckout: { en: "Proceed to Checkout", am: "ወደ ክፍያ ይቀጥሉ" },

  // Profile screen
  updateTitle: { en: "Update", am: "አዘምን" },
  editProfileComingSoon: {
    en: "Edit profile feature coming soon!",
    am: "የመገለጫ ማስተካከያ ተግባር በቅርቡ ይመጣል!",
  },
  editProfile: { en: "Edit Profile", am: "መገለጫ አስተካክል" },
  permissionRequiredTitle: { en: "Permission Required", am: "ፈቃድ ያስፈልጋል" },
  photoPermissionDesc: {
    en: "Please allow photo access to update your profile picture.",
    am: "የመገለጫ ፎቶዎን ለማዘመን የፎቶ መዳረሻ ይፍቀዱ።",
  },
  errorTitle: { en: "Error", am: "ስህተት" },
  avatarUpdateFailed: {
    en: "Could not update your profile picture. Please try again.",
    am: "የመገለጫ ፎቶዎን ማዘመን አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
  },
  logoutTitle: { en: "Logout", am: "ውጣ" },
  logoutConfirm: {
    en: "Are you sure you want to logout?",
    am: "መውጣት እርግጠኛ ነዎት?",
  },
  myOrders: { en: "My Orders", am: "ትዕዛዞቼ" },
  savedAddresses: { en: "Saved Addresses", am: "የተቀመጡ አድራሻዎች" },
  comingSoonTitle: { en: "Coming Soon", am: "በቅርቡ ይመጣል" },
  helpAndSupport: { en: "Help & Support", am: "እገዛ እና ድጋፍ" },
  supportSubtitle: {
    en: "Need a hand? We're here for you anytime.",
    am: "እርዳታ ይፈልጋሉ? በማንኛውም ጊዜ ከጎንዎ ነን።",
  },
  supportPhoneLabel: { en: "Call us", am: "ይደውሉልን" },
  supportEmailLabel: { en: "Email us", am: "በኢሜይል ያግኙን" },
  supportLiveChatLabel: { en: "Live chat", am: "ቀጥታ ውይይት" },
  supportLiveChatValue: {
    en: "Available 8am – 10pm daily",
    am: "በየቀኑ ከጠዋቱ 2 - ምሽት 4 ይገኛል",
  },
  callSupport: { en: "Call Support", am: "ድጋፍን ይደውሉ" },
  emailSupport: { en: "Email Support", am: "ድጋፍን በኢሜይል ያግኙ" },
  close: { en: "Close", am: "ዝጋ" },
  favorites: { en: "Favorites", am: "ተወዳጆች" },
  addresses: { en: "Addresses", am: "አድራሻዎች" },

  // Order History screen
  restaurantFallback: { en: "Restaurant", am: "ምግብ ቤት" },
  allOrders: { en: "All Orders", am: "ሁሉም ትዕዛዞች" },
  allCategory: { en: "All", am: "ሁሉም" },
  active: { en: "Active", am: "ንቁ" },
  delivered: { en: "Delivered", am: "ደርሷል" },
  cancelled: { en: "Cancelled", am: "ተሰርዟል" },
  unknownDate: { en: "Unknown date", am: "ያልታወቀ ቀን" },
  invalidDate: { en: "Invalid date", am: "የተሳሳተ ቀን" },
  reorder: { en: "Reorder", am: "እንደገና ይዘዙ" },
  orderHash: { en: "Order #", am: "ትዕዛዝ #" },
  moreItems: { en: "more items", am: "ተጨማሪ ዕቃዎች" },
  viewDetails: { en: "View Details", am: "ዝርዝር ይመልከቱ" },
  loadingOrders: { en: "Loading your orders...", am: "ትዕዛዞችዎን በመጫን ላይ..." },
  orderHistory: { en: "Order History", am: "የትዕዛዝ ታሪክ" },
  ordersFound: { en: "orders found", am: "ትዕዛዞች ተገኝተዋል" },
  noOrdersFound: { en: "No orders found", am: "ምንም ትዕዛዝ አልተገኘም" },
  noOrdersYet: {
    en: "You haven't placed any orders yet",
    am: "እስካሁን ምንም ትዕዛዝ አላዘዙም",
  },
  noFilteredOrders: {
    en: "You don't have any orders in this category",
    am: "በዚህ ምድብ ውስጥ ምንም ትዕዛዝ የለዎትም",
  },

  // Tracking map / order notification / online toggle
  pickupLocation: { en: "Pickup location", am: "መውሰጃ ቦታ" },
  driverLabel: { en: "Driver", am: "አሽከርካሪ" },
  foodIsHere: { en: "Your food is here", am: "ምግብዎ እዚህ ነው" },
  yourLocation: { en: "Your Location", am: "የእርስዎ አካባቢ" },
  deliveryDestination: { en: "Delivery destination", am: "የመላኪያ መድረሻ" },
  orderPreparing: { en: "Order Preparing", am: "ትዕዛዝ በዝግጅት ላይ" },
  driverOnTheWay: { en: "Driver On The Way", am: "አሽከርካሪ በመንገድ ላይ" },
  etaLabel: { en: "ETA", am: "የሚደርስበት ጊዜ" },
  rejectOrder: { en: "Reject", am: "ውድቅ አድርግ" },
  acceptOrder: { en: "Accept", am: "ተቀበል" },
  onlineLabel: { en: "ONLINE", am: "መስመር ላይ" },
  offlineLabel: { en: "OFFLINE", am: "መስመር ውጭ" },
};

export type TranslationKey = keyof typeof translations;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "app_language";

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === "en" || saved === "am") {
          setLanguageState(saved);
        }
      } catch (error) {
        console.log("Failed to load language preference:", error);
      }
    })();
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) =>
      console.log("Failed to save language preference:", error),
    );
  };

  const t = (key: TranslationKey | string): string => {
    const entry = translations[key as TranslationKey];
    if (!entry) return key;
    return entry[language] || entry.en;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextValue => {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
