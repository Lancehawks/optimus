"use client";

import { useState, useEffect, useCallback } from "react";
import { dashboardService, isUnauthorizedError } from "@/services/api";

export function useDashboardStats() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getStats();
      setStats(data.stats);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setStats(null);
        return;
      }
      setError(error);
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, error, isLoading, refetch: fetchStats };
}

export function useSidebarIndicators() {
  const [indicators, setIndicators] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIndicators = useCallback(async () => {
    setError(null);
    try {
      const data = await dashboardService.getIndicators();
      setIndicators(data.indicators);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIndicators(null);
        return;
      }
      setError(error);
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

  return { indicators, error, isLoading, refetch: fetchIndicators };
}
