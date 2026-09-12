export const theme = {
  colors: {
    bgPrimary: "#101312",
    bgSecondary: "#171b1a",
    bgTertiary: "#1f2422",
    bgElevated: "#282e2b",
    textPrimary: "#e7ece9",
    textSecondary: "#9ca3a0",
    textMuted: "#6b716e",
    accent: "#10b981",
    accentLight: "#6ee7b7",
    accentDark: "#047857",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
  shadows: {
    neumorphLight: "rgba(40, 46, 43, 0.5)",
    neumorphDark: "rgba(6, 8, 7, 0.7)",
  },
  radii: {
    neumorph: "16px",
    sm: "8px",
    md: "12px",
    lg: "20px",
  },
} as const;

export type Theme = typeof theme;
