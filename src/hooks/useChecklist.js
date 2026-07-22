"use client";

import { useState, useEffect, useCallback } from "react";
import { checklistService } from "@/services/api";

export function useChecklist() {
  const [sections, setSections] = useState([]);
  const [todayLogs, setTodayLogs] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await checklistService.getSections();
      setSections(data.sections);
      setTodayLogs(data.todayLogs || {});
    } catch (requestError) {
      setError(requestError);
      console.error("Failed to fetch checklist:", requestError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return { sections, todayLogs, error, isLoading, refetch: fetchSections };
}

export function useChecklistHistory(startDate, endDate) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await checklistService.getHistory({ start: startDate, end: endDate });
      setLogs(data.logs);
    } catch (requestError) {
      setError(requestError);
      console.error("Failed to fetch checklist history:", requestError);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { logs, error, isLoading, refetch: fetchHistory };
}
