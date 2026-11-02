"use client";

import { cn } from "@/lib/utils";

/**
 * `segmented` switches a view in place; `underline` moves between sections.
 */
export default function Tabs({ tabs = [], activeTab, onChange, variant = "segmented", size = "md", className }) {
  if (variant === "underline") {
    return (
      <div className={cn("flex gap-5 overflow-x-auto border-b border-border scrollbar-none", className)} role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative -mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-[1.5px] pb-2.5 pt-1 text-sm font-medium transition-colors [&_svg]:h-4 [&_svg]:w-4",
                isActive ? "border-heading text-heading" : "border-transparent text-muted hover:text-heading"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="font-mono text-2xs tabular-nums text-muted">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-surface-tertiary p-0.5 scrollbar-none",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
              isActive
                ? "bg-surface text-heading shadow-sm ring-1 ring-black/[0.04]"
                : "text-muted hover:text-heading"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="font-mono text-2xs tabular-nums text-muted">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
