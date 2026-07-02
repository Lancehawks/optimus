"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, EmptyState, Spinner, useToast } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
import { taskService } from "@/services/api";
import { cn } from "@/lib/utils";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectModal from "@/components/projects/ProjectModal";
import ProjectDetail from "@/components/projects/ProjectDetail";
import TaskModal from "@/components/tasks/TaskModal";

const statusFilters = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("project_id");
  const [statusFilter, setStatusFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const { projects, isLoading, refetch } = useProjects({
    status: statusFilter,
    include_archived: showArchived ? "true" : "",
  });

  const { addToast } = useToast();

  // Project modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Detail view state
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const activeProjectId = projectIdParam || selectedProjectId;

  // Task modal state (for creating tasks within a project)
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForProject, setTaskForProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const handleNewProject = () => {
    setEditingProject(null);
    setModalOpen(true);
  };

  const handleProjectClick = (project) => {
    setSelectedProjectId(project.id);
    router.replace(`/projects?project_id=${project.id}`);
  };

  const handleEditProject = async (project) => {
    setEditingProject(project);
    setModalOpen(true);
  };

  const handleNewTaskForProject = (projectId) => {
    setTaskForProject(projectId);
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleTaskClick = useCallback(async (task) => {
    try {
      const data = await taskService.get(task.id);
      setEditingTask(data.task);
      setTaskForProject(null);
      setTaskModalOpen(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast]);

  // Show detail view
  if (activeProjectId) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <ProjectDetail
          projectId={activeProjectId}
          onBack={() => {
            setSelectedProjectId(null);
            router.replace("/projects");
          }}
          onEdit={handleEditProject}
          onTaskClick={handleTaskClick}
          onNewTask={handleNewTaskForProject}
        />

        <ProjectModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingProject(null);
          }}
          project={editingProject}
          onSave={() => {
            refetch();
            setSelectedProjectId((prev) => prev); // trigger re-render
          }}
          onDelete={() => {
            setSelectedProjectId(null);
            router.replace("/projects");
            refetch();
          }}
        />

        <TaskModal
          isOpen={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setEditingTask(null);
            setTaskForProject(null);
          }}
          task={editingTask}
          defaultProjectId={taskForProject}
          onSave={() => {
            // Refresh the project detail
            setSelectedProjectId((prev) => {
              // Force re-mount by briefly setting null
              setTimeout(() => setSelectedProjectId(prev), 0);
              return null;
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Projects"
        description={statusFilter ? `${statusFilter} projects` : "Solo and shared spaces"}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12A2.25 2.25 0 0 0 4.5 20.25h15A2.25 2.25 0 0 0 21.75 18V9A2.25 2.25 0 0 0 19.5 6.75h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
        }
        meta={<PageHeaderStat label={projects.length === 1 ? "project" : "projects"} value={projects.length} tone="brand" />}
        actions={
          <Button onClick={handleNewProject} leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            New Project
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary/50 p-2">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-body-sm font-medium cursor-pointer transition-colors",
              statusFilter === f.key
                ? "bg-brand-500/15 text-brand-400"
                : "text-muted hover:bg-surface-tertiary hover:text-heading"
            )}
          >
            {f.label}
          </button>
        ))}

        <label className="flex items-center gap-2 ml-auto text-body-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          }
          title="No projects yet"
          description={statusFilter
            ? "No projects match this filter."
            : "Create your first project to organize your tasks."}
          action={!statusFilter ? { children: "Create Project", onClick: handleNewProject } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={handleProjectClick}
            />
          ))}
        </div>
      )}

      {/* Project Modal */}
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
        project={editingProject}
        onSave={refetch}
      />
    </div>
  );
}
