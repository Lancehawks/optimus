"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, ErrorState, Spinner, Tabs, useToast } from "@/components/ui";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import CloseSprintModal from "@/components/sprints/CloseSprintModal";
import SprintBoard from "@/components/sprints/SprintBoard";
import SprintHistory from "@/components/sprints/SprintHistory";
import SprintModal from "@/components/sprints/SprintModal";
import SprintPlanner from "@/components/sprints/SprintPlanner";
import { useSprints } from "@/hooks/useSprints";
import { sprintService } from "@/services/api";
import { averageVelocity, nextSprintDefaults } from "@/lib/sprintDates";
import { toLocalDateStr } from "@/lib/utils";

const viewTabs = [
  { key: "current", label: "Current" },
  { key: "plan", label: "Plan" },
  { key: "history", label: "History" },
];

export default function SprintsPage() {
  const searchParams = useSearchParams();
  const queryView = searchParams.get("view");
  const [activeView, setActiveView] = useState(viewTabs.some((tab) => tab.key === queryView) ? queryView : "current");
  const [planSprintId, setPlanSprintId] = useState(null);
  const [sprintSheet, setSprintSheet] = useState({ isOpen: false, sprint: null });
  const [isClosing, setIsClosing] = useState(false);
  const { addToast } = useToast();
  const {
    sprints, activeSprint, plannedSprints, openSprints, completedSprints, isLoading, error, refetch,
  } = useSprints();
  const today = toLocalDateStr();
  const velocity = averageVelocity(completedSprints);
  const newSprintDefaults = useMemo(() => nextSprintDefaults(sprints, today), [sprints, today]);

  // Counts only: the sprints in view stay on screen while these refresh.
  const refreshSprints = useCallback(() => refetch({ background: true }), [refetch]);

  const openNewSprint = () => setSprintSheet({ isOpen: true, sprint: null });
  const openEditSprint = (sprint) => setSprintSheet({ isOpen: true, sprint });

  const openPlan = (sprintId) => {
    setPlanSprintId(typeof sprintId === "string" ? sprintId : null);
    setActiveView("plan");
  };

  const handleStart = async (sprint) => {
    try {
      await sprintService.start(sprint.id);
      addToast({ message: `${sprint.name} started`, type: "success" });
      await refreshSprints();
      setActiveView("current");
    } catch (requestError) {
      addToast({ message: requestError.message, type: "error" });
    }
  };

  // A new sprint opens straight into planning it.
  const handleSprintSaved = async (saved) => {
    await refreshSprints();
    if (saved && !sprintSheet.sprint) openPlan(saved.id);
  };

  return (
    <div className="page">
      <PageHeader
        title="Sprints"
        meta={velocity !== null ? <PageHeaderStat label="tasks finished per sprint, last 3" value={velocity} /> : undefined}
        actions={
          <>
            <Tabs tabs={viewTabs} activeTab={activeView} onChange={setActiveView} />
            <Button onClick={openNewSprint} leftIcon={<Plus />}>New sprint</Button>
          </>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error && sprints.length === 0 ? (
        <ErrorState
          title="Sprints couldn't be loaded"
          description={error.message || "Check your connection and try again."}
          onRetry={refetch}
        />
      ) : activeView === "current" ? (
        <SprintBoard
          activeSprint={activeSprint}
          plannedSprints={plannedSprints}
          today={today}
          onEdit={openEditSprint}
          onClose={() => setIsClosing(true)}
          onPlan={openPlan}
          onStart={handleStart}
          onNew={openNewSprint}
          onChanged={refreshSprints}
        />
      ) : activeView === "plan" ? (
        <SprintPlanner
          key={planSprintId || "default"}
          openSprints={openSprints}
          activeSprint={activeSprint}
          initialSprintId={planSprintId}
          today={today}
          onEdit={openEditSprint}
          onNew={openNewSprint}
          onStart={handleStart}
          onChanged={refreshSprints}
        />
      ) : (
        <SprintHistory completedSprints={completedSprints} onEdit={openEditSprint} />
      )}

      <SprintModal
        isOpen={sprintSheet.isOpen}
        onClose={() => setSprintSheet((current) => ({ ...current, isOpen: false }))}
        sprint={sprintSheet.sprint}
        defaults={newSprintDefaults}
        onSaved={handleSprintSaved}
      />
      <CloseSprintModal
        isOpen={isClosing}
        onClose={() => setIsClosing(false)}
        sprint={activeSprint}
        plannedSprints={plannedSprints}
        onClosed={refreshSprints}
      />
    </div>
  );
}
