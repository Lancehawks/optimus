"use client";

import { useState, useEffect, useCallback } from "react";
import { resourceService } from "@/services/api";

export function useResources(filters = {}) {
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const cleanFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanFilters[key] = value;
        }
      });
      const data = await resourceService.list(cleanFilters);
      setResources(data.resources);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

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
