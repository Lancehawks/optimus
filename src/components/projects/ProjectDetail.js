"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, GripVertical, NotebookPen, PenTool, Pencil, Plus, X } from "lucide-react";
import { Avatar, Button, ErrorState, Input, Spinner, Tabs, useToast } from "@/components/ui";
import { PriorityIcon, StatusIcon } from "@/components/tasks/TaskGlyphs";
import { projectStatusMeta } from "@/components/projects/ProjectCard";
import { cn, formatDate, formatShortDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useProject, useProjectMutations } from "@/hooks/useProjects";
import { useNotes } from "@/hooks/useNotes";
import { useReadingList } from "@/hooks/useReadingList";
import { useWhiteboards } from "@/hooks/useWhiteboards";
import { useTaskMutations } from "@/hooks/useTasks";
import { noteService, projectService, taskService } from "@/services/api";
import TaskModal from "@/components/tasks/TaskModal";

const typeLabels = {
  work: { label: "Work" },
  learning: { label: "Learning" },
  personal: { label: "Personal" },
};

const priorityRank = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function isBeforeToday(date) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target < today;
}

function daysUntil(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function getProjectHealth({ project, progress, overdueTasks, openTasks }) {
  if (project.status === "completed") {
    return { label: "Complete", variant: "success", tone: "text-success", detail: "All wrapped up" };
  }
  if (project.status === "paused") {
    return { label: "Paused", variant: "warning", tone: "text-warning", detail: "Waiting to resume" };
  }
  if (project.end_date && isBeforeToday(project.end_date) && progress < 100) {
    return { label: "At risk", variant: "danger", tone: "text-danger", detail: "Past project deadline" };
  }
  if (overdueTasks.length > 0) {
    return { label: "Needs attention", variant: "warning", tone: "text-warning", detail: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}` };
  }
  if (openTasks.some((task) => task.priority === "urgent")) {
    return { label: "Urgent work", variant: "danger", tone: "text-danger", detail: "Urgent work pending" };
  }
  return { label: "On track", variant: "success", tone: "text-success", detail: "No major blockers" };
}

function SectionHeader({ title, meta, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-heading">
        <span className="truncate">{title}</span>
        {meta !== undefined && meta !== null && <span className="font-mono text-xs font-normal text-muted">{meta}</span>}
      </h2>
      {action}
    </div>
  );
}

function EmptyPanel({ children }) {
  return <p className="px-4 py-5 text-sm text-muted">{children}</p>;
}

function CheckCircle({ done, disabled, onClick, label, square = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center border-[1.5px] transition-colors",
        square ? "rounded-[4px]" : "rounded-full",
        disabled ? "cursor-default opacity-50" : "cursor-pointer",
        done ? "border-brand-500 bg-brand-500 text-white" : "border-border-strong hover:border-heading"
      )}
    >
      {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
    </button>
  );
}

export default function ProjectDetail({ projectId, onBack, onEdit }) {
  const router = useRouter();
  const { user } = useAuth();
  const { project, error, isLoading, refetch } = useProject(projectId);
  const { addMilestone, updateMilestone, deleteMilestone } = useProjectMutations(refetch);
  const { updateTask } = useTaskMutations(refetch);
  const { addToast } = useToast();
  const {
    notes: linkedNotes,
    error: linkedNotesError,
    refetch: refetchLinkedNotes,
  } = useNotes({ project_id: projectId });
  const {
    items: linkedReadingList,
    error: linkedReadingListError,
    refetch: refetchLinkedReadingList,
  } = useReadingList({ project_id: projectId });
  const {
    whiteboards: linkedWhiteboards,
    error: linkedWhiteboardsError,
    refetch: refetchLinkedWhiteboards,
  } = useWhiteboards({ project_id: projectId });

  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Drag state for milestones
  const [draggedMilestoneId, setDraggedMilestoneId] = useState(null);
  const [dragOverMilestoneId, setDragOverMilestoneId] = useState(null);

  useEffect(() => {
    setActiveTab("overview");
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    let isActive = true;
    setMembersLoading(true);
    projectService.listMembers(projectId)
      .then((data) => {
        if (isActive) setMembers(data.members || []);
      })
      .catch((error) => {
        if (isActive) addToast({ message: error.message, type: "error" });
      })
      .finally(() => {
        if (isActive) setMembersLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [projectId, addToast]);

  useEffect(() => {
    if (!projectId) return;

    let isActive = true;
    setActivityLoading(true);
    projectService.listActivity(projectId)
      .then((data) => {
        if (isActive) setActivity(data.activity || []);
      })
      .catch((error) => {
        if (isActive) addToast({ message: error.message, type: "error" });
      })
      .finally(() => {
        if (isActive) setActivityLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [projectId, addToast]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading project">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton mt-6 h-9 w-80" />
        <div className="skeleton mt-4 h-3 w-1/2" />
        <div className="skeleton mt-10 h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Project unavailable"
        description="The project could not be loaded. Your data has not been changed."
        onRetry={refetch}
      />
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-2xl text-heading">Project not found</p>
        <button type="button" onClick={onBack} className="mt-3 cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-heading">Back to projects</button>
      </div>
    );
  }

  const status = projectStatusMeta[project.status] || projectStatusMeta.active;
  const typeInfo = project.type ? typeLabels[project.type] : null;
  const tasks = project.tasks || [];
  const milestones = project.milestones || [];
  const taskCount = project.task_count || tasks.length || 0;
  const taskDone = project.task_done_count || tasks.filter((task) => task.status === "done").length || 0;
  const progress = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
  const projectNotesHref = `/notes?project_id=${project.id}`;
  const projectKanbanHref = `/tasks?project_id=${project.id}&view=kanban`;
  const canManageMembers = project.is_owner || project.user_id === user?.id;
  const isProjectCreator = project.is_owner || project.user_id === user?.id;
  const memberCount = project.member_count || members.length || 1;
  const openTasks = tasks.filter((task) => task.status !== "done");
  const completedMilestones = milestones.filter((milestone) => milestone.is_completed).length;
  const milestoneProgress = milestones.length > 0
    ? Math.round((completedMilestones / milestones.length) * 100)
    : 0;
  const overdueTasks = openTasks.filter((task) => isBeforeToday(task.due_date));
  const urgentTasks = openTasks.filter((task) => task.priority === "urgent");
  const nextTasks = [...openTasks]
    .sort((a, b) => {
      const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (dueA !== dueB) return dueA - dueB;
      return (priorityRank[a.priority] || 5) - (priorityRank[b.priority] || 5);
    })
    .slice(0, 5);
  const nextMilestones = milestones
    .filter((milestone) => !milestone.is_completed)
    .slice(0, 4);
  const health = getProjectHealth({ project, progress, overdueTasks, openTasks });
  const daysLeft = daysUntil(project.end_date);
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "work", label: "Work", count: taskCount },
    { key: "knowledge", label: "Knowledge", count: linkedNotes.length + linkedReadingList.length + linkedWhiteboards.length },
    { key: "team", label: "Team", count: memberCount },
  ];
  const activityLabels = {
    created: "created",
    updated: "updated",
    deleted: "deleted",
    moved_to_project: "shared",
    moved_to_personal: "moved to personal",
    completed: "completed",
    invited: "invited",
    joined: "joined",
    removed: "removed",
  };
  const entityLabels = {
    task: "task",
    note: "note",
    event: "calendar event",
    project: "project",
    milestone: "milestone",
    member: "collaborator",
  };

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
    if (milestone.created_by !== user?.id && !isProjectCreator) return;
    try {
      await updateMilestone(project.id, milestone.id, { isCompleted: !milestone.is_completed });
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!isProjectCreator) return;
    try {
      await deleteMilestone(project.id, milestoneId);
      refetch();
      addToast({ message: "Milestone deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleAddMember = async () => {
    const email = memberEmail.trim();
    if (!email) return;

    setMemberActionLoading(true);
    try {
      const data = await projectService.addMember(project.id, email);
      setMembers(data.members || []);
      setMemberEmail("");
      projectService.listActivity(project.id).then((activityData) => setActivity(activityData.activity || [])).catch(() => {});
      refetch();
      addToast({ message: "Invitation sent", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    setMemberActionLoading(true);
    try {
      const data = await projectService.removeMember(project.id, userId);
      setMembers(data.members || []);
      projectService.listActivity(project.id).then((activityData) => setActivity(activityData.activity || [])).catch(() => {});
      refetch();
      addToast({ message: "Collaborator removed", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleCreateProjectNote = async () => {
    setCreatingNote(true);
    try {
      const data = await noteService.create({
        title: "Untitled",
        content: "",
        projectId: project.id,
      });
      await refetchLinkedNotes();
      router.push(`/notes?project_id=${project.id}&note_id=${data.note.id}`);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setCreatingNote(false);
    }
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleTaskClick = async (task) => {
    try {
      const data = await taskService.get(task.id);
      setEditingTask(data.task);
      setTaskModalOpen(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  // Milestone drag-and-drop reorder
  const handleMilestoneDragStart = (e, milestoneId) => {
    if (!isProjectCreator) return;
    setDraggedMilestoneId(milestoneId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", milestoneId);
  };

  const handleMilestoneDragOver = (e, milestoneId) => {
    if (!isProjectCreator) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (milestoneId !== draggedMilestoneId) {
      setDragOverMilestoneId(milestoneId);
    }
  };

  const handleMilestoneDrop = async (e, targetMilestoneId) => {
    e.preventDefault();
    if (!isProjectCreator) return;
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

  const projectColor = project.color || "var(--neutral-400)";
  const deadlineLabel = daysLeft === null
    ? null
    : daysLeft < 0
      ? `${Math.abs(daysLeft)}d past end date`
      : daysLeft === 0
        ? "Ends today"
        : `${daysLeft}d left`;

  const renderTaskRow = (task, { toggle = false } = {}) => {
    const isDone = task.status === "done";
    const overdue = !isDone && isBeforeToday(task.due_date);
    const canEditTask = task.user_id === user?.id || isProjectCreator;
    return (
      <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-secondary">
        {toggle ? (
          <CheckCircle
            done={isDone}
            disabled={!canEditTask}
            label={isDone ? "Mark as to do" : "Mark as done"}
            onClick={async (event) => {
              event.stopPropagation();
              try {
                await updateTask(task.id, { status: isDone ? "todo" : "done" });
              } catch (requestError) {
                addToast({ message: requestError.message, type: "error" });
              }
            }}
          />
        ) : (
          <StatusIcon status={task.status} />
        )}
        <button type="button" onClick={() => handleTaskClick(task)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
          <span className={cn("min-w-0 flex-1 truncate text-sm", isDone ? "text-muted line-through" : "text-heading")}>{task.title}</span>
          <PriorityIcon priority={task.priority} />
          <span className={cn("hidden w-20 whitespace-nowrap text-right font-mono text-xs tabular-nums sm:block", overdue ? "text-danger" : "text-muted")}>
            {task.due_date ? formatShortDate(task.due_date) : ""}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="group mb-6 inline-flex cursor-pointer items-center gap-1 text-xs text-muted transition-colors hover:text-heading"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Projects
      </button>

      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-4 w-4 shrink-0 rounded-[5px]" style={{ backgroundColor: projectColor }} />
            <h1 className="text-title truncate">{project.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isProjectCreator && (
              <Button variant="secondary" leftIcon={<Pencil />} onClick={() => onEdit(project)}>
                Edit
              </Button>
            )}
            <Button leftIcon={<Plus />} onClick={handleNewTask}>Add task</Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          <span className={cn("font-medium", health.tone)}>{health.label}</span>
          {typeInfo && <span>{typeInfo.label}</span>}
          {(project.start_date || project.end_date) && (
            <span className="font-mono">
              {project.start_date && formatDate(project.start_date)}
              {project.start_date && project.end_date && " → "}
              {project.end_date && formatDate(project.end_date)}
            </span>
          )}
          {deadlineLabel && <span className={cn("font-mono", daysLeft < 0 && "text-danger")}>{deadlineLabel}</span>}
          {members.length > 0 && (
            <span className="flex items-center -space-x-1.5">
              {members.slice(0, 5).map((member) => (
                <Avatar key={member.id} src={member.avatar_url} name={member.full_name} size="xs" className="ring-2 ring-surface" />
              ))}
            </span>
          )}
        </div>

        {project.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-body">{project.description}</p>}

        <div className="mt-6 max-w-2xl">
          <div className="h-1 overflow-hidden rounded-full bg-surface-tertiary">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: projectColor }} />
          </div>
          <p className="mt-2 font-mono text-[0.6875rem] tabular-nums text-muted">
            <span className="text-heading">{progress}%</span> · {taskDone}/{taskCount} tasks
            {milestones.length > 0 && <> · {completedMilestones}/{milestones.length} milestones</>}
          </p>
        </div>
      </header>

      <Tabs variant="underline" tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-8" />

      {activeTab === "overview" && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] lg:gap-8">
          <div className="space-y-10">
            <section>
              <SectionHeader
                title="Next up"
                meta={nextTasks.length}
                action={
                  <button type="button" onClick={() => setActiveTab("work")} className="cursor-pointer text-xs text-muted hover:text-heading">
                    All work
                  </button>
                }
              />
              <div className="card divide-y divide-border overflow-hidden">
                {nextTasks.length > 0 ? nextTasks.map((task) => renderTaskRow(task)) : <EmptyPanel>No open tasks waiting.</EmptyPanel>}
              </div>
            </section>

            <section>
              <SectionHeader title="Milestones" meta={milestones.length ? `${completedMilestones}/${milestones.length}` : null} />
              {milestones.length > 0 ? (
                <ol className="relative ml-1.5 border-l border-border pl-6">
                  {milestones.map((milestone) => (
                    <li key={milestone.id} className="relative pb-5 last:pb-0">
                      <span
                        className={cn(
                          "absolute -left-[1.84rem] top-1 h-3 w-3 rounded-full border-2",
                          milestone.is_completed ? "border-heading bg-heading" : "border-border-strong bg-surface"
                        )}
                      />
                      <p className={cn("text-sm", milestone.is_completed ? "text-muted line-through" : "text-heading")}>{milestone.title}</p>
                      {milestone.due_date && <p className="mt-0.5 font-mono text-[0.6875rem] text-muted">{formatShortDate(milestone.due_date)}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">
                  No milestones yet.{" "}
                  <button type="button" onClick={() => setActiveTab("work")} className="cursor-pointer text-heading underline underline-offset-4">Add one</button>
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-10">
            <section>
              <SectionHeader title="Health" />
              <div className="card p-4">
                <p className={cn("text-sm font-medium", health.tone)}>{health.label}</p>
                <p className="mt-0.5 text-xs text-muted">{health.detail}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
                  {[
                    ["Open", openTasks.length, ""],
                    ["Done", taskDone, ""],
                    ["Overdue", overdueTasks.length, overdueTasks.length > 0 ? "text-danger" : ""],
                    ["Urgent", urgentTasks.length, urgentTasks.length > 0 ? "text-danger" : ""],
                  ].map(([label, value, tone]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className={cn("mt-0.5 font-mono text-lg tabular-nums text-heading", tone)}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={projectKanbanHref} className="mt-4 inline-flex items-center gap-1 text-xs text-muted hover:text-heading">
                  Open board <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </section>

            <section>
              <SectionHeader title="Material" />
              <div className="card divide-y divide-border overflow-hidden">
                {[
                  ["Notes", linkedNotes.length, NotebookPen],
                  ["Reading list", linkedReadingList.length, BookOpen],
                  ["Whiteboards", linkedWhiteboards.length, PenTool],
                ].map(([label, count, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveTab("knowledge")}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                  >
                    <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
                    <span className="flex-1 text-sm text-heading">{label}</span>
                    <span className="font-mono text-xs text-muted">{count}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {activeTab === "work" && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] lg:gap-8">
          <section>
            <SectionHeader
              title="Tasks"
              meta={`${openTasks.length} open · ${taskDone} done`}
              action={<Button size="sm" variant="secondary" leftIcon={<Plus />} onClick={handleNewTask}>Add task</Button>}
            />
            <div className="card divide-y divide-border overflow-hidden">
              {tasks.length > 0
                ? [...tasks].sort((a, b) => (a.status === "done") - (b.status === "done")).map((task) => renderTaskRow(task, { toggle: true }))
                : <EmptyPanel>No tasks in this project yet.</EmptyPanel>}
            </div>
          </section>

          <section>
            <SectionHeader title="Milestones" meta={`${completedMilestones}/${milestones.length}`} />
            <div className="card overflow-hidden">
              {milestones.length > 0 && (
                <div className="divide-y divide-border">
                  {milestones.map((milestone) => {
                    const canEditMilestone = milestone.created_by === user?.id || isProjectCreator;
                    return (
                      <div
                        key={milestone.id}
                        draggable={isProjectCreator}
                        onDragStart={(event) => handleMilestoneDragStart(event, milestone.id)}
                        onDragOver={(event) => handleMilestoneDragOver(event, milestone.id)}
                        onDrop={(event) => handleMilestoneDrop(event, milestone.id)}
                        onDragEnd={handleMilestoneDragEnd}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2.5 transition-colors",
                          draggedMilestoneId === milestone.id && "opacity-40",
                          dragOverMilestoneId === milestone.id && draggedMilestoneId !== milestone.id && "bg-brand-50"
                        )}
                      >
                        {isProjectCreator ? (
                          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-placeholder opacity-0 group-hover:opacity-100" />
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <CheckCircle
                          done={milestone.is_completed}
                          disabled={!canEditMilestone}
                          onClick={() => handleToggleMilestone(milestone)}
                          label={milestone.is_completed ? "Reopen milestone" : "Complete milestone"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm", milestone.is_completed ? "text-muted line-through" : "text-heading")}>{milestone.title}</p>
                          {milestone.due_date && <p className="font-mono text-[0.6875rem] text-muted">{formatDate(milestone.due_date)}</p>}
                        </div>
                        {isProjectCreator && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMilestone(milestone.id)}
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                            aria-label={`Delete ${milestone.title}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={cn("flex items-center gap-2.5 px-3 py-2", milestones.length > 0 && "border-t border-border")}>
                <Plus className="ml-6 h-3.5 w-3.5 text-muted" />
                <input
                  value={newMilestoneTitle}
                  onChange={(event) => setNewMilestoneTitle(event.target.value)}
                  placeholder="Add a milestone"
                  aria-label="Add a milestone"
                  disabled={addingMilestone}
                  className="flex-1 bg-transparent py-1 text-sm text-heading outline-none placeholder:text-placeholder"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddMilestone();
                    }
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "knowledge" && (
        <div className="grid gap-8 lg:grid-cols-3">
          <section>
            <SectionHeader
              title="Notes"
              meta={linkedNotes.length}
              action={<Button type="button" variant="ghost" size="xs" leftIcon={<Plus />} onClick={handleCreateProjectNote} isLoading={creatingNote}>New</Button>}
            />
            <div className="card divide-y divide-border overflow-hidden">
              {linkedNotesError ? (
                <ErrorState compact className="m-3" title="Notes unavailable" onRetry={refetchLinkedNotes} />
              ) : linkedNotes.length > 0 ? (
                linkedNotes.slice(0, 8).map((note) => (
                  <Link key={note.id} href={`${projectNotesHref}&note_id=${note.id}`} className="block px-4 py-2.5 transition-colors hover:bg-surface-secondary">
                    <p className="truncate text-sm text-heading">{note.title}</p>
                    <p className="mt-0.5 font-mono text-[0.6875rem] text-muted">{formatShortDate(note.updated_at)}</p>
                  </Link>
                ))
              ) : (
                <EmptyPanel>No linked notes.</EmptyPanel>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Reading list" meta={linkedReadingList.length} />
            <div className="card divide-y divide-border overflow-hidden">
              {linkedReadingListError ? (
                <ErrorState compact className="m-3" title="Reading list unavailable" onRetry={refetchLinkedReadingList} />
              ) : linkedReadingList.length > 0 ? (
                linkedReadingList.slice(0, 8).map((item) => (
                  <div key={item.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-heading">{item.title}</p>
                      <span className="shrink-0 text-xs capitalize text-muted">{item.status}</span>
                    </div>
                    <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-surface-tertiary">
                      <div className="h-full bg-heading" style={{ width: `${item.progress || 0}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel>No linked reading.</EmptyPanel>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Whiteboards" meta={linkedWhiteboards.length} />
            <div className="card divide-y divide-border overflow-hidden">
              {linkedWhiteboardsError ? (
                <ErrorState compact className="m-3" title="Whiteboards unavailable" onRetry={refetchLinkedWhiteboards} />
              ) : linkedWhiteboards.length > 0 ? (
                linkedWhiteboards.slice(0, 8).map((whiteboard) => (
                  <Link key={whiteboard.id} href="/whiteboards" className="block px-4 py-2.5 transition-colors hover:bg-surface-secondary">
                    <p className="truncate text-sm text-heading">{whiteboard.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted">{whiteboard.category || "Whiteboard"}</p>
                  </Link>
                ))
              ) : (
                <EmptyPanel>No linked whiteboards.</EmptyPanel>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "team" && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-8">
          <section>
            <SectionHeader title="People" meta={memberCount} action={membersLoading ? <Spinner size="sm" /> : null} />
            <div className="card overflow-hidden">
              {members.length > 0 ? (
                <div className="divide-y divide-border">
                  {members.map((member) => {
                    const isCreator = member.id === project.user_id;
                    const displayName = member.full_name || "Project member";
                    return (
                      <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Avatar src={member.avatar_url} name={displayName} alt={displayName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-heading">{displayName}</p>
                          <p className="text-xs text-muted">{isCreator ? "Owner" : "Collaborator"}</p>
                        </div>
                        {!isCreator && canManageMembers && (
                          <Button type="button" variant="ghost" size="xs" onClick={() => handleRemoveMember(member.id)} disabled={memberActionLoading}>
                            Remove
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel>Just you so far.</EmptyPanel>
              )}

              {canManageMembers && (
                <div className="border-t border-border bg-surface-secondary p-3">
                  <div className="flex gap-2">
                    <Input
                      value={memberEmail}
                      onChange={(event) => setMemberEmail(event.target.value)}
                      placeholder="teammate@lancehawks.com"
                      size="sm"
                      type="email"
                      aria-label="Collaborator email"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddMember();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddMember} isLoading={memberActionLoading}>
                      Invite
                    </Button>
                  </div>
                  <p className="mt-2 text-[0.6875rem] text-muted">
                    They need an Optimus account first. <Link href="/settings#invitations" className="underline underline-offset-2 hover:text-heading">Invite them to the workspace</Link>.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Activity" action={activityLoading ? <Spinner size="sm" /> : null} />
            {activity.length > 0 ? (
              <ol className="space-y-4">
                {activity.slice(0, 12).map((item) => {
                  const actorName = item.actor_full_name || "Someone";
                  const action = activityLabels[item.action] || item.action?.replaceAll("_", " ");
                  const entity = entityLabels[item.entity_type] || item.entity_type;
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <Avatar src={item.actor_avatar_url} name={actorName} alt={actorName} size="xs" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-body">
                          <span className="font-medium text-heading">{actorName}</span> {action} {entity}
                          {item.entity_title ? <span className="text-muted"> · {item.entity_title}</span> : null}
                        </p>
                        <p className="mt-0.5 font-mono text-[0.6875rem] text-placeholder">{formatDate(item.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted">No shared activity yet.</p>
            )}
          </section>
        </div>
      )}

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        defaultProjectId={project.id}
        onSave={refetch}
      />
    </div>
  );
}
