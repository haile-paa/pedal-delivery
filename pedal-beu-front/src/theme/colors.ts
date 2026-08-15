export const colors = {
  // Primary purple theme - glowing purple
  primary: "#8B5CF6", // Vibrant violet-500
  primaryLight: "#C4B5FD", // Light violet-300
  primaryGlow: "#A78BFA", // Medium violet-400 for glow effects
  secondary: "#7C3AED", // Deep violet-600
  accent: "#F0ABFC", // Fuchsia-300 for highlights

  // Neutral Colors
  white: "#FFFFFF",
  black: "#000000",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",

  // Semantic Colors
  warningLight: "#FEF3C7",
  successLight: "#D1FAE5",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Background Colors
  background: "#FFFFFF",
  surface: "#F8FAFC",
  card: "#FFFFFF",
};

// Dark palette. Mirrors every key in `colors` above (same primary/semantic
// accents, inverted neutrals) so any component that switches from the
// static `colors` import to `useTheme().colors` picks up dark mode without
// further changes. `gray*` is inverted (gray900 becomes near-white — used
// for "primary text" in most screens) so text/background contrast stays
// correct in dark mode without touching each screen's style values.
export const darkColors: typeof colors = {
  primary: "#8B5CF6",
  primaryLight: "#C4B5FD",
  primaryGlow: "#A78BFA",
  secondary: "#A78BFA",
  accent: "#F0ABFC",

  white: "#1E1E24", // "card/surface" color in most screens — dark here on purpose
  black: "#FFFFFF",
  gray50: "#15151A",
  gray100: "#1E1E24",
  gray200: "#2B2B33",
  gray300: "#3A3A45",
  gray400: "#6B7280",
  gray500: "#9CA3AF",
  gray600: "#B5B9C2",
  gray700: "#D1D5DB",
  gray800: "#E5E7EB",
  gray900: "#F5F5F7",

  warningLight: "#3A2E10",
  successLight: "#0F2E22",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",

  background: "#121216",
  surface: "#1A1A20",
  card: "#1E1E24",
};

export type Colors = typeof colors;

export const getThemeColors = (theme: "light" | "dark"): Colors =>
  theme === "dark" ? darkColors : colors;
