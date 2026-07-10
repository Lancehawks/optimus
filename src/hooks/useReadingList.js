"use client";

import { useState, useEffect, useCallback } from "react";
import { readingListService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";

export function useReadingList(filters = {}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const cleanFilters = useCleanFilters(filters);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await readingListService.list(cleanFilters);
      setItems(data.items);
    } catch (error) {
      console.error("Failed to fetch reading list:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cleanFilters]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, isLoading, refetch: fetchItems };
}

export function useReadingListMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createItem = async (data) => {
    setIsLoading(true);
    try {
      const result = await readingListService.create(data);
      onSuccess?.();
      return result.item;
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await readingListService.update(id, data);
      onSuccess?.();
      return result.item;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (id) => {
    setIsLoading(true);
    try {
      await readingListService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return { createItem, updateItem, deleteItem, isLoading };
}
