"use client";

import { useState, useEffect, useCallback } from "react";
import { dayPlanService } from "@/services/api";

export function useDayPlan() {
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dayPlanService.getBlocks();
      setBlocks(data.blocks);
    } catch (error) {
      console.error("Failed to fetch day plan blocks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return { blocks, isLoading, refetch: fetchBlocks };
}

export function useDayPlanStatus(date) {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!date) return;
    setIsLoading(true);
    try {
      const data = await dayPlanService.getStatus(date);
      setStatus(data.status);
    } catch (error) {
      console.error("Failed to fetch day plan status:", error);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, isLoading, refetch: fetchStatus };
}
