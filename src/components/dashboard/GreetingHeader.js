"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

function getGreeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function GreetingHeader() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const firstName = user?.full_name?.split(" ")[0] || "there";
  const greeting = getGreeting(now.getHours());
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-500/10 border border-brand-500/20 p-6">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-overline text-brand-400 mb-1">
            {formatDate(now)}
          </p>
          <h1 className="text-h2 text-heading">
            {greeting},{" "}
            <span className="text-gradient">{firstName}</span>
          </h1>
          <p className="text-body-sm text-muted mt-1">
            Your command center is ready.
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-3xl font-bold text-heading tabular-nums">
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  );
}
