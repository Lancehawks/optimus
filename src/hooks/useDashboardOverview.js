"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/api";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone, wallDate, wallDateToInstant } from '@/lib/calendarTime';
import { toLocalDateStr } from "@/lib/utils";

export function useDashboardOverview() {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const range = useMemo(() => {
    const today = wallDate(new Date(), timeZone);
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
        range_start: wallDateToInstant(today, timeZone).toISOString(),
        range_end: wallDateToInstant(upcomingEnd, timeZone).toISOString(),
        time_zone: timeZone,
      },
    };
  }, [timeZone]);

  // Writes elsewhere (a quick-captured task, a ticked routine) refresh this
  // through the query cache; focus refreshes it once it is 30 seconds old.
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", "overview", range.params],
    queryFn: async ({ signal }) => (await dashboardService.getOverview(range.params, { signal })).overview,
  });

  return { overview: data ?? null, error, isLoading, refetch, ...range };
}
