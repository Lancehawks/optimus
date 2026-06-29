"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Input, Spinner, Tabs, useToast } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useProject, useProjectMutations } from "@/hooks/useProjects";
import { useNotes } from "@/hooks/useNotes";
import { useReadingList } from "@/hooks/useReadingList";
import { useWhiteboards } from "@/hooks/useWhiteboards";
import { useTaskMutations } from "@/hooks/useTasks";
import { noteService, projectService } from "@/services/api";

const statusBadge = {
  active: { variant: "success", label: "Active" },
  paused: { variant: "warning", label: "Paused" },
  completed: { variant: "default", label: "Completed" },
  archived: { variant: "neutral", label: "Archived" },
};

const typeLabels = {
  work: { label: "Work" },
  learning: { label: "Learning" },
  personal: { label: "Personal" },
};

const priorityConfig = {
  urgent: { variant: "danger", label: "Urgent" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "neutral", label: "Low" },
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
    return { label: "Complete", variant: "success", tone: "text-green-500", detail: "All wrapped up" };
  }
  if (project.status === "paused") {
    return { label: "Paused", variant: "warning", tone: "text-amber-500", detail: "Waiting to resume" };
  }
  if (project.end_date && isBeforeToday(project.end_date) && progress < 100) {
    return { label: "At risk", variant: "danger", tone: "text-red-500", detail: "Past project deadline" };
  }
  if (overdueTasks.length > 0) {
    return { label: "Needs attention", variant: "warning", tone: "text-amber-500", detail: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}` };
  }
  if (openTasks.some((task) => task.priority === "urgent")) {
    return { label: "Hot", variant: "danger", tone: "text-red-500", detail: "Urgent work pending" };
  }
  return { label: "On track", variant: "success", tone: "text-green-500", detail: "No major blockers" };
}

function ProjectMetric({ label, value, detail, tone = "brand" }) {
  const toneClasses = {
    brand: "bg-brand-500/10 text-brand-300",
    success: "bg-success-light text-green-500",
    warning: "bg-warning-light text-amber-500",
    danger: "bg-danger-light text-red-500",
    neutral: "bg-surface-tertiary text-muted",
  };

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-heading!">{value}</p>
        </div>
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneClasses[tone])} />
      </div>
      {detail && <p className="mt-2 truncate text-caption text-muted">{detail}</p>}
    </div>
  );
}

function SectionHeader({ title, meta, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-h4 truncate">{title}</h2>
        {meta && <p className="mt-1 text-caption text-muted">{meta}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyPanel({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-border-light bg-surface-secondary/45 px-4 py-6 text-center text-body-sm text-muted">
      {children}
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

function CircularProgress({ value, tone = "brand" }) {
  const safeValue = Math.min(Math.max(value, 0), 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeValue / 100) * circumference;
  const toneClasses = {
    brand: "text-brand-500",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Kanban health ${safeValue}%`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          className="text-border-light"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
        />
        <circle
          className={toneClasses[tone] || toneClasses.brand}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-heading!">{safeValue}%</span>
        <span className="text-caption text-muted">Health</span>
      </div>
    </div>
  );
}

function KanbanHealthCard({ progress, taskCount, taskDone, openTasks, overdueTasks, urgentTasks, href }) {
  const tone = overdueTasks.length > 0 ? "warning" : urgentTasks.length > 0 ? "danger" : progress >= 75 ? "success" : "brand";
  const summary = overdueTasks.length > 0
    ? `${overdueTasks.length} overdue item${overdueTasks.length === 1 ? "" : "s"}`
    : urgentTasks.length > 0
      ? `${urgentTasks.length} urgent item${urgentTasks.length === 1 ? "" : "s"}`
      : openTasks.length > 0
        ? `${openTasks.length} active item${openTasks.length === 1 ? "" : "s"}`
        : "Board is clear";

  const metrics = [
    { label: "Open", value: openTasks.length },
    { label: "Done", value: `${taskDone}/${taskCount}` },
    { label: "Overdue", value: overdueTasks.length },
    { label: "Urgent", value: urgentTasks.length },
  ];

  return (
    <section className="card p-5">
      <SectionHeader
        title="Kanban Health"
        meta={summary}
        action={
          <Link href={href} className="btn-base btn-secondary px-3 py-1.5 text-xs">
            View Kanban
          </Link>
        }
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <CircularProgress value={progress} tone={tone} />
        <div className="grid flex-1 grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
              <p className="text-caption text-muted">{metric.label}</p>
              <p className="mt-1 text-lg font-semibold text-heading!">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ProjectDetail({ projectId, onBack, onEdit, onTaskClick, onNewTask }) {
  const router = useRouter();
  const { user } = useAuth();
  const { project, isLoading, refetch } = useProject(projectId);
  const { addMilestone, updateMilestone, deleteMilestone } = useProjectMutations(refetch);
  const { updateTask } = useTaskMutations(refetch);
  const { addToast } = useToast();
  const { notes: linkedNotes, refetch: refetchLinkedNotes } = useNotes({ project_id: projectId });
  const { items: linkedReadingList } = useReadingList({ project_id: projectId });
  const { whiteboards: linkedWhiteboards } = useWhiteboards({ project_id: projectId });

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
  const tasks = project.tasks || [];
  const milestones = project.milestones || [];
  const taskCount = project.task_count || tasks.length || 0;
  const taskDone = project.task_done_count || tasks.filter((task) => task.status === "done").length || 0;
  const progress = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
  const projectNotesHref = `/notes?project_id=${project.id}`;
  const projectKanbanHref = `/tasks?project_id=${project.id}&view=kanban`;
  const canManageMembers = project.is_owner || project.user_id === user?.id;
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
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: project.color || "var(--brand-500)" }} />
        <div className="p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary text-muted transition-colors hover:border-border-strong hover:text-heading"
                  aria-label="Back to projects"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                    <h1 className="text-h2 truncate">{project.name}</h1>
                    <Badge variant={variant} size="sm">{label}</Badge>
                    {typeInfo && <Badge variant="neutral" size="sm">{typeInfo.label}</Badge>}
                    <Badge variant={health.variant} size="sm">{health.label}</Badge>
                  </div>
                  {project.description && (
                    <p className="mt-2 max-w-3xl text-body-sm text-muted!">{project.description}</p>
                  )}
                </div>
              </div>

              <div className="max-w-3xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-caption text-muted">Project progress</span>
                  <span className="text-caption font-semibold text-heading!">{progress}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
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
              <Button variant="secondary" size="sm" onClick={() => onEdit(project)}>
                Edit Project
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ProjectMetric label="Tasks done" value={`${taskDone}/${taskCount}`} detail={`${openTasks.length} still open`} tone={openTasks.length ? "brand" : "success"} />
            <ProjectMetric label="Milestones" value={`${completedMilestones}/${milestones.length}`} detail={`${milestoneProgress}% complete`} tone={milestones.length ? "brand" : "neutral"} />
            <ProjectMetric label="Deadline" value={daysLeft === null ? "Unset" : daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? "Today" : `${daysLeft}d left`} detail={project.end_date ? formatDate(project.end_date) : "No end date"} tone={daysLeft !== null && daysLeft < 0 ? "danger" : "neutral"} />
            <ProjectMetric label="Team" value={memberCount} detail={memberCount === 1 ? "Solo project" : "Shared workspace"} tone={memberCount > 1 ? "success" : "neutral"} />
          </div>
        </div>
      </section>

      <div className="overflow-x-auto">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="min-w-max" />
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <section className="card p-5">
              <SectionHeader title="Command Summary" meta={health.detail} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface-secondary p-4">
                  <p className={cn("text-body-sm font-semibold", health.tone)}>{health.label}</p>
                  <p className="mt-2 text-caption text-muted">{health.detail}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-secondary p-4">
                  <p className="text-body-sm font-semibold text-heading!">{urgentTasks.length} urgent</p>
                  <p className="mt-2 text-caption text-muted">High-pressure work in this project</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-secondary p-4">
                  <p className="text-body-sm font-semibold text-heading!">{overdueTasks.length} overdue</p>
                  <p className="mt-2 text-caption text-muted">Tasks past their due date</p>
                </div>
              </div>
            </section>

            <section className="card p-5">
              <SectionHeader
                title="Next Up"
                meta={`${nextTasks.length} priority item${nextTasks.length === 1 ? "" : "s"}`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab("work")}>
                    View work
                  </Button>
                }
              />
              {nextTasks.length > 0 ? (
                <div className="divide-y divide-border-light">
                  {nextTasks.map((task) => {
                    const priority = priorityConfig[task.priority] || priorityConfig.medium;
                    const overdue = isBeforeToday(task.due_date);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick(task)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-secondary"
                      >
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", overdue ? "bg-red-500" : "bg-brand-500")} />
                        <span className="min-w-0 flex-1 truncate text-body-sm text-heading!">{task.title}</span>
                        <Badge variant={priority.variant} size="sm">{priority.label}</Badge>
                        {task.due_date && <span className={cn("hidden text-caption sm:block", overdue && "text-danger!")}>{formatDate(task.due_date)}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel>No open tasks waiting.</EmptyPanel>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <KanbanHealthCard
              progress={progress}
              taskCount={taskCount}
              taskDone={taskDone}
              openTasks={openTasks}
              overdueTasks={overdueTasks}
              urgentTasks={urgentTasks}
              href={projectKanbanHref}
            />

            <section className="card p-5">
              <SectionHeader title="Milestone Path" meta={`${milestoneProgress}% complete`} />
              <ProgressBar value={milestoneProgress} />
              <div className="mt-4 space-y-2">
                {nextMilestones.length > 0 ? nextMilestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm text-heading!">{milestone.title}</p>
                      {milestone.due_date && <p className="text-caption text-muted">{formatDate(milestone.due_date)}</p>}
                    </div>
                  </div>
                )) : (
                  <EmptyPanel>No pending milestones.</EmptyPanel>
                )}
              </div>
            </section>

            <section className="card p-5">
              <SectionHeader title="Workspace" meta="Linked project material" />
              <div className="grid gap-3">
                <button type="button" onClick={() => setActiveTab("knowledge")} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-3 text-left transition-colors hover:border-border-strong">
                  <span className="text-body-sm text-heading!">Notes</span>
                  <Badge variant="neutral" size="sm">{linkedNotes.length}</Badge>
                </button>
                <button type="button" onClick={() => setActiveTab("knowledge")} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-3 text-left transition-colors hover:border-border-strong">
                  <span className="text-body-sm text-heading!">Reading List</span>
                  <Badge variant="neutral" size="sm">{linkedReadingList.length}</Badge>
                </button>
                <button type="button" onClick={() => setActiveTab("knowledge")} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-3 text-left transition-colors hover:border-border-strong">
                  <span className="text-body-sm text-heading!">Whiteboards</span>
                  <Badge variant="neutral" size="sm">{linkedWhiteboards.length}</Badge>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "work" && (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="card p-5">
            <SectionHeader
              title="Tasks"
              meta={`${openTasks.length} open, ${taskDone} completed`}
              action={
                <Button size="sm" onClick={() => onNewTask(project.id)}>Add Task</Button>
              }
            />

            {tasks.length > 0 ? (
              <div className="divide-y divide-border-light">
                {[...tasks].sort((a, b) => (a.status === "done") - (b.status === "done")).map((task) => {
                  const priority = priorityConfig[task.priority] || priorityConfig.medium;
                  const isDone = task.status === "done";
                  const overdue = !isDone && isBeforeToday(task.due_date);
                  return (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-secondary">
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            await updateTask(task.id, { status: isDone ? "todo" : "done" });
                          } catch (error) {
                            addToast({ message: error.message, type: "error" });
                          }
                        }}
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isDone ? "border-green-500 bg-green-500" : "border-border-strong hover:border-green-400"
                        )}
                      >
                        {isDone && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                      <button type="button" onClick={() => onTaskClick(task)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className={cn("min-w-0 flex-1 truncate text-body-sm", isDone ? "text-muted! line-through" : "text-heading!")}>{task.title}</span>
                        <Badge variant={priority.variant} size="sm">{priority.label}</Badge>
                        {task.due_date && <span className={cn("hidden text-caption md:block", overdue && "text-danger!")}>{formatDate(task.due_date)}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel>No tasks in this project yet.</EmptyPanel>
            )}
          </section>

          <section className="card p-5">
            <SectionHeader title="Milestones" meta={`${completedMilestones}/${milestones.length} completed`} />

            {milestones.length > 0 && (
              <div className="mb-4 space-y-1">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    draggable
                    onDragStart={(event) => handleMilestoneDragStart(event, milestone.id)}
                    onDragOver={(event) => handleMilestoneDragOver(event, milestone.id)}
                    onDrop={(event) => handleMilestoneDrop(event, milestone.id)}
                    onDragEnd={handleMilestoneDragEnd}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-2 py-2 transition-all",
                      draggedMilestoneId === milestone.id && "opacity-40",
                      dragOverMilestoneId === milestone.id && draggedMilestoneId !== milestone.id && "border-t-2 border-brand-400"
                    )}
                  >
                    <span className="shrink-0 cursor-grab text-muted opacity-0 transition-opacity group-hover:opacity-60">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleMilestone(milestone)}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        milestone.is_completed ? "border-brand-500 bg-brand-500" : "border-border-strong hover:border-brand-400"
                      )}
                    >
                      {milestone.is_completed && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-body-sm", milestone.is_completed ? "text-muted! line-through" : "text-heading!")}>{milestone.title}</p>
                      {milestone.due_date && <p className="text-caption text-muted">{formatDate(milestone.due_date)}</p>}
                    </div>
                    <button type="button" onClick={() => handleDeleteMilestone(milestone.id)} className="rounded p-1 text-muted opacity-0 transition-all hover:text-danger group-hover:opacity-100">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newMilestoneTitle}
                onChange={(event) => setNewMilestoneTitle(event.target.value)}
                placeholder="Add a milestone"
                size="sm"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddMilestone();
                  }
                }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleAddMilestone} disabled={addingMilestone}>
                Add
              </Button>
            </div>
          </section>
        </div>
      )}

      {activeTab === "knowledge" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5">
            <SectionHeader
              title="Notes"
              meta={`${linkedNotes.length} linked`}
              action={<Button type="button" variant="secondary" size="sm" onClick={handleCreateProjectNote} isLoading={creatingNote}>Add</Button>}
            />
            {linkedNotes.length > 0 ? (
              <div className="space-y-2">
                {linkedNotes.slice(0, 8).map((note) => (
                  <Link key={note.id} href={`${projectNotesHref}&note_id=${note.id}`} className="block rounded-lg border border-border bg-surface-secondary px-3 py-2 transition-colors hover:border-border-strong">
                    <p className="truncate text-body-sm font-medium text-heading!">{note.title}</p>
                    <p className="mt-1 text-caption text-muted">{formatDate(note.updated_at)}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyPanel>No linked notes.</EmptyPanel>
            )}
          </section>

          <section className="card p-5">
            <SectionHeader title="Reading List" meta={`${linkedReadingList.length} linked`} />
            {linkedReadingList.length > 0 ? (
              <div className="space-y-2">
                {linkedReadingList.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-body-sm font-medium text-heading!">{item.title}</p>
                      <Badge variant={item.status === "completed" ? "success" : item.status === "reading" ? "info" : "neutral"} size="sm">{item.status}</Badge>
                    </div>
                    <p className="mt-1 text-caption text-muted">{item.progress || 0}% progress</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel>No linked reading items.</EmptyPanel>
            )}
          </section>

          <section className="card p-5">
            <SectionHeader title="Whiteboards" meta={`${linkedWhiteboards.length} linked`} />
            {linkedWhiteboards.length > 0 ? (
              <div className="space-y-2">
                {linkedWhiteboards.slice(0, 8).map((whiteboard) => (
                  <Link key={whiteboard.id} href="/whiteboards" className="block rounded-lg border border-border bg-surface-secondary px-3 py-2 transition-colors hover:border-border-strong">
                    <p className="truncate text-body-sm font-medium text-heading!">{whiteboard.title}</p>
                    <p className="mt-1 text-caption text-muted">{whiteboard.category || "Whiteboard"}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyPanel>No linked whiteboards.</EmptyPanel>
            )}
          </section>
        </div>
      )}

      {activeTab === "team" && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="card p-5">
            <SectionHeader title="Collaborators" meta={`${memberCount} project member${memberCount === 1 ? "" : "s"}`} action={membersLoading ? <Spinner size="sm" /> : null} />

            {members.length > 0 ? (
              <div className="mb-4 divide-y divide-border-light">
                {members.map((member) => {
                  const isCreator = member.id === project.user_id;
                  const displayName = member.full_name || "Project member";
                  return (
                    <div key={member.id} className="flex items-center gap-3 py-3">
                      <Avatar src={member.avatar_url} name={displayName} alt={displayName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-heading!">{displayName}</p>
                        <p className="text-caption text-muted">{isCreator ? "Project creator" : "Collaborator"}</p>
                      </div>
                      {isCreator ? (
                        <Badge variant="neutral" size="sm">Creator</Badge>
                      ) : canManageMembers ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)} disabled={memberActionLoading}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel>No collaborators yet.</EmptyPanel>
            )}

            {canManageMembers && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="name@example.com"
                  size="sm"
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
            )}
          </section>

          <section className="card p-5">
            <SectionHeader title="Recent Activity" meta="Shared project changes" action={activityLoading ? <Spinner size="sm" /> : null} />
            {activity.length > 0 ? (
              <div className="divide-y divide-border-light">
                {activity.slice(0, 12).map((item) => {
                  const actorName = item.actor_full_name || "Someone";
                  const action = activityLabels[item.action] || item.action?.replaceAll("_", " ");
                  const entity = entityLabels[item.entity_type] || item.entity_type;

                  return (
                    <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar src={item.actor_avatar_url} name={actorName} alt={actorName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm text-heading!">
                          <span className="font-medium">{actorName}</span>{" "}
                          {action} {entity}
                          {item.entity_title ? <span className="text-muted!">: {item.entity_title}</span> : null}
                        </p>
                        <p className="mt-0.5 text-caption text-muted">{formatDate(item.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel>No shared activity yet.</EmptyPanel>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
