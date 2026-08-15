import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as lightColors, darkColors, Colors } from "../theme/colors";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  colors: Colors;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "app_theme";

const ThemeProviderInner: React.FC<{
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  children: ReactNode;
}> = ({ theme, setTheme, toggleTheme, children }) => (
  <ThemeContext.Provider
    value={{
      theme,
      isDark: theme === "dark",
      colors: theme === "dark" ? darkColors : lightColors,
      setTheme,
      toggleTheme,
    }}
  >
    {children}
  </ThemeContext.Provider>
);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === "light" || saved === "dark") {
          setThemeState(saved);
        }
      } catch (error) {
        console.log("Failed to load theme preference:", error);
      }
    })();
  }, []);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) =>
      console.log("Failed to save theme preference:", error),
    );
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeProviderInner
      theme={theme}
      setTheme={setTheme}
      toggleTheme={toggleTheme}
    >
      {children}
    </ThemeProviderInner>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
};
