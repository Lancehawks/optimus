"use client";

import { useState, useEffect, useCallback } from "react";
import { dayPlanService } from "@/services/api";

export function useDayPlan() {
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dayPlanService.getBlocks();
      setBlocks(data.blocks);
    } catch (requestError) {
      setError(requestError);
      console.error("Failed to fetch day plan blocks:", requestError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return { blocks, error, isLoading, refetch: fetchBlocks };
}

export function useDayPlanStatus(date) {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!date) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await dayPlanService.getStatus(date);
      setStatus(data.status);
    } catch (requestError) {
      setError(requestError);
      console.error("Failed to fetch day plan status:", requestError);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, error, isLoading, refetch: fetchStatus };
}
