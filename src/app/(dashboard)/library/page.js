"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui";
import PageHeader from "@/components/layout/PageHeader";
import LinksView from "@/components/library/LinksView";
import StudyLibrary from "@/components/library/StudyLibrary";

const TABS = [
  { key: "links", label: "Links", description: "Pages worth returning to, sorted into collections." },
  { key: "resources", label: "Resources", description: "Documents, files and references you keep at hand." },
  { key: "reading", label: "Reading list", description: "Books and articles in progress, and what's next." },
  { key: "flashcards", label: "Flashcards", description: "Decks you review on a spaced schedule." },
];

const TAB_KEYS = new Set(TABS.map((tab) => tab.key));

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialSearch = searchParams.get("search") || "";
  const [activeTab, setActiveTab] = useState(TAB_KEYS.has(requestedTab) ? requestedTab : "links");

  useEffect(() => {
    if (TAB_KEYS.has(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("search");
    window.history.replaceState({}, "", url.toString());
  };

  const current = TABS.find((tab) => tab.key === activeTab) || TABS[0];

  return (
    <div className="page">
      <PageHeader title="Library" description={current.description} />
      <Tabs variant="underline" tabs={TABS} activeTab={activeTab} onChange={handleTabChange} className="mb-8" />
      {activeTab === "links" ? (
        <LinksView initialSearch={initialSearch} />
      ) : (
        <StudyLibrary section={activeTab} initialSearch={activeTab === "resources" ? initialSearch : ""} />
      )}
    </div>
  );
}
