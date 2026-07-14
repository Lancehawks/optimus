"use client";

import { useState, useEffect, useCallback } from "react";
import { resourceService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";

export function useResources(filters = {}) {
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const cleanFilters = useCleanFilters(filters);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await resourceService.list(cleanFilters);
      setResources(data.resources);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cleanFilters]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return { resources, isLoading, refetch: fetchResources };
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
