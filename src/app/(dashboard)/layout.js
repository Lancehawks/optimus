"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui";
import QuickCaptureFab from "@/components/quick-capture/QuickCaptureFab";
import QuickCaptureModal from "@/components/quick-capture/QuickCaptureModal";
import GlobalCommandPalette from "@/components/search/GlobalCommandPalette";

export default function DashboardLayout({ children }) {
  const { user, isLoading } = useAuth();
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (event.shiftKey) {
          setQuickCaptureOpen(true);
        } else {
          setCommandPaletteOpen(true);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-secondary">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null; // Middleware will redirect
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar onOpenSearch={() => setCommandPaletteOpen(true)} />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">{children}</main>
      <QuickCaptureFab
        isOpen={quickCaptureOpen}
        onClick={() => setQuickCaptureOpen(true)}
      />
      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
      />
      <GlobalCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
