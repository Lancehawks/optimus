"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import { taskService } from "@/services/api";

/** Opens the task sheet at once with list data, then fills in the full detail. */
export function useTaskSheet() {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [task, setTask] = useState(null);

  const openTask = useCallback(async (nextTask) => {
    setTask(nextTask);
    setIsOpen(true);
    try {
      const data = await taskService.get(nextTask.id);
      setTask(data.task);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast]);

  const newTask = useCallback(() => {
    setTask(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTask(null);
  }, []);

  return { isOpen, task, openTask, newTask, close };
}
