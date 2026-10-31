"use client";

import { useCallback, useMemo } from "react";
import { sprintService } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";

const NO_SPRINTS = [];

export function useSprints({ enabled = true } = {}) {
  const loadSprints = useCallback(async (signal) => {
    const data = await sprintService.list({ signal });
    return data.sprints || NO_SPRINTS;
  }, []);
  const { data: sprints, error, isLoading, refetch } = useApiResource(loadSprints, { initialValue: NO_SPRINTS, enabled });

  const grouped = useMemo(() => ({
    activeSprint: sprints.find((sprint) => sprint.status === "active") || null,
    plannedSprints: sprints.filter((sprint) => sprint.status === "planned"),
    openSprints: sprints.filter((sprint) => sprint.status !== "completed"),
    completedSprints: sprints.filter((sprint) => sprint.status === "completed"),
  }), [sprints]);

  return { sprints, ...grouped, error, isLoading, refetch };
}
