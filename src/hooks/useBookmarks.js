"use client";

import { useState, useEffect, useCallback } from "react";
import { bookmarkService, bookmarkCollectionService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useCursorResource } from "@/hooks/useCursorResource";

export function useBookmarks(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const loadBookmarks = useCallback(async (cursor, signal) => {
    const data = await bookmarkService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.bookmarks || [], pagination: data.pagination };
  }, [cleanFilters]);
  return useCursorResource(loadBookmarks, "bookmarks");
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
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await bookmarkCollectionService.list();
      setCollections(data.collections);
    } catch (requestError) {
      setError(requestError);
      console.error("Failed to fetch collections:", requestError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const createCollection = async (name) => {
    const data = await bookmarkCollectionService.create({ name });
    setCollections((prev) => [...prev, data.collection]);
    return data.collection;
  };

  const updateCollection = async (id, name) => {
    const data = await bookmarkCollectionService.update(id, { name });
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data.collection } : c))
    );
    return data.collection;
  };

  const deleteCollection = async (id) => {
    await bookmarkCollectionService.delete(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  return { collections, error, isLoading, createCollection, updateCollection, deleteCollection, refetch: fetchCollections };
}
