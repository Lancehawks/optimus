"use client";

import { useLayoutEffect } from "react";

// Signed-out screens are always light, whatever appearance is saved. The root
// theme script covers full page loads; this covers arriving here after sign-out.
// Inside the app, ThemeProvider applies the saved appearance again.
export default function LightAppearance() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  return null;
}
