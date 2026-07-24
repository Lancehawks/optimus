"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { authService } from "@/services/api";

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = "optimus-theme";

export const DEFAULT_THEME_ID = "optimus-violet";

export const THEMES = [
  {
    id: DEFAULT_THEME_ID,
    label: "Optimus Violet",
    description: "Creative, modern and premium.",
    mode: "light",
    colors: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      softAccent: "#F3E8FF",
      background: "#F8F7FB",
      card: "#FFFFFF",
      border: "#E7E3EC",
      text: "#18151D",
    },
  },
  {
    id: "ocean-blue",
    label: "Ocean Blue",
    description: "Trustworthy, focused and enterprise-friendly.",
    mode: "light",
    colors: {
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      softAccent: "#EAF2FF",
      background: "#F7F9FC",
      card: "#FFFFFF",
      border: "#DFE5EE",
      text: "#172033",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    description: "Productive, clean and balanced.",
    mode: "light",
    colors: {
      primary: "#059669",
      primaryHover: "#047857",
      softAccent: "#E5F7F1",
      background: "#F7FAF9",
      card: "#FFFFFF",
      border: "#DCE8E4",
      text: "#17211E",
    },
  },
  {
    id: "rose",
    label: "Rose",
    description: "Warm, expressive and contemporary.",
    mode: "light",
    colors: {
      primary: "#E11D68",
      primaryHover: "#BE185D",
      softAccent: "#FCE7F1",
      background: "#FCF8FA",
      card: "#FFFFFF",
      border: "#EDE1E7",
      text: "#21171C",
    },
  },
  {
    id: "amber",
    label: "Amber",
    description: "Warm, energetic and planning-friendly.",
    mode: "light",
    colors: {
      primary: "#D97706",
      primaryHover: "#B45309",
      softAccent: "#FFF3D6",
      background: "#FBFAF7",
      card: "#FFFFFF",
      border: "#E9E4D8",
      text: "#211D16",
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Mature, editorial and distraction-free.",
    mode: "light",
    colors: {
      primary: "#27272A",
      primaryHover: "#18181B",
      softAccent: "#EFEFF1",
      background: "#F7F7F8",
      card: "#FFFFFF",
      border: "#E1E1E4",
      text: "#161618",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "A warm charcoal dark mode for low-light focus.",
    mode: "dark",
    colors: {
      primary: "#A78BFA",
      primaryHover: "#C4B5FD",
      softAccent: "#29233A",
      background: "#111014",
      card: "#19171E",
      border: "#2D2934",
      text: "#F4F2F7",
      secondaryText: "#A9A3B1",
    },
  },
];

const themeIds = new Set(THEMES.map((theme) => theme.id));

function normalizeThemeId(themeId) {
  if (themeId === "donezo") return DEFAULT_THEME_ID;
  return themeIds.has(themeId) ? themeId : DEFAULT_THEME_ID;
}

function applyTheme(themeId) {
  const nextThemeId = normalizeThemeId(themeId);
  const nextTheme = THEMES.find((theme) => theme.id === nextThemeId) || THEMES[0];
  document.documentElement.setAttribute("data-theme", nextTheme.id);
  document.documentElement.style.colorScheme = nextTheme.mode;
  return nextTheme.id;
}

function readStoredTheme() {
  try {
    return normalizeThemeId(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [theme, setThemeState] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    const profileTheme = user?.preferences?.theme;
    const nextTheme = themeIds.has(profileTheme) ? profileTheme : readStoredTheme();
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The selected theme still applies for the current session.
    }
  }, [user?.id, user?.preferences?.theme]);

  const setTheme = useCallback(async (themeId) => {
    const nextTheme = normalizeThemeId(themeId);
    setThemeState(nextTheme);
    applyTheme(nextTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Continue with an in-memory preference when storage is unavailable.
    }

    if (!user) return { persisted: false };

    try {
      const newPreferences = { ...(user.preferences || {}), theme: nextTheme };
      const data = await authService.updateProfile({ preferences: newPreferences });
      updateUser(data.user);
      return { persisted: true };
    } catch {
      return { persisted: false };
    }
  }, [user, updateUser]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
