"use client";

import { useQuery } from "@tanstack/react-query";
import { dayPlanService } from "@/services/api";

const NO_BLOCKS = [];

export function useDayPlan() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["day-plan", "blocks"],
    queryFn: async () => (await dayPlanService.getBlocks()).blocks,
  });

  return { blocks: data ?? NO_BLOCKS, error, isLoading, refetch };
}

export function useDayPlanStatus(date) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["day-plan", "status", date],
    queryFn: async () => (await dayPlanService.getStatus(date)).status,
    enabled: Boolean(date),
  });

  return { status: data ?? null, error, isLoading, refetch };
}
