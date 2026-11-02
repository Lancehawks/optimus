"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { noteService, notebookService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useCursorResource } from "@/hooks/useCursorResource";

const NOTEBOOKS_KEY = ["notebooks"];
const NO_NOTEBOOKS = [];

export function useNotes(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const queryKey = useMemo(() => ["notes", "list", cleanFilters], [cleanFilters]);
  const loadNotes = useCallback(async (cursor, signal) => {
    const data = await noteService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.notes || [], pagination: data.pagination };
  }, [cleanFilters]);
  const resource = useCursorResource(queryKey, loadNotes, "notes");
  return { ...resource, setNotes: resource.setItems };
}

export function useNoteMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createNote = async (data) => {
    setIsLoading(true);
    try {
      const result = await noteService.create(data);
      onSuccess?.();
      return result.note;
    } finally {
      setIsLoading(false);
    }
  };

  const updateNote = async (id, data) => {
    try {
      const result = await noteService.update(id, data);
      return result.note;
    } catch (error) {
      console.error("Failed to update note:", error);
      throw error;
    }
  };

  const deleteNote = async (id) => {
    setIsLoading(true);
    try {
      await noteService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const togglePin = async (id, isPinned) => {
    const result = await noteService.update(id, { isPinned: !isPinned });
    onSuccess?.();
    return result.note;
  };

  return { createNote, updateNote, deleteNote, togglePin, isLoading };
}

export function useNotebooks() {
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: NOTEBOOKS_KEY,
    queryFn: async () => (await notebookService.list()).notebooks,
  });
  const setNotebooks = (update) => queryClient.setQueryData(NOTEBOOKS_KEY, (prev = []) => update(prev));

  const createNotebook = async (name) => {
    const result = await notebookService.create({ name });
    setNotebooks((prev) => [...prev, result.notebook]);
    return result.notebook;
  };

  const updateNotebook = async (id, name) => {
    const result = await notebookService.update(id, { name });
    setNotebooks((prev) =>
      prev.map((nb) => (nb.id === id ? { ...nb, ...result.notebook } : nb))
    );
    return result.notebook;
  };

  const deleteNotebook = async (id) => {
    await notebookService.delete(id);
    setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
  };

  return { notebooks: data ?? NO_NOTEBOOKS, error, isLoading, createNotebook, updateNotebook, deleteNotebook, refetch };
}
