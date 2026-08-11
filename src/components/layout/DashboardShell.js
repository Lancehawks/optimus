"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import QuickCaptureFab from "@/components/quick-capture/QuickCaptureFab";
import QuickCaptureModal from "@/components/quick-capture/QuickCaptureModal";
import GlobalCommandPalette from "@/components/search/GlobalCommandPalette";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "optimus-sidebar-visibility-v2";

export default function DashboardShell({ children }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed");
    } catch {
      // Keep the readable expanded default when preference storage is unavailable.
    }
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
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {
        // The current session can still toggle without persistence.
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        "donezo-shell",
        sidebarCollapsed && "donezo-shell-collapsed",
        isDashboard && "donezo-shell-dashboard"
      )}
      data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
      style={{ "--donezo-sidebar-width": sidebarCollapsed ? "72px" : "218px" }}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        showDashboardAlerts={isDashboard}
      />
      <main className="donezo-main">
        <div className="app-canvas donezo-canvas">{children}</div>
      </main>
      {!isDashboard && (
        <QuickCaptureFab isOpen={quickCaptureOpen} onClick={() => setQuickCaptureOpen(true)} />
      )}
      <QuickCaptureModal isOpen={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
      <GlobalCommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
