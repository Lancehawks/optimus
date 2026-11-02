"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readingListService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";

const NO_ITEMS = [];

export function useReadingList(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["reading-list", cleanFilters],
    queryFn: async () => (await readingListService.list(cleanFilters)).items,
  });

  return { items: data ?? NO_ITEMS, error, isLoading, refetch };
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
