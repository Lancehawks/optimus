"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DATA_CHANGED_EVENT, dashboardService } from "@/services/api";
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
  const refetchOverview = resource.refetch;
  const lastRefreshAtRef = useRef(Date.now());

  useEffect(() => {
    let refreshTimer = null;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      const elapsed = Date.now() - lastRefreshAtRef.current;
      const delay = Math.max(750, 2000 - elapsed);
      refreshTimer = setTimeout(() => {
        lastRefreshAtRef.current = Date.now();
        void refetchOverview({ background: true });
      }, delay);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAtRef.current > 30000) scheduleRefresh();
    };
    const refreshOnFocus = () => {
      if (Date.now() - lastRefreshAtRef.current > 30000) scheduleRefresh();
    };

    window.addEventListener(DATA_CHANGED_EVENT, scheduleRefresh);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      clearTimeout(refreshTimer);
      window.removeEventListener(DATA_CHANGED_EVENT, scheduleRefresh);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refetchOverview]);

  return { overview: resource.data, ...resource, ...range };
}
