"use client";

import { useState, useEffect, useCallback } from "react";
import { checklistService } from "@/services/api";

export function useChecklist() {
  const [sections, setSections] = useState([]);
  const [todayLogs, setTodayLogs] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await checklistService.getSections();
      setSections(data.sections);
      setTodayLogs(data.todayLogs || {});
    } catch (error) {
      console.error("Failed to fetch checklist:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return { sections, todayLogs, isLoading, refetch: fetchSections };
}

export function useChecklistHistory(startDate, endDate) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    try {
      const data = await checklistService.getHistory({ start: startDate, end: endDate });
      setLogs(data.logs);
    } catch (error) {
      console.error("Failed to fetch checklist history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { logs, isLoading, refetch: fetchHistory };
}
