"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, formatDate, toLocalDateStr } from "@/lib/utils";
import { Badge, Checkbox, Button } from "@/components/ui";
import { taskService } from "@/services/api";

const priorityConfig = {
  urgent: { variant: "danger", label: "Urgent" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "neutral", label: "Low" },
};

const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  on_hold: "On Hold",
  done: "Done",
};

function GripIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7 2a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2zM7 8a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2zM7 14a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2z" />
    </svg>
  );
}

// ── Completion toggle (round circle) ──────────────────────────
function CompletionToggle({ isDone, onToggle }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all",
        isDone
          ? "bg-brand-500 border-brand-500"
          : "border-border-strong hover:border-brand-400"
      )}
      title={isDone ? "Mark as todo" : "Mark as done"}
    >
      {isDone && (
        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
    </button>
  );
}

// ── Inline subtask list ───────────────────────────────────────
function InlineSubtasks({ taskId, expanded, onSubtaskCountChange }) {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (expanded && !loaded) {
      setLoading(true);
      taskService.get(taskId).then((data) => {
        setSubtasks(data.task?.subtasks || []);
        setLoaded(true);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [expanded, taskId, loaded]);

  const handleToggle = async (subtask) => {
    const newStatus = subtask.status === "done" ? "todo" : "done";
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, status: newStatus } : s))
    );
    const newDoneCount = subtasks.filter((s) =>
      s.id === subtask.id ? newStatus === "done" : s.status === "done"
    ).length;
    onSubtaskCountChange?.(taskId, newDoneCount);
    try {
      await taskService.updateSubtask(taskId, subtask.id, { status: newStatus });
    } catch {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, status: subtask.status } : s))
      );
    }
  };

  if (!expanded) return null;

  if (loading) {
    return (
      <div className="pl-16 sm:pl-24 pr-4 py-2 border-t border-border-light/50">
        <div className="flex items-center gap-2 text-caption text-muted py-1">
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading subtasks...
        </div>
      </div>
    );
  }

  if (subtasks.length === 0) return null;

  return (
    <div className="pl-16 sm:pl-24 pr-4 py-1.5 border-t border-border-light/50 bg-surface-tertiary/30">
      {subtasks.map((subtask, i) => (
        <div
          key={subtask.id}
          className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-surface-tertiary/50 transition-colors"
        >
          <button
            onClick={() => handleToggle(subtask)}
            className={cn(
              "shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center cursor-pointer transition-colors",
              subtask.status === "done"
                ? "bg-brand-500 border-brand-500"
                : "border-border-strong hover:border-brand-400"
            )}
          >
            {subtask.status === "done" && (
              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
          <span className={cn(
            "text-body-sm",
            subtask.status === "done" ? "text-muted! line-through" : "text-heading!"
          )}>
            {subtask.title}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Shared row content ────────────────────────────────────────
function TaskRowContent({ task, onTaskClick, onDefer, onDelete, onArchive, onToggleComplete, showDeferButton = true, expandedTaskId, onToggleExpand }) {
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const isOverdue = task.due_date && toLocalDateStr(task.due_date) < toLocalDateStr() && task.status !== "done";

  // Two-click delete: first click arms it, second click confirms, 3s auto-cancel
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(deleteTimerRef.current), []);

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (confirmingDelete) {
      clearTimeout(deleteTimerRef.current);
      setConfirmingDelete(false);
      onDelete?.(task.id);
    } else {
      setConfirmingDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  const handleSubtaskBadgeClick = (e) => {
    e.stopPropagation();
    onToggleExpand?.(task.id);
  };

  return (
    <>
      {/* Completion toggle */}
      <CompletionToggle
        isDone={task.status === "done"}
        onToggle={() => onToggleComplete?.(task.id)}
      />

      {/* Title + meta */}
      <div className="flex-1 min-w-0" onClick={() => onTaskClick?.(task)}>
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            "text-body-sm text-heading! font-medium truncate",
            task.status === "done" && "line-through text-muted!"
          )}>
            {task.title}
          </p>
          {task.recurrence_rule && (
            <span className="text-caption shrink-0 text-brand-500" title={`Repeats ${task.recurrence_rule}`}>
              <svg className="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M4.031 9.865H2.985" />
              </svg>
            </span>
          )}
          {task.blocking_count > 0 && (
            <span className="text-caption shrink-0 text-amber-500" title={`Blocked by ${task.blocking_count} task(s)`}>
              <svg className="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
          )}
          {task.project_name && (
            <span className="text-caption shrink-0 bg-surface-tertiary px-1.5 py-0.5 rounded">
              {task.project_name}
            </span>
          )}
          {task.subtask_count > 0 && (
            <button
              onClick={handleSubtaskBadgeClick}
              className={cn(
                "text-caption shrink-0 flex items-center gap-0.5 cursor-pointer rounded px-1 py-0.5 transition-colors",
                expandedTaskId === task.id
                  ? "text-brand-400 bg-brand-500/10"
                  : "text-muted hover:text-brand-400 hover:bg-brand-500/10"
              )}
              title="Toggle subtasks"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12" />
              </svg>
              {task.subtask_done_count}/{task.subtask_count}
            </button>
          )}
        </div>
        {task.tags && task.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: tag.color + "20", color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-caption">+{task.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="w-20 text-center hidden sm:block" onClick={() => onTaskClick?.(task)}>
        <Badge variant={priority.variant} size="sm">{priority.label}</Badge>
      </div>

      {/* Status */}
      <div className="w-24 text-center hidden md:block" onClick={() => onTaskClick?.(task)}>
        <span className={cn("text-caption font-medium", task.status === "done" && "text-success!")}>
          {statusLabels[task.status]}
        </span>
      </div>

      {/* Due date */}
      <div className="w-28 text-right hidden lg:block" onClick={() => onTaskClick?.(task)}>
        {task.due_date && (
          <span className={cn("text-caption", isOverdue && "text-danger! font-medium")}>
            {formatDate(task.due_date)}
          </span>
        )}
      </div>

      {/* Mark for later */}
      {showDeferButton && task.status !== "done" ? (
        <button
          onClick={(e) => { e.stopPropagation(); onDefer?.(task.id, !task.deferred); }}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded transition-all shrink-0",
            task.deferred
              ? "text-amber-400 hover:bg-amber-500/10"
              : "text-muted opacity-30 group-hover:opacity-100 hover:text-amber-400 hover:bg-amber-500/10"
          )}
          title={task.deferred ? "Move back to active" : "Park for later"}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      ) : (
        <span className="w-7 shrink-0" />
      )}

      {/* Archive / Unarchive */}
      <button
        onClick={(e) => { e.stopPropagation(); onArchive?.(task.id, !task.is_archived); }}
        title={task.is_archived ? "Unarchive task" : "Archive task"}
        className={cn(
          "w-7 h-7 items-center justify-center rounded transition-all shrink-0",
          "hidden sm:flex",
          task.is_archived
            ? "text-brand-400 opacity-100 hover:bg-brand-500/10"
            : "text-muted opacity-0 group-hover:opacity-100 hover:text-brand-400 hover:bg-brand-500/10"
        )}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.375c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </button>

      {/* Delete — two-click confirm */}
      <button
        onClick={handleDeleteClick}
        title={confirmingDelete ? "Click again to confirm deletion" : "Delete task"}
        className={cn(
          "w-7 h-7 items-center justify-center rounded transition-all shrink-0",
          "hidden sm:flex",
          confirmingDelete
            ? "text-red-400 bg-red-500/15 opacity-100"
            : "text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10"
        )}
      >
        {confirmingDelete ? (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        )}
      </button>
    </>
  );
}

// ── Sortable row: drag handle → checkbox → completion → content ──
function SortableTaskRow({ task, isSelected, onSelect, onTaskClick, onDefer, onDelete, onArchive, onToggleComplete, expandedTaskId, onToggleExpand, onSubtaskCountChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const isOverdue = task.due_date && toLocalDateStr(task.due_date) < toLocalDateStr() && task.status !== "done";

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div
        className={cn(
          "group relative flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer",
          isSelected && "bg-brand-500/8",
          isDragging && "opacity-50 bg-surface-tertiary z-50 shadow-lg rounded-lg"
        )}
      >
        {/* Overdue accent */}
        {isOverdue && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-danger" />
        )}
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="hidden sm:flex cursor-grab active:cursor-grabbing text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 touch-none"
        >
          <GripIcon />
        </button>
        {/* Selection checkbox */}
        <Checkbox checked={isSelected} onChange={() => onSelect?.(task.id)} />
        {/* Content */}
        <TaskRowContent
          task={task}
          onTaskClick={onTaskClick}
          onDefer={onDefer}
          onDelete={onDelete}
          onArchive={onArchive}
          onToggleComplete={onToggleComplete}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
        />
      </div>
      {/* Inline subtasks */}
      {task.subtask_count > 0 && (
        <InlineSubtasks
          taskId={task.id}
          expanded={expandedTaskId === task.id}
          onSubtaskCountChange={onSubtaskCountChange}
        />
      )}
    </div>
  );
}

// ── Plain row (completed tasks) ───────────────────────────────
function PlainTaskRow({ task, isSelected, onSelect, onTaskClick, onDefer, onDelete, onArchive, onToggleComplete, expandedTaskId, onToggleExpand, onSubtaskCountChange }) {
  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer",
          isSelected && "bg-brand-500/8"
        )}
      >
        {/* Spacer aligns with drag handle column */}
        <span className="hidden sm:block w-4 shrink-0" />
        <Checkbox checked={isSelected} onChange={() => onSelect?.(task.id)} />
        <TaskRowContent
          task={task}
          onTaskClick={onTaskClick}
          onDefer={onDefer}
          onDelete={onDelete}
          onArchive={onArchive}
          onToggleComplete={onToggleComplete}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
        />
      </div>
      {task.subtask_count > 0 && (
        <InlineSubtasks
          taskId={task.id}
          expanded={expandedTaskId === task.id}
          onSubtaskCountChange={onSubtaskCountChange}
        />
      )}
    </div>
  );
}

// ── Later section ─────────────────────────────────────────────
export function LaterTaskList({ tasks, onTaskClick, onDefer, onDelete, onArchive, onToggleComplete, expandedTaskId, onToggleExpand, onSubtaskCountChange }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card mt-4">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-surface-tertiary/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={cn("h-3.5 w-3.5 text-muted transition-transform duration-150", open && "rotate-90")}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-body-sm font-medium">Parked for later</span>
        <span className="badge bg-warning-light text-warning text-[0.625rem] px-2 py-0.5 ml-0.5">
          {tasks.length}
        </span>
        <span className="hidden sm:inline text-caption text-muted ml-auto">
          Tasks you can get to when ready
        </span>
      </button>

      {open && (
        <div className="divide-y divide-border-light border-t border-border">
          {tasks.map((task) => (
            <div key={task.id}>
              <div className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer">
                {/* Spacers */}
                <span className="hidden sm:block w-4 shrink-0" />
                <span className="hidden sm:block w-4 shrink-0" />
                <TaskRowContent
                  task={task}
                  onTaskClick={onTaskClick}
                  onDefer={onDefer}
                  onDelete={onDelete}
                  onArchive={onArchive}
                  onToggleComplete={onToggleComplete}
                  showDeferButton
                  expandedTaskId={expandedTaskId}
                  onToggleExpand={onToggleExpand}
                />
              </div>
              {task.subtask_count > 0 && (
                <InlineSubtasks
                  taskId={task.id}
                  expanded={expandedTaskId === task.id}
                  onSubtaskCountChange={onSubtaskCountChange}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Archived section ──────────────────────────────────────────
export function ArchivedTaskList({ tasks, onTaskClick, onArchive, onDelete, onToggleComplete, expandedTaskId, onToggleExpand, onSubtaskCountChange }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card mt-4">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-surface-tertiary/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={cn("h-3.5 w-3.5 text-muted transition-transform duration-150", open && "rotate-90")}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <svg className="h-4 w-4 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.375c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <span className="text-body-sm font-medium">Archived</span>
        <span className="badge bg-surface-tertiary text-muted text-[0.625rem] px-2 py-0.5 ml-0.5">
          {tasks.length}
        </span>
        <span className="hidden sm:inline text-caption text-muted ml-auto">
          Click the archive icon to restore a task
        </span>
      </button>

      {open && (
        <div className="divide-y divide-border-light border-t border-border opacity-70">
          {tasks.map((task) => (
            <div key={task.id}>
              <div className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer">
                <span className="hidden sm:block w-4 shrink-0" />
                <span className="hidden sm:block w-4 shrink-0" />
                <TaskRowContent
                  task={task}
                  onTaskClick={onTaskClick}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onToggleComplete={onToggleComplete}
                  showDeferButton={false}
                  expandedTaskId={expandedTaskId}
                  onToggleExpand={onToggleExpand}
                />
              </div>
              {task.subtask_count > 0 && (
                <InlineSubtasks
                  taskId={task.id}
                  expanded={expandedTaskId === task.id}
                  onSubtaskCountChange={onSubtaskCountChange}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main list (active + completed) ────────────────────────────
export default function TaskListView({ tasks, onTaskClick, onBulkAction, onDelete, onDefer, onArchive, onDragEnd, onToggleComplete, onSubtaskCountChange }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const activeTasks    = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const handleBulkAction = (action) => {
    onBulkAction?.(action, Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleToggleExpand = useCallback((taskId) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const rowProps = (task) => ({
    task,
    isSelected: selectedIds.has(task.id),
    onSelect: toggleSelect,
    onTaskClick,
    onDefer,
    onDelete,
    onArchive,
    onToggleComplete,
    expandedTaskId,
    onToggleExpand: handleToggleExpand,
    onSubtaskCountChange,
  });

  return (
    <div>
      {/* ── Table header OR bulk action bar ── */}
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-border bg-brand-500/8 animate-fade-in">
          <span className="hidden sm:block w-4 shrink-0" />
          <Checkbox
            checked={selectedIds.size === tasks.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < tasks.length}
            onChange={toggleAll}
          />
          <span className="flex-1 text-body-sm text-brand-300 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => handleBulkAction("complete")}>
              Mark Done
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleBulkAction("archive")}>
              Archive
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleBulkAction("delete")}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-border text-overline bg-white/2">
          <span className="hidden sm:block w-4 shrink-0" />
          <Checkbox
            checked={tasks.length > 0 && selectedIds.size === tasks.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < tasks.length}
            onChange={toggleAll}
          />
          <span className="w-5 shrink-0" />
          <span className="flex-1">Task</span>
          <span className="w-20 text-center hidden sm:block">Priority</span>
          <span className="w-24 text-center hidden md:block">Status</span>
          <span className="w-28 text-right hidden lg:block">Due Date</span>
          <span className="w-7 shrink-0" />
          <span className="hidden sm:block w-7 shrink-0" />
          <span className="hidden sm:block w-7 shrink-0" />
        </div>
      )}

      {/* ── Active tasks (draggable) ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={activeTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border-light">
            {activeTasks.map((task) => (
              <SortableTaskRow key={task.id} {...rowProps(task)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Completed section ── */}
      {completedTasks.length > 0 && (
        <>
          <button
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-tertiary/30 transition-colors border-t border-border"
            onClick={() => setShowCompleted((v) => !v)}
          >
            <svg
              className={cn("h-3.5 w-3.5 text-muted transition-transform duration-150", showCompleted && "rotate-90")}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-body-sm text-muted font-medium">Completed</span>
            <span className="badge bg-success-light text-success text-[0.625rem] px-2 py-0.5 ml-0.5">
              {completedTasks.length}
            </span>
          </button>
          {showCompleted && (
            <div className="divide-y divide-border-light opacity-60">
              {completedTasks.map((task) => (
                <PlainTaskRow key={task.id} {...rowProps(task)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
