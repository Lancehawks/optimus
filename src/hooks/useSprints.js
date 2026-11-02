"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sprintService } from "@/services/api";

const NO_SPRINTS = [];

export function useSprints({ enabled = true } = {}) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["sprints", "list"],
    queryFn: async ({ signal }) => (await sprintService.list({ signal })).sprints || NO_SPRINTS,
    enabled,
  });
  const sprints = data ?? NO_SPRINTS;

  const grouped = useMemo(() => ({
    activeSprint: sprints.find((sprint) => sprint.status === "active") || null,
    plannedSprints: sprints.filter((sprint) => sprint.status === "planned"),
    openSprints: sprints.filter((sprint) => sprint.status !== "completed"),
    completedSprints: sprints.filter((sprint) => sprint.status === "completed"),
  }), [sprints]);

  return { sprints, ...grouped, error, isLoading, refetch };
}

// One sprint's tasks, as recorded when it closed.
export function useSprintTasks(sprintId) {
  const { data, error, refetch } = useQuery({
    queryKey: ["sprints", "detail", sprintId],
    queryFn: async ({ signal }) => (await sprintService.get(sprintId, { signal })).sprint.tasks,
  });
  return { tasks: data, error, refetch };
}
