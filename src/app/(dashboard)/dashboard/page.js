"use client";

import { useAuth } from "@/context/AuthContext";

const stats = [
  {
    label: "Tasks Due Today",
    value: "—",
    accent: "border-l-brand-500",
    iconBg: "bg-brand-500/10 text-brand-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Notes Updated",
    value: "—",
    accent: "border-l-green-500",
    iconBg: "bg-emerald-500/10 text-emerald-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    label: "Upcoming Events",
    value: "—",
    accent: "border-l-amber-500",
    iconBg: "bg-amber-500/10 text-amber-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-6 mb-8">
        <h1 className="text-2xl font-bold text-heading">
          Welcome back, {user?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-brand-400 mt-1 text-sm">
          Here&apos;s your overview for today
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`card card-hover p-5 border-l-4 ${stat.accent}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-caption mb-0.5">{stat.label}</p>
                <p className="text-2xl font-bold text-heading">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6">
          <h3 className="text-h4 mb-3">Recent Tasks</h3>
          <p className="text-body-sm text-muted!">
            Your recent tasks will appear here. Head to the Tasks page to get started.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-h4 mb-3">Recent Notes</h3>
          <p className="text-body-sm text-muted!">
            Your recent notes will appear here. Head to the Notes page to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
