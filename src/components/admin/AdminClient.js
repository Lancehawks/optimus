"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui";
import MembersPanel from "./MembersPanel";
import ModelsPanel from "./ModelsPanel";
import UsagePanel from "./UsagePanel";

const TABS = [
  { key: "members", label: "Members" },
  { key: "models", label: "Models" },
  { key: "usage", label: "Assistant usage" },
];

export default function AdminClient({ currentUserId }) {
  const [tab, setTab] = useState("members");

  return (
    <div className="page">
      <PageHeader
        title="Admin"
        description="Add and manage members, decide who can use the workspace AI key and which models members can pick, and see what it costs."
      />
      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} variant="underline" className="mb-8" />
      {tab === "members" && <MembersPanel currentUserId={currentUserId} />}
      {tab === "models" && <ModelsPanel />}
      {tab === "usage" && <UsagePanel />}
    </div>
  );
}
