"use client";

import { useState, useCallback } from "react";
import { resourceService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useCursorResource } from "@/hooks/useCursorResource";

export function useResources(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const loadResources = useCallback(async (cursor, signal) => {
    const data = await resourceService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.resources || [], pagination: data.pagination };
  }, [cleanFilters]);
  return useCursorResource(loadResources, "resources");
}

export function useResourceMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createResource = async (data) => {
    setIsLoading(true);
    try {
      const result = await resourceService.create(data);
      onSuccess?.();
      return result.resource;
    } finally {
      setIsLoading(false);
    }
  };

  const updateResource = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await resourceService.update(id, data);
      onSuccess?.();
      return result.resource;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteResource = async (id) => {
    setIsLoading(true);
    try {
      await resourceService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return { createResource, updateResource, deleteResource, isLoading };
}
