"use client";

import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-h1">
          Welcome back, {user?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-body text-muted! mt-2">
          Here&apos;s your overview for today
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick stats cards - placeholder */}
        {[
          { label: "Tasks Due Today", value: "—", color: "text-brand-500" },
          { label: "Notes Updated", value: "—", color: "text-success" },
          { label: "Upcoming Events", value: "—", color: "text-info" },
        ].map((stat) => (
          <div key={stat.label} className="card p-6">
            <p className="text-caption mb-1">{stat.label}</p>
            <p className={`text-display ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-8 text-center">
        <p className="text-body text-muted!">
          Dashboard widgets coming soon. Use the sidebar to navigate to Tasks, Notes, and other modules.
        </p>
      </div>
    </div>
  );
}
