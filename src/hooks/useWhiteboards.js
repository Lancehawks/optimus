"use client";

import { useState, useEffect, useCallback } from "react";
import { whiteboardService } from "@/services/api";

export function useWhiteboards(filters = {}) {
  const [whiteboards, setWhiteboards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWhiteboards = useCallback(async () => {
    setIsLoading(true);
    try {
      const cleanFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanFilters[key] = value;
        }
      });
      const data = await whiteboardService.list(cleanFilters);
      setWhiteboards(data.whiteboards);
    } catch (error) {
      console.error("Failed to fetch whiteboards:", error);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchWhiteboards();
  }, [fetchWhiteboards]);

  return { whiteboards, isLoading, refetch: fetchWhiteboards, setWhiteboards };
}

export function useWhiteboard(id) {
  const [whiteboard, setWhiteboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWhiteboard = useCallback(async () => {
    if (!id) {
      setWhiteboard(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await whiteboardService.get(id);
      setWhiteboard(data.whiteboard);
    } catch (error) {
      console.error("Failed to fetch whiteboard:", error);
      setWhiteboard(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWhiteboard();
  }, [fetchWhiteboard]);

  return { whiteboard, isLoading, refetch: fetchWhiteboard, setWhiteboard };
}

export function useWhiteboardMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createWhiteboard = async (data) => {
    setIsLoading(true);
    try {
      const result = await whiteboardService.create(data);
      onSuccess?.();
      return result.whiteboard;
    } finally {
      setIsLoading(false);
    }
  };

  const updateWhiteboard = async (id, data) => {
    try {
      const result = await whiteboardService.update(id, data);
      return result.whiteboard;
    } catch (error) {
      console.error("Failed to update whiteboard:", error);
      throw error;
    }
  };

  const deleteWhiteboard = async (id) => {
    setIsLoading(true);
    try {
      await whiteboardService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const duplicateWhiteboard = async (id) => {
    setIsLoading(true);
    try {
      const result = await whiteboardService.duplicate(id);
      onSuccess?.();
      return result.whiteboard;
    } finally {
      setIsLoading(false);
    }
  };

  return { createWhiteboard, updateWhiteboard, deleteWhiteboard, duplicateWhiteboard, isLoading };
}
