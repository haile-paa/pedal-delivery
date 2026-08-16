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

// Exported (not just the hook) so screens/layouts that must never follow
// the user's dark-mode preference — e.g. the pre-login auth flow, which
// isn't designed for dark colors — can provide their own fixed value via
// ForceLightTheme below instead of the app-wide ThemeProvider's value.
export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

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

// Pins every useTheme() call underneath it to the light palette, ignoring
// whatever the signed-in user's dark-mode setting is. setTheme/toggleTheme
// are no-ops here on purpose — there's no theme toggle in this flow (see
// app/(auth)/_layout.tsx), so nothing should ever call them.
export const ForceLightTheme: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ThemeContext.Provider
    value={{
      theme: "light",
      isDark: false,
      colors: lightColors,
      setTheme: () => {},
      toggleTheme: () => {},
    }}
  >
    {children}
  </ThemeContext.Provider>
);
