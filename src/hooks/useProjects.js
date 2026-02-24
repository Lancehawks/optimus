"use client";

import { useState, useEffect, useCallback } from "react";
import { projectService } from "@/services/api";

export function useProjects(filters = {}) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const cleanFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanFilters[key] = value;
        }
      });
      const data = await projectService.list(cleanFilters);
      setProjects(data.projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, isLoading, refetch: fetchProjects, setProjects };
}

export function useProject(id) {
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await projectService.get(id);
      setProject(data.project);
    } catch (error) {
      console.error("Failed to fetch project:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, isLoading, refetch: fetchProject };
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

  const deleteProject = async (id) => {
    setIsLoading(true);
    try {
      await projectService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
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
    addMilestone,
    updateMilestone,
    deleteMilestone,
    isLoading,
  };
}
