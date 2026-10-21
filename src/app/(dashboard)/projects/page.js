"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { FolderKanban, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, Spinner, Tabs } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectModal from "@/components/projects/ProjectModal";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

const ProjectDetail = dynamic(() => import("@/components/projects/ProjectDetail"), {
  loading: () => <div className="flex items-center justify-center py-24"><Spinner /></div>,
});

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

  const { projects, pagination, isLoading, error, refetch, hasMore, loadMore, isLoadingMore } = useProjects({
    status: statusFilter,
    include_archived: showArchived ? "true" : "",
  });

  // Project modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirmOnOpen, setDeleteConfirmOnOpen] = useState(false);

  // Detail view state
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const activeProjectId = projectIdParam || selectedProjectId;

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

  const handleDeleteProjectRequest = (project) => {
    setEditingProject(project);
    setDeleteConfirmOnOpen(true);
    setModalOpen(true);
  };

  // Show detail view
  if (activeProjectId) {
    return (
      <div className="page">
        <ProjectDetail
          projectId={activeProjectId}
          onBack={() => {
            setSelectedProjectId(null);
            router.replace("/projects");
          }}
          onEdit={handleEditProject}
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
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Projects"
        meta={<PageHeaderStat label={pagination.filteredCount === 1 ? "project" : "projects"} value={pagination.filteredCount || 0} />}
        actions={
          <Button onClick={handleNewProject} leftIcon={<Plus />}>
            New project
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          variant="underline"
          tabs={statusFilters.map((f) => ({ key: f.key, label: f.label }))}
          activeTab={statusFilter}
          onChange={setStatusFilter}
          className="min-w-0 flex-1"
        />
        <label className="flex cursor-pointer select-none items-center gap-2 pb-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--brand-500)]"
          />
          Show archived
        </label>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <div key={card} className="card h-48 space-y-3 p-5">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : error && projects.length === 0 ? (
        <ErrorState
          title="Projects couldn't be loaded"
          description={error.message || "Check your connection and try again."}
          onRetry={refetch}
        />
      ) : projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FolderKanban />}
            title={statusFilter ? "Nothing here" : "No projects yet"}
            description={statusFilter ? "No projects match this filter." : "Projects gather tasks, notes, milestones and people around one outcome."}
            action={!statusFilter ? { children: "New project", onClick: handleNewProject } : undefined}
          />
        </div>
      ) : (
        <>
          {error && (
            <ErrorState
              compact
              className="mb-5"
              title="Some projects may be missing"
              description={error.message || "The latest projects couldn't be loaded."}
              onRetry={refetch}
            />
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={handleProjectClick}
                onDelete={handleDeleteProjectRequest}
              />
            ))}
          </div>
          <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
        </>
      )}

      {/* Project Modal */}
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
          setDeleteConfirmOnOpen(false);
        }}
        project={editingProject}
        onSave={refetch}
        onDelete={() => {
          setModalOpen(false);
          setEditingProject(null);
          setDeleteConfirmOnOpen(false);
          refetch();
        }}
        startInDeleteConfirm={deleteConfirmOnOpen}
      />
    </div>
  );
}
