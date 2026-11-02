"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui";
import ChecklistView from "@/components/checklist/ChecklistView";
import ChecklistHistory from "@/components/checklist/ChecklistHistory";
import DayPlannerView from "@/components/day-plan/DayPlannerView";
import PageHeader from "@/components/layout/PageHeader";

const PAGE_TABS = [
  { key: "checklist", label: "Checklist" },
  { key: "planner", label: "Day plan" },
];

const CHECKLIST_VIEWS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default function RoutinesPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "checklist";
  const [activeTab, setActiveTab] = useState(PAGE_TABS.some((t) => t.key === initialTab) ? initialTab : "checklist");
  const [checklistView, setChecklistView] = useState("today");

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "checklist") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Routines"
        description={
          activeTab === "checklist"
            ? "The small things you do every day, and how consistently you do them."
            : "A reusable shape for your day. Apply it to the calendar each morning."
        }
      />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <Tabs variant="underline" tabs={PAGE_TABS} activeTab={activeTab} onChange={handleTabChange} className="min-w-0 flex-1" />
        {activeTab === "checklist" && (
          <Tabs size="sm" tabs={CHECKLIST_VIEWS} activeTab={checklistView} onChange={setChecklistView} className="mb-2" />
        )}
      </div>

      {activeTab === "checklist" &&
        (checklistView === "today" ? <ChecklistView /> : <ChecklistHistory viewMode={checklistView} />)}
      {activeTab === "planner" && <DayPlannerView />}
    </div>
  );
}
