"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { authService } from "@/services/api";

const ThemeContext = createContext(null);

export const THEMES = [
  {
    id: "teal",
    label: "Dark Teal",
    description: "Cool and precise",
    swatch: "#14b8a6",
    dataAttr: null, // default, no data-theme needed
  },
  {
    id: "charcoal-gold",
    label: "Charcoal & Gold",
    description: "Warm and refined",
    swatch: "#f59e0b",
    dataAttr: "charcoal-gold",
  },
  {
    id: "warm-copper",
    label: "Warm Copper",
    description: "Earthy and rich",
    swatch: "#f97316",
    dataAttr: "warm-copper",
  },
];

function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) return;

  if (theme.dataAttr) {
    document.documentElement.setAttribute("data-theme", theme.dataAttr);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [theme, setThemeState] = useState("teal");

  // On mount / user change: read theme from user preferences or localStorage
  useEffect(() => {
    const userTheme = user?.preferences?.theme;
    const localTheme = localStorage.getItem("optimus-theme");
    const resolved = userTheme || localTheme || "teal";

    setThemeState(resolved);
    applyTheme(resolved);
  }, [user]);

  const setTheme = useCallback(
    async (themeId) => {
      setThemeState(themeId);
      applyTheme(themeId);
      localStorage.setItem("optimus-theme", themeId);

      // Persist to user profile if logged in
      if (user) {
        try {
          const currentPrefs = user.preferences || {};
          const newPrefs = { ...currentPrefs, theme: themeId };
          const data = await authService.updateProfile({ preferences: newPrefs });
          updateUser(data.user);
        } catch {
          // Silent fail — localStorage is the fallback
        }
      }
    },
    [user, updateUser]
  );

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
