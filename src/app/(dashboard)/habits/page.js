"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui";
import ChecklistView from "@/components/checklist/ChecklistView";
import ChecklistHistory from "@/components/checklist/ChecklistHistory";
import DayPlannerView from "@/components/day-plan/DayPlannerView";
import { cn } from "@/lib/utils";

const PAGE_TABS = [
  {
    key: "checklist",
    label: "Daily Checklist",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    key: "planner",
    label: "Day Planner",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HabitsPage() {
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") || "checklist";
  const [activeTab, setActiveTab] = useState(
    PAGE_TABS.some((t) => t.key === initialTab) ? initialTab : "checklist"
  );

  // Checklist sub-view: "today" | "week" | "month"
  const [checklistView, setChecklistView] = useState("today");

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "checklist") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] lg:h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-h1">Routines</h1>
          <div className="flex items-center gap-2">
            {/* Checklist view toggles */}
            {activeTab === "checklist" && (
              <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5 border border-border">
                {[
                  { key: "today", label: "Today" },
                  { key: "week", label: "Week" },
                  { key: "month", label: "Month" },
                ].map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setChecklistView(v.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-body-sm cursor-pointer transition-colors",
                      checklistView === v.key
                        ? "bg-surface shadow-sm text-heading"
                        : "text-muted hover:text-body"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Tabs tabs={PAGE_TABS} activeTab={activeTab} onChange={handleTabChange} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {activeTab === "checklist" && (
          checklistView === "today"
            ? <ChecklistView />
            : <ChecklistHistory viewMode={checklistView} />
        )}
        {activeTab === "planner" && <DayPlannerView />}
      </div>
    </div>
  );
}
