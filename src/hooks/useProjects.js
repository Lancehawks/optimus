"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useCursorResource } from "@/hooks/useCursorResource";

export function useProjects(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const queryKey = useMemo(() => ["projects", "list", cleanFilters], [cleanFilters]);
  const loadProjects = useCallback(async (cursor, signal) => {
    const data = await projectService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.projects || [], pagination: data.pagination };
  }, [cleanFilters]);
  const resource = useCursorResource(queryKey, loadProjects, "projects");
  return { ...resource, setProjects: resource.setItems };
}

export function useProject(id) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: async ({ signal }) => (await projectService.get(id, { signal })).project || null,
    enabled: Boolean(id),
  });
  return { project: data ?? null, error, isLoading, refetch };
}

export function useProjectMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createProject = async (data) => {
    setIsLoading(true);
    try {
      const result = await projectService.create(data);
      onSuccess?.();
      return result.project;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProject = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await projectService.update(id, data);
      onSuccess?.();
      return result.project;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (id, options) => {
    setIsLoading(true);
    try {
      await projectService.delete(id, options);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const addMember = async (projectId, email) => {
    const result = await projectService.addMember(projectId, email);
    onSuccess?.();
    return result.members;
  };

  const removeMember = async (projectId, userId) => {
    const result = await projectService.removeMember(projectId, userId);
    onSuccess?.();
    return result.members;
  };

  const addMilestone = async (projectId, data) => {
    const result = await projectService.addMilestone(projectId, data);
    return result.milestone;
  };

  const updateMilestone = async (projectId, milestoneId, data) => {
    const result = await projectService.updateMilestone(projectId, milestoneId, data);
    return result.milestone;
  };

  const deleteMilestone = async (projectId, milestoneId) => {
    await projectService.deleteMilestone(projectId, milestoneId);
  };

  return {
    createProject,
    updateProject,
    deleteProject,
    addMember,
    removeMember,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    isLoading,
  };
}
