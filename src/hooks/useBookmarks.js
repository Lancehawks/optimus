"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bookmarkService, bookmarkCollectionService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useCursorResource } from "@/hooks/useCursorResource";

const COLLECTIONS_KEY = ["bookmark-collections"];
const NO_COLLECTIONS = [];

export function useBookmarks(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const queryKey = useMemo(() => ["bookmarks", "list", cleanFilters], [cleanFilters]);
  const loadBookmarks = useCallback(async (cursor, signal) => {
    const data = await bookmarkService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.bookmarks || [], pagination: data.pagination };
  }, [cleanFilters]);
  return useCursorResource(queryKey, loadBookmarks, "bookmarks");
}

export function useBookmarkMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createBookmark = async (data) => {
    setIsLoading(true);
    try {
      const result = await bookmarkService.create(data);
      onSuccess?.();
      return result.bookmark;
    } finally {
      setIsLoading(false);
    }
  };

  const updateBookmark = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await bookmarkService.update(id, data);
      onSuccess?.();
      return result.bookmark;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBookmark = async (id) => {
    setIsLoading(true);
    try {
      await bookmarkService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return { createBookmark, updateBookmark, deleteBookmark, isLoading };
}

export function useCollections() {
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: async () => (await bookmarkCollectionService.list()).collections,
  });
  const setCollections = (update) => queryClient.setQueryData(COLLECTIONS_KEY, (prev = []) => update(prev));

  const createCollection = async (name) => {
    const result = await bookmarkCollectionService.create({ name });
    setCollections((prev) => [...prev, result.collection]);
    return result.collection;
  };

  const updateCollection = async (id, name) => {
    const result = await bookmarkCollectionService.update(id, { name });
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...result.collection } : c))
    );
    return result.collection;
  };

  const deleteCollection = async (id) => {
    await bookmarkCollectionService.delete(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  return { collections: data ?? NO_COLLECTIONS, error, isLoading, createCollection, updateCollection, deleteCollection, refetch };
}
