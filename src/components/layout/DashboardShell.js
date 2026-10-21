"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import QuickCaptureModal from "@/components/quick-capture/QuickCaptureModal";
import GlobalCommandPalette from "@/components/search/GlobalCommandPalette";

const SIDEBAR_STORAGE_KEY = "optimus-sidebar-visibility-v2";
const DESKTOP_QUERY = "(min-width: 1024px)";

export default function DashboardShell({ children }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [collapsedPreference, setCollapsedPreference] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    try {
      setCollapsedPreference(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed");
    } catch {
      // Keep the readable expanded default when preference storage is unavailable.
    }
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const openQuickCapture = () => setQuickCaptureOpen(true);
    const openCommandPalette = () => setCommandPaletteOpen(true);
    window.addEventListener("optimus-open-quick-capture", openQuickCapture);
    window.addEventListener("optimus-open-command-palette", openCommandPalette);
    return () => {
      window.removeEventListener("optimus-open-quick-capture", openQuickCapture);
      window.removeEventListener("optimus-open-command-palette", openCommandPalette);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (event.shiftKey) setQuickCaptureOpen(true);
        else setCommandPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSidebar = () => {
    setCollapsedPreference((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {
        // The current session can still toggle without persistence.
      }
      return next;
    });
  };

  const collapsed = collapsedPreference && isDesktop;

  return (
    <div className="app-shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleSidebar}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onOpenCapture={() => setQuickCaptureOpen(true)}
        showDashboardAlerts={isDashboard}
      />
      <main className="app-main">
        <div className="app-sheet" id="app-sheet">
          {children}
        </div>
      </main>
      <QuickCaptureModal isOpen={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
      <GlobalCommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
