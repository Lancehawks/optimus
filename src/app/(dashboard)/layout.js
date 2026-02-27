"use client";

import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
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
    <div className="flex min-h-screen bg-surface-secondary">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
