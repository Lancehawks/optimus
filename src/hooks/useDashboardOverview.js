"use client";

import { useCallback, useMemo } from "react";
import { dashboardService } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { toLocalDateStr } from "@/lib/utils";

export function useDashboardOverview() {
  const range = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    const weekday = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - weekday + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const upcomingEnd = new Date(today);
    upcomingEnd.setDate(upcomingEnd.getDate() + 8);

    return {
      today,
      weekStart,
      weekEnd,
      upcomingEnd,
      params: {
        today: toLocalDateStr(today),
        week_start: toLocalDateStr(weekStart),
        week_end: toLocalDateStr(weekEnd),
        upcoming_end: toLocalDateStr(upcomingEnd),
        range_start: today.toISOString(),
        range_end: upcomingEnd.toISOString(),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
    };
  }, []);

  const load = useCallback(async (signal) => {
    const data = await dashboardService.getOverview(range.params, { signal });
    return data.overview;
  }, [range.params]);
  const resource = useApiResource(load, { initialValue: null });
  return { overview: resource.data, ...resource, ...range };
}
