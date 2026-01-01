import { colors } from "./colors";
import { spacing } from "./spacing";

export const theme = {
  colors,
  spacing,
  typography: {
    h1: {
      fontSize: 24,
      fontWeight: "bold",
    },
    h2: {
      fontSize: 20,
      fontWeight: "600",
    },
    body: {
      fontSize: 16,
      fontWeight: "normal",
    },
    caption: {
      fontSize: 14,
      fontWeight: "normal",
    },
  },
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
  },
};

export type Theme = typeof theme;
