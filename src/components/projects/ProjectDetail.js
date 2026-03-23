"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button, Badge, Input, Spinner } from "@/components/ui";
import { useProject, useProjectMutations } from "@/hooks/useProjects";
import { useNotes } from "@/hooks/useNotes";
import { useReadingList } from "@/hooks/useReadingList";
import { useWhiteboards } from "@/hooks/useWhiteboards";
import { useTaskMutations } from "@/hooks/useTasks";
import { useToast } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const statusBadge = {
  active: { variant: "success", label: "Active" },
  paused: { variant: "warning", label: "Paused" },
  completed: { variant: "default", label: "Completed" },
  archived: { variant: "neutral", label: "Archived" },
};

const typeLabels = {
  work: { label: "Work", icon: "💼" },
  learning: { label: "Learning", icon: "📚" },
  personal: { label: "Personal", icon: "🏠" },
};

const priorityConfig = {
  urgent: { variant: "danger", label: "Urgent" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "neutral", label: "Low" },
};

export default function ProjectDetail({ projectId, onBack, onEdit, onTaskClick, onNewTask }) {
  const { project, isLoading, refetch } = useProject(projectId);
  const { addMilestone, updateMilestone, deleteMilestone } = useProjectMutations(refetch);
  const { updateTask } = useTaskMutations(refetch);
  const { addToast } = useToast();
  const { notes: linkedNotes } = useNotes({ project_id: projectId });
  const { items: linkedReadingList } = useReadingList({ project_id: projectId });
  const { whiteboards: linkedWhiteboards } = useWhiteboards({ project_id: projectId });

  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Drag state for milestones
  const [draggedMilestoneId, setDraggedMilestoneId] = useState(null);
  const [dragOverMilestoneId, setDragOverMilestoneId] = useState(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Project not found</p>
      </div>
    );
  }

  const { variant, label } = statusBadge[project.status] || statusBadge.active;
  const typeInfo = project.type ? typeLabels[project.type] : null;
  const taskCount = project.task_count || 0;
  const taskDone = project.task_done_count || 0;
  const progress = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    setAddingMilestone(true);
    try {
      await addMilestone(project.id, { title: newMilestoneTitle.trim() });
      setNewMilestoneTitle("");
      addToast({ message: "Milestone added", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleToggleMilestone = async (milestone) => {
    try {
      await updateMilestone(project.id, milestone.id, { isCompleted: !milestone.is_completed });
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    try {
      await deleteMilestone(project.id, milestoneId);
      refetch();
      addToast({ message: "Milestone deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  // Milestone drag-and-drop reorder
  const handleMilestoneDragStart = (e, milestoneId) => {
    setDraggedMilestoneId(milestoneId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", milestoneId);
  };

  const handleMilestoneDragOver = (e, milestoneId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (milestoneId !== draggedMilestoneId) {
      setDragOverMilestoneId(milestoneId);
    }
  };

  const handleMilestoneDrop = async (e, targetMilestoneId) => {
    e.preventDefault();
    if (!draggedMilestoneId || draggedMilestoneId === targetMilestoneId) {
      setDraggedMilestoneId(null);
      setDragOverMilestoneId(null);
      return;
    }

    const milestones = [...(project.milestones || [])];
    const dragIndex = milestones.findIndex((m) => m.id === draggedMilestoneId);
    const dropIndex = milestones.findIndex((m) => m.id === targetMilestoneId);

    if (dragIndex === -1 || dropIndex === -1) return;

    // Reorder locally
    const [moved] = milestones.splice(dragIndex, 1);
    milestones.splice(dropIndex, 0, moved);

    // Update positions on server
    try {
      for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].position !== i) {
          await updateMilestone(project.id, milestones[i].id, { position: i });
        }
      }
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }

    setDraggedMilestoneId(null);
    setDragOverMilestoneId(null);
  };

  const handleMilestoneDragEnd = () => {
    setDraggedMilestoneId(null);
    setDragOverMilestoneId(null);
  };

  return (
    <div>
      {/* Back button + Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-surface-tertiary cursor-pointer transition-colors"
        >
          <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            <h1 className="text-h2 truncate">{project.name}</h1>
            <Badge variant={variant} size="sm">{label}</Badge>
            {typeInfo && (
              <span className="text-caption">{typeInfo.icon} {typeInfo.label}</span>
            )}
          </div>
          {project.description && (
            <p className="text-body-sm text-muted! mt-1 ml-6">{project.description}</p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => onEdit(project)}>
          Edit
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-heading">{taskCount}</p>
          <p className="text-caption">Total Tasks</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-heading">{taskDone}</p>
          <p className="text-caption">Completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-heading">{progress}%</p>
          <p className="text-caption">Progress</p>
        </div>
      </div>

      {/* Date range */}
      {(project.start_date || project.end_date) && (
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-2 text-body-sm">
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-heading!">
              {project.start_date && formatDate(project.start_date)}
              {project.start_date && project.end_date && " — "}
              {project.end_date && formatDate(project.end_date)}
            </span>
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h4">Milestones</h2>
        </div>

        {project.milestones?.length > 0 && (
          <div className="space-y-1 mb-4">
            {project.milestones.map((milestone) => (
              <div
                key={milestone.id}
                draggable
                onDragStart={(e) => handleMilestoneDragStart(e, milestone.id)}
                onDragOver={(e) => handleMilestoneDragOver(e, milestone.id)}
                onDrop={(e) => handleMilestoneDrop(e, milestone.id)}
                onDragEnd={handleMilestoneDragEnd}
                className={cn(
                  "flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg group transition-all",
                  draggedMilestoneId === milestone.id && "opacity-40",
                  dragOverMilestoneId === milestone.id && draggedMilestoneId !== milestone.id && "border-t-2 border-brand-400"
                )}
              >
                {/* Drag handle */}
                <span className="cursor-grab opacity-0 group-hover:opacity-50 text-muted shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                  </svg>
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleMilestone(milestone)}
                  className={cn(
                    "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors",
                    milestone.is_completed
                      ? "border-brand-500 bg-brand-500"
                      : "border-border-strong hover:border-brand-400"
                  )}
                >
                  {milestone.is_completed && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-body-sm",
                    milestone.is_completed ? "text-muted! line-through" : "text-heading!"
                  )}>
                    {milestone.title}
                  </span>
                  {milestone.due_date && (
                    <span className="text-caption ml-2">{formatDate(milestone.due_date)}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteMilestone(milestone.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted hover:text-danger cursor-pointer transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
            placeholder="Add a milestone"
            size="sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddMilestone();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddMilestone}
            disabled={addingMilestone}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Tasks */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h4">Tasks</h2>
          <Button
            size="sm"
            onClick={() => onNewTask(project.id)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            Add Task
          </Button>
        </div>

        {project.tasks?.length > 0 ? (
          <div className="divide-y divide-border-light">
            {[...project.tasks].sort((a, b) => (a.status === "done") - (b.status === "done")).map((task) => {
              const priority = priorityConfig[task.priority] || priorityConfig.medium;
              const isDone = task.status === "done";
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await updateTask(task.id, { status: isDone ? "todo" : "done" });
                      } catch (error) {
                        addToast({ message: error.message, type: "error" });
                      }
                    }}
                    className={cn(
                      "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors",
                      isDone
                        ? "border-green-500 bg-green-500"
                        : "border-border-strong hover:border-green-400"
                    )}
                  >
                    {isDone && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTaskClick(task)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span className={cn(
                      "text-body-sm flex-1 truncate",
                      isDone ? "text-muted! line-through" : "text-heading!"
                    )}>
                      {task.title}
                    </span>
                    <Badge variant={priority.variant} size="sm">{priority.label}</Badge>
                    {task.due_date && (
                      <span className="text-caption shrink-0">{formatDate(task.due_date)}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-body-sm text-muted! text-center py-6">
            No tasks in this project yet.
          </p>
        )}
      </div>

      {/* Linked content — Notes, Reading List, Whiteboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Notes */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h4">Notes</h2>
            <span className="text-caption text-muted">{linkedNotes.length}</span>
          </div>
          {linkedNotes.length > 0 ? (
            <div className="space-y-2">
              {linkedNotes.slice(0, 5).map((note) => (
                <Link
                  key={note.id}
                  href="/notes"
                  className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <svg className="h-4 w-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-body-sm text-heading! truncate flex-1">{note.title}</span>
                  <span className="text-caption shrink-0">{formatDate(note.updated_at)}</span>
                </Link>
              ))}
              {linkedNotes.length > 5 && (
                <Link href="/notes" className="text-caption text-brand-500 hover:text-brand-400 block text-center pt-1">
                  View all {linkedNotes.length} notes
                </Link>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-muted! text-center py-4">No linked notes</p>
          )}
        </div>

        {/* Reading List */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h4">Reading List</h2>
            <span className="text-caption text-muted">{linkedReadingList.length}</span>
          </div>
          {linkedReadingList.length > 0 ? (
            <div className="space-y-2">
              {linkedReadingList.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg"
                >
                  <svg className="h-4 w-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.467.89 6.065 2.352" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.331 0-4.467.89-6.065 2.352" />
                  </svg>
                  <span className="text-body-sm text-heading! truncate flex-1">{item.title}</span>
                  <Badge variant={item.status === "completed" ? "success" : item.status === "reading" ? "info" : "neutral"} size="sm">
                    {item.status}
                  </Badge>
                </div>
              ))}
              {linkedReadingList.length > 5 && (
                <Link href="/resources" className="text-caption text-brand-500 hover:text-brand-400 block text-center pt-1">
                  View all {linkedReadingList.length} items
                </Link>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-muted! text-center py-4">No linked reading items</p>
          )}
        </div>

        {/* Whiteboards */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h4">Whiteboards</h2>
            <span className="text-caption text-muted">{linkedWhiteboards.length}</span>
          </div>
          {linkedWhiteboards.length > 0 ? (
            <div className="space-y-2">
              {linkedWhiteboards.slice(0, 5).map((wb) => (
                <Link
                  key={wb.id}
                  href="/whiteboards"
                  className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <svg className="h-4 w-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <span className="text-body-sm text-heading! truncate flex-1">{wb.title}</span>
                  {wb.category && <span className="text-caption shrink-0">{wb.category}</span>}
                </Link>
              ))}
              {linkedWhiteboards.length > 5 && (
                <Link href="/whiteboards" className="text-caption text-brand-500 hover:text-brand-400 block text-center pt-1">
                  View all {linkedWhiteboards.length} whiteboards
                </Link>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-muted! text-center py-4">No linked whiteboards</p>
          )}
        </div>
      </div>
    </div>
  );
}
