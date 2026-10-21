"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { authService } from "@/services/api";

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = "optimus-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_THEME_ID = "system";

export const THEMES = [
  { id: "system", label: "System", description: "Follows your device setting." },
  { id: "light", label: "Light", description: "Warm paper tones for daylight." },
  { id: "dark", label: "Dark", description: "Quiet charcoal for low light." },
];

const themeIds = new Set(THEMES.map((theme) => theme.id));

// Earlier releases stored colour themes; only Midnight maps to a mode.
function normalizeThemeId(themeId) {
  if (themeId === "midnight") return "dark";
  return themeIds.has(themeId) ? themeId : DEFAULT_THEME_ID;
}

function resolveMode(themeId) {
  if (themeId === "light" || themeId === "dark") return themeId;
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(themeId) {
  const mode = resolveMode(themeId);
  document.documentElement.setAttribute("data-theme", mode);
  return mode;
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
  const [mode, setMode] = useState("light");

  useEffect(() => {
    const profileTheme = user?.preferences?.theme;
    const nextTheme = themeIds.has(profileTheme) ? profileTheme : readStoredTheme();
    setThemeState(nextTheme);
    setMode(applyTheme(nextTheme));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The selected appearance still applies for the current session.
    }
  }, [user?.id, user?.preferences?.theme]);

  // Track the operating system while the user follows it.
  useEffect(() => {
    if (theme !== "system") return undefined;
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => setMode(applyTheme("system"));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback(async (themeId) => {
    const nextTheme = normalizeThemeId(themeId);
    setThemeState(nextTheme);
    setMode(applyTheme(nextTheme));

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
    <ThemeContext.Provider value={{ theme, mode, setTheme, themes: THEMES }}>
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
