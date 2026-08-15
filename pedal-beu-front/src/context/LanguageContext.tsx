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
  dashboard: { en: "Dashboard", am: "ዳሽቦርድ" },
  orders: { en: "Orders", am: "ትዕዛዞች" },
  earnings: { en: "Earnings", am: "ገቢ" },
  profile: { en: "Profile", am: "መገለጫ" },
  home: { en: "Home", am: "መነሻ" },
  cart: { en: "Cart", am: "ጋሪ" },

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
