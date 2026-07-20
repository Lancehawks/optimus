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

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <button
            onClick={() => window.dispatchEvent(new Event("optimus-open-review"))}
            className="p-2 rounded-lg text-brand-400/60 hover:text-brand-400 hover:bg-white/6 transition-colors cursor-pointer"
            title="Morning Review"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          </button>
          <span className="text-3xl font-bold text-heading tabular-nums">
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  );
}
