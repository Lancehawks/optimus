"use client";

import { useState, useEffect, useCallback } from "react";
import { habitService } from "@/services/api";

export function useHabits(filters = {}) {
  const [habits, setHabits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHabits = useCallback(async () => {
    setIsLoading(true);
    try {
      const cleanFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanFilters[key] = value;
        }
      });
      const data = await habitService.list(cleanFilters);
      setHabits(data.habits);
    } catch (error) {
      console.error("Failed to fetch habits:", error);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  return { habits, isLoading, refetch: fetchHabits };
}

export function useHabitMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createHabit = async (data) => {
    setIsLoading(true);
    try {
      const result = await habitService.create(data);
      onSuccess?.();
      return result.habit;
    } finally {
      setIsLoading(false);
    }
  };

  const updateHabit = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await habitService.update(id, data);
      onSuccess?.();
      return result.habit;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteHabit = async (id) => {
    setIsLoading(true);
    try {
      await habitService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLog = async (habitId, data = {}) => {
    try {
      const result = await habitService.toggleLog(habitId, data);
      onSuccess?.();
      return result.log;
    } catch (error) {
      console.error("Failed to toggle habit log:", error);
      throw error;
    }
  };

  return { createHabit, updateHabit, deleteHabit, toggleLog, isLoading };
}

export function useHabitStats(habitId) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!habitId) {
      setStats(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await habitService.getStats(habitId);
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch habit stats:", error);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [habitId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}
