"use client";

import { useState, useEffect, useCallback } from "react";
import { noteService, notebookService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useApiResource } from "@/hooks/useApiResource";
import { useCursorResource } from "@/hooks/useCursorResource";

export function useNotes(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const loadNotes = useCallback(async (cursor, signal) => {
    const data = await noteService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.notes || [], pagination: data.pagination };
  }, [cleanFilters]);
  const resource = useCursorResource(loadNotes, "notes");
  return { ...resource, setNotes: resource.setItems };
}

export function useNote(id) {
  const loadNote = useCallback(async (signal) => {
    const data = await noteService.get(id, { signal });
    return data.note || null;
  }, [id]);
  const resource = useApiResource(loadNote, { initialValue: null, enabled: Boolean(id) });
  return { note: resource.data, error: resource.error, isLoading: resource.isLoading, refetch: resource.refetch, setNote: resource.setData };
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
  const [notebooks, setNotebooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotebooks = useCallback(async () => {
    try {
      const data = await notebookService.list();
      setNotebooks(data.notebooks);
    } catch (error) {
      console.error("Failed to fetch notebooks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  const createNotebook = async (name) => {
    const data = await notebookService.create({ name });
    setNotebooks((prev) => [...prev, data.notebook]);
    return data.notebook;
  };

  const updateNotebook = async (id, name) => {
    const data = await notebookService.update(id, { name });
    setNotebooks((prev) =>
      prev.map((nb) => (nb.id === id ? { ...nb, ...data.notebook } : nb))
    );
    return data.notebook;
  };

  const deleteNotebook = async (id) => {
    await notebookService.delete(id);
    setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
  };

  return { notebooks, isLoading, createNotebook, updateNotebook, deleteNotebook, refetch: fetchNotebooks };
}
