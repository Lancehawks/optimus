"use client";

import { useQuery } from "@tanstack/react-query";
import { checklistService } from "@/services/api";

const NO_SECTIONS = [];
const NO_LOGS = {};
const NO_HISTORY = [];

export function useChecklist() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["checklist", "sections"],
    queryFn: () => checklistService.getSections(),
  });

  return {
    sections: data?.sections ?? NO_SECTIONS,
    todayLogs: data?.todayLogs || NO_LOGS,
    error,
    isLoading,
    refetch,
  };
}

export function useChecklistHistory(startDate, endDate) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["checklist", "history", startDate, endDate],
    queryFn: async () => (await checklistService.getHistory({ start: startDate, end: endDate })).logs,
    enabled: Boolean(startDate && endDate),
  });

  return { logs: data ?? NO_HISTORY, error, isLoading, refetch };
}
