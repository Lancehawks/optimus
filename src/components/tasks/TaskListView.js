"use client";

import { useState, useRef, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import { Badge, Checkbox, Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

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

// ── Shared row content ────────────────────────────────────────
function TaskRowContent({ task, onTaskClick, onDefer, onDelete, showDeferButton = true }) {
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

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

  return (
    <>
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
            <span className="text-caption shrink-0 flex items-center gap-0.5 text-muted">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12" />
              </svg>
              {task.subtask_done_count}/{task.subtask_count}
            </span>
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

      {/* Mark for later — dimly visible always, bright on hover, amber when active */}
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

      {/* Delete — two-click confirm, hidden on mobile (delete via task modal) */}
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

// ── Sortable row: drag handle → checkbox → content ────────────
function SortableTaskRow({ task, isSelected, onSelect, onTaskClick, onDefer, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer",
        isSelected && "bg-brand-500/8",
        isDragging && "opacity-50 bg-surface-tertiary z-50 shadow-lg rounded-lg"
      )}
    >
      {/* Overdue accent — 2px left border strip */}
      {isOverdue && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-danger" />
      )}
      {/* Drag handle — hidden on mobile (touch DnD not needed) */}
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="hidden sm:flex cursor-grab active:cursor-grabbing text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 touch-none"
      >
        <GripIcon />
      </button>
      {/* Checkbox */}
      <Checkbox checked={isSelected} onChange={() => onSelect?.(task.id)} />
      {/* Content */}
      <TaskRowContent task={task} onTaskClick={onTaskClick} onDefer={onDefer} onDelete={onDelete} />
    </div>
  );
}

// ── Plain row (completed tasks) ───────────────────────────────
function PlainTaskRow({ task, isSelected, onSelect, onTaskClick, onDefer, onDelete }) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer",
        isSelected && "bg-brand-500/8"
      )}
    >
      {/* Spacer aligns with drag handle column — hidden on mobile */}
      <span className="hidden sm:block w-4 shrink-0" />
      <Checkbox checked={isSelected} onChange={() => onSelect?.(task.id)} />
      <TaskRowContent task={task} onTaskClick={onTaskClick} onDefer={onDefer} onDelete={onDelete} />
    </div>
  );
}

// ── Later section ─────────────────────────────────────────────
export function LaterTaskList({ tasks, onTaskClick, onDefer, onDelete }) {
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
            <div
              key={task.id}
              className="group flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer"
            >
              {/* Spacers align with main list columns — hidden on mobile */}
              <span className="hidden sm:block w-4 shrink-0" />
              <span className="hidden sm:block w-4 shrink-0" />
              <TaskRowContent
                task={task}
                onTaskClick={onTaskClick}
                onDefer={onDefer}
                onDelete={onDelete}
                showDeferButton
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main list (active + completed) ────────────────────────────
export default function TaskListView({ tasks, onTaskClick, onBulkAction, onDelete, onDefer, onDragEnd }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

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

  const rowProps = (task) => ({
    task,
    isSelected: selectedIds.has(task.id),
    onSelect: toggleSelect,
    onTaskClick,
    onDefer,
    onDelete,
  });

  return (
    <div>
      {/* ── Table header OR bulk action bar (same position, no layout shift) ── */}
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 border-b border-border bg-brand-500/8 animate-fade-in">
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
            <Button size="sm" variant="danger" onClick={() => handleBulkAction("delete")}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 border-b border-border text-overline bg-white/2">
          <span className="hidden sm:block w-4 shrink-0" />
          <Checkbox
            checked={tasks.length > 0 && selectedIds.size === tasks.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < tasks.length}
            onChange={toggleAll}
          />
          <span className="flex-1">Task</span>
          <span className="w-20 text-center hidden sm:block">Priority</span>
          <span className="w-24 text-center hidden md:block">Status</span>
          <span className="w-28 text-right hidden lg:block">Due Date</span>
          <span className="w-7 shrink-0" />
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
