"use client";

import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { Spinner } from "@/components/ui";

export default function DashboardLayout({ children }) {
  const { user, isLoading } = useAuth();

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
      <Sidebar />
      <NotificationCenter />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
