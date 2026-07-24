"use client";

import { useState, useCallback } from "react";
import { whiteboardService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useApiResource } from "@/hooks/useApiResource";
import { useCursorResource } from "@/hooks/useCursorResource";

export function useWhiteboards(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const loadWhiteboards = useCallback(async (cursor, signal) => {
    const data = await whiteboardService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.whiteboards || [], pagination: data.pagination };
  }, [cleanFilters]);
  const resource = useCursorResource(loadWhiteboards, "whiteboards");
  return { ...resource, setWhiteboards: resource.setItems };
}

export function useWhiteboard(id) {
  const loadWhiteboard = useCallback(async (signal) => {
    const data = await whiteboardService.get(id, { signal });
    return data.whiteboard || null;
  }, [id]);
  const resource = useApiResource(loadWhiteboard, { initialValue: null, enabled: Boolean(id) });
  return { whiteboard: resource.data, error: resource.error, isLoading: resource.isLoading, refetch: resource.refetch, setWhiteboard: resource.setData };
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
