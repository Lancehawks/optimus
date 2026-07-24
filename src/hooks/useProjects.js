"use client";

import { useState, useCallback } from "react";
import { projectService } from "@/services/api";
import { useCleanFilters } from "@/hooks/useCleanFilters";
import { useApiResource } from "@/hooks/useApiResource";
import { useCursorResource } from "@/hooks/useCursorResource";

export function useProjects(filters = {}) {
  const cleanFilters = useCleanFilters(filters);
  const loadProjects = useCallback(async (cursor, signal) => {
    const data = await projectService.list(cursor ? { ...cleanFilters, cursor } : cleanFilters, { signal });
    return { items: data.projects || [], pagination: data.pagination };
  }, [cleanFilters]);
  const resource = useCursorResource(loadProjects, "projects");
  return { ...resource, setProjects: resource.setItems };
}

export function useProject(id) {
  const loadProject = useCallback(async (signal) => {
    const data = await projectService.get(id, { signal });
    return data.project || null;
  }, [id]);
  const resource = useApiResource(loadProject, { initialValue: null, enabled: Boolean(id) });
  return { project: resource.data, error: resource.error, isLoading: resource.isLoading, refetch: resource.refetch };
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
