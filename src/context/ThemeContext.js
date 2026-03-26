"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { authService } from "@/services/api";

const ThemeContext = createContext(null);

export const THEMES = [
  {
    id: "dark",
    label: "Dark",
    description: "Soft depth with indigo",
    swatch: "#818cf8",
  },
  {
    id: "light",
    label: "Light",
    description: "Clean and bright",
    swatch: "#6366f1",
  },
  {
    id: "system",
    label: "System",
    description: "Follows your OS",
    swatch: "#6b7590",
  },
];

/** Check OS preference */
function getSystemPreference() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Resolve "system" to the actual mode, pass through "dark"/"light" */
function resolveTheme(themeId) {
  if (themeId === "system") return getSystemPreference();
  return themeId;
}

/** Apply the resolved theme to the DOM */
function applyTheme(resolved) {
  if (resolved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [theme, setThemeState] = useState("dark");

  // On mount / user change: read theme from user preferences or localStorage
  useEffect(() => {
    const userTheme = user?.preferences?.theme;
    const localTheme = localStorage.getItem("optimus-theme");
    const resolved = userTheme || localTheme || "dark";

    setThemeState(resolved);
    applyTheme(resolveTheme(resolved));
  }, [user]);

  // Listen for OS theme changes when "system" is selected
  useEffect(() => {
    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme(getSystemPreference());

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback(
    async (themeId) => {
      setThemeState(themeId);
      applyTheme(resolveTheme(themeId));
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
