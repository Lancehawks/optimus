"use client";

import { cn } from "@/lib/utils";

export default function QuickCaptureFab({ isOpen, onClick }) {
  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open quick capture"
      title="Quick Capture"
      className={cn(
        "group fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full",
        "bg-brand-500 text-on-primary shadow-brand-lg ring-4 ring-brand-500/12",
        "transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-glow",
        "focus-visible:outline-none focus-visible:shadow-focus-ring",
        "sm:bottom-6 sm:right-6"
      )}
    >
      <span className="absolute -top-10 right-0 hidden whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1 text-caption font-semibold text-heading! opacity-0 shadow-md transition-opacity group-hover:opacity-100 lg:block">
        Quick capture
      </span>
      <svg
        className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>
  );
}

