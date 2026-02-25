"use client";

import { useState, useEffect, useCallback } from "react";
import { bookmarkService, bookmarkCollectionService } from "@/services/api";

export function useBookmarks(filters = {}) {
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    setIsLoading(true);
    try {
      const cleanFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanFilters[key] = value;
        }
      });
      const data = await bookmarkService.list(cleanFilters);
      setBookmarks(data.bookmarks);
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  return { bookmarks, isLoading, refetch: fetchBookmarks };
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

  const fetchCollections = useCallback(async () => {
    try {
      const data = await bookmarkCollectionService.list();
      setCollections(data.collections);
    } catch (error) {
      console.error("Failed to fetch collections:", error);
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

  return { collections, isLoading, createCollection, updateCollection, deleteCollection, refetch: fetchCollections };
}
