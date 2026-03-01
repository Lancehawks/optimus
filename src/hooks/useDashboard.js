"use client";

import { useState, useEffect, useCallback } from "react";
import { dashboardService } from "@/services/api";

export function useDashboardStats() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dashboardService.getStats();
      setStats(data.stats);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}

export function useSidebarIndicators() {
  const [indicators, setIndicators] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIndicators = useCallback(async () => {
    try {
      const data = await dashboardService.getIndicators();
      setIndicators(data.indicators);
    } catch (error) {
      console.error("Failed to fetch sidebar indicators:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIndicators();
    const interval = setInterval(fetchIndicators, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchIndicators]);

  return { indicators, isLoading, refetch: fetchIndicators };
}
