"use client";

import { cn } from "@/lib/utils";

export default function Tabs({ tabs = [], activeTab, onChange, className }) {
  return (
    <div
      className={cn("flex border-b border-border gap-1", className)}
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
              "relative flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium transition-colors -mb-px cursor-pointer",
              isActive
                ? "text-brand-600! border-b-2 border-brand-500"
                : "text-muted! hover:text-heading!"
            )}
          >
            {tab.icon && <span className="h-4 w-4 shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[0.6875rem] px-1.5 py-px rounded-full font-medium",
                  isActive
                    ? "bg-brand-100 text-brand-600"
                    : "bg-neutral-100 text-muted"
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
