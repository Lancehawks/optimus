"use client";

import { cn } from "@/lib/utils";

export default function Tabs({ tabs = [], activeTab, onChange, className }) {
  return (
    <div
      className={cn("optimus-tabs flex gap-1", className)}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              "optimus-tab relative flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium transition-all cursor-pointer",
              isActive
                ? "optimus-tab-active text-brand-400! bg-brand-500/10"
                : "text-muted! hover:text-heading! hover:bg-surface-raised/50"
            )}
          >
            {tab.icon && <span className="h-4 w-4 shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[0.6875rem] px-1.5 py-px rounded-full font-medium",
                  isActive
                    ? "bg-brand-500/20 text-brand-300"
                    : "bg-neutral-600 text-muted"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
