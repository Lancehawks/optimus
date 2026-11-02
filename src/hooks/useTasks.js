"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { taskService, tagService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useCursorResource } from "@/hooks/useCursorResource";

const TAGS_KEY = ["tags"];
const NO_TAGS = [];

export function useTasks(filters = {}, { enabled = true } = {}) {
  const cleanFilters = useCleanFilters(filters);
  const queryKey = useMemo(() => ["tasks", "list", cleanFilters], [cleanFilters]);
  const loadTasks = useCallback(async (cursor, signal) => {
    const data = await taskService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.tasks || [], pagination: data.pagination };
  }, [cleanFilters]);
  const resource = useCursorResource(queryKey, loadTasks, "tasks", { enabled });
  return {
    ...resource,
    setTasks: resource.setItems,
  };
}

export function useTaskMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createTask = async (data) => {
    setIsLoading(true);
    try {
      const result = await taskService.create(data);
      onSuccess?.();
      return result.task;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTask = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await taskService.update(id, data);
      onSuccess?.();
      return result.task;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTask = async (id) => {
    setIsLoading(true);
    try {
      await taskService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const bulkAction = async (action, taskIds) => {
    setIsLoading(true);
    try {
      await taskService.bulk({ action, taskIds });
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const addSubtask = async (taskId, title) => {
    const result = await taskService.addSubtask(taskId, { title });
    return result.subtask;
  };

  const updateSubtask = async (taskId, subtaskId, data) => {
    const result = await taskService.updateSubtask(taskId, subtaskId, data);
    return result.subtask;
  };

  const deleteSubtask = async (taskId, subtaskId) => {
    await taskService.deleteSubtask(taskId, subtaskId);
  };

  return { createTask, updateTask, deleteTask, bulkAction, addSubtask, updateSubtask, deleteSubtask, isLoading };
}

export function useTags() {
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: TAGS_KEY,
    queryFn: async () => (await tagService.list()).tags,
  });

  const createTag = async (name, color) => {
    const result = await tagService.create({ name, color });
    queryClient.setQueryData(TAGS_KEY, (prev = []) => [...prev, result.tag]);
    return result.tag;
  };

  return { tags: data ?? NO_TAGS, error, isLoading, createTag, refetch };
}
