"use client";

import { useEffect, useState } from "react";
import { founderTheme } from "@/lib/founderValues";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "../constants";

/** Lobby theme, persisted per browser and synchronized across its tabs. */
export function useFounderTheme() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [themeNotice, setThemeNotice] = useState("");

  useEffect(() => {
    const restore = () => {
      try { setTheme(founderTheme(localStorage.getItem(THEME_STORAGE_KEY))); }
      catch { /* Storage can be disabled; the default still works. */ }
    };
    restore();
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, []);

  const changeTheme = (value) => {
    const next = founderTheme(value);
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); setThemeNotice(""); }
    catch { setThemeNotice("Theme applied for this visit. Browser storage is unavailable."); }
  };

  return { theme, themeNotice, changeTheme };
}
