export const theme = {
  colors: {
    bgPrimary: "#0f0f1a",
    bgSecondary: "#1a1a2e",
    bgTertiary: "#252542",
    bgElevated: "#2d2d4a",
    textPrimary: "#e8e8f0",
    textSecondary: "#a0a0b8",
    textMuted: "#6b6b80",
    accent: "#7c3aed",
    accentLight: "#a78bfa",
    accentDark: "#5b21b6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
  shadows: {
    neumorphLight: "rgba(255, 255, 255, 0.03)",
    neumorphDark: "rgba(0, 0, 0, 0.4)",
  },
  radii: {
    neumorph: "16px",
    sm: "8px",
    md: "12px",
    lg: "20px",
  },
} as const;

export type Theme = typeof theme;
