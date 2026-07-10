"use client";

import { useState, useEffect, useCallback } from "react";
import { taskService, tagService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";

export function useTasks(filters = {}) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const cleanFilters = useCleanFilters(filters);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await taskService.list(cleanFilters);
      setTasks(data.tasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cleanFilters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, isLoading, refetch: fetchTasks, setTasks };
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
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      const data = await tagService.list();
      setTags(data.tags);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = async (name, color) => {
    const data = await tagService.create({ name, color });
    setTags((prev) => [...prev, data.tag]);
    return data.tag;
  };

  return { tags, isLoading, createTag, refetch: fetchTags };
}
