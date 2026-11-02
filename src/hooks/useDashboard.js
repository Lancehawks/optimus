"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardService, isUnauthorizedError } from "@/services/api";

export function useSidebarIndicators() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", "indicators"],
    queryFn: async () => {
      try {
        return (await dashboardService.getIndicators()).indicators;
      } catch (error) {
        // A lapsed session is handled by the sign-out flow, not shown here.
        if (isUnauthorizedError(error)) return null;
        throw error;
      }
    },
    refetchInterval: 5 * 60 * 1000,
  });

  return { indicators: data ?? null, error, isLoading, refetch };
}
