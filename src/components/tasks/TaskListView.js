"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronRight,
  Clock3,
  GripVertical,
  ListTree,
  Lock,
  Repeat2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { cn, toLocalDateStr } from "@/lib/utils";
import { Button, Checkbox, Spinner } from "@/components/ui";
import { taskService } from "@/services/api";
import { useJustCompleted } from "@/hooks/useJustCompleted";
import { PriorityIcon, ProjectChip, StatusIcon, TagChip, statusMeta } from "./TaskGlyphs";

function shortDate(value) {
  const key = toLocalDateStr(value);
  const today = toLocalDateStr();
  const tomorrow = toLocalDateStr(new Date(Date.now() + 86400000));
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  const date = new Date(`${key}T00:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "2-digit" }) });
}

function canEditTask(task, currentUserId) {
  return task.user_id === currentUserId || task.is_project_owner;
}

function canDeleteTask(task, currentUserId) {
  return task.project_id ? Boolean(task.is_project_owner) : task.user_id === currentUserId;
}

// ── Completion toggle ─────────────────────────────────────────
function CompletionToggle({ isDone, onToggle, disabled = false }) {
  const justDone = useJustCompleted(isDone);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        disabled ? "cursor-default opacity-50" : "cursor-pointer",
        isDone ? "border-brand-500 bg-brand-500 text-white" : "border-border-strong hover:border-heading",
        justDone && "animate-pop"
      )}
      aria-label={isDone ? "Mark as to do" : "Mark as done"}
      title={isDone ? "Mark as to do" : "Mark as done"}
    >
      {isDone && <Check className={cn("h-2.5 w-2.5", justDone && "animate-check")} strokeWidth={3.5} />}
    </button>
  );
}

// ── Inline subtasks ───────────────────────────────────────────
function InlineSubtasks({ task, expanded, onSubtaskCountChange, currentUserId }) {
  const taskId = task.id;
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (expanded && !loaded) {
      taskService
        .get(taskId)
        .then((data) => {
          setSubtasks(data.task?.subtasks || []);
          setLoaded(true);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [expanded, taskId, loaded]);

  const handleToggle = async (subtask) => {
    const canEdit = subtask.user_id === currentUserId || task.is_project_owner;
    if (!canEdit) return;
    const newStatus = subtask.status === "done" ? "todo" : "done";
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, status: newStatus } : s)));
    const newDoneCount = subtasks.filter((s) => (s.id === subtask.id ? newStatus === "done" : s.status === "done")).length;
    onSubtaskCountChange?.(taskId, newDoneCount);
    try {
      await taskService.updateSubtask(taskId, subtask.id, { status: newStatus });
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, status: subtask.status } : s)));
    }
  };

  if (!expanded) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 pl-[4.25rem] text-xs text-muted">
        <Spinner size="sm" /> Loading subtasks
      </div>
    );
  }

  if (subtasks.length === 0) return null;

  return (
    <div className="pb-1.5 pl-[3.75rem] pr-4">
      {subtasks.map((subtask) => {
        const canEdit = subtask.user_id === currentUserId || task.is_project_owner;
        const done = subtask.status === "done";
        return (
          <div key={subtask.id} className="relative flex items-center gap-2.5 py-1 pl-4">
            <span className="absolute bottom-0 left-0 top-0 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleToggle(subtask)}
              disabled={!canEdit}
              className={cn(
                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] transition-colors",
                canEdit ? "cursor-pointer" : "cursor-default opacity-50",
                done ? "border-brand-500 bg-brand-500 text-white" : "border-border-strong hover:border-heading"
              )}
              aria-label={done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
            >
              {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
            </button>
            <span className={cn("text-sm", done ? "text-muted line-through" : "text-body")}>{subtask.title}</span>
          </div>
        );
      })}
    </div>
  );
}

// Row actions live on wider screens; phones open the task for the same controls.
function RowAction({ onClick, label, active = false, danger = false, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors sm:flex [&_svg]:h-3.5 [&_svg]:w-3.5",
        active
          ? danger
            ? "bg-danger-light text-danger"
            : "text-heading"
          : "text-muted hover:bg-surface-tertiary hover:text-heading",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Row ───────────────────────────────────────────────────────
function TaskRow({
  task,
  isSelected = false,
  selectionActive = false,
  onSelect,
  onTaskClick,
  onDefer,
  onDelete,
  onArchive,
  onToggleComplete,
  showDeferButton = true,
  expandedTaskId,
  onToggleExpand,
  onSubtaskCountChange,
  currentUserId,
  dragHandle,
  selectable = true,
}) {
  const isDone = task.status === "done";
  const isOverdue = task.due_date && toLocalDateStr(task.due_date) < toLocalDateStr() && !isDone;
  const canEdit = canEditTask(task, currentUserId);
  const canDelete = canDeleteTask(task, currentUserId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(deleteTimerRef.current), []);

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    if (confirmingDelete) {
      clearTimeout(deleteTimerRef.current);
      setConfirmingDelete(false);
      onDelete?.(task.id);
    } else {
      setConfirmingDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  const expanded = expandedTaskId === task.id;

  return (
    <>
      <div
        className={cn(
          "group relative flex min-h-11 cursor-pointer items-center gap-2.5 pl-2 pr-2 transition-colors sm:pr-3",
          isSelected ? "bg-brand-50" : "hover:bg-surface-secondary"
        )}
        onClick={() => onTaskClick?.(task)}
      >
        <span className="hidden w-4 shrink-0 sm:flex">{dragHandle}</span>
        {selectable ? (
          <span
            className={cn(
              "hidden shrink-0 transition-opacity sm:flex",
              isSelected || selectionActive ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              disabled={!canEdit && !canDelete}
              onChange={() => onSelect?.(task.id)}
              aria-label={`Select ${task.title}`}
            />
          </span>
        ) : (
          <span className="hidden w-4 shrink-0 sm:block" />
        )}
        <CompletionToggle isDone={isDone} onToggle={() => onToggleComplete?.(task.id)} disabled={!canEdit} />

        <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5">
          <span className={cn("truncate text-sm", isDone ? "text-muted line-through decoration-border-strong" : "text-heading")}>
            {task.title}
          </span>
          {task.subtask_count > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand?.(task.id);
              }}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 font-mono text-2xs tabular-nums transition-colors",
                expanded ? "bg-surface-tertiary text-heading" : "text-muted hover:bg-surface-tertiary hover:text-heading"
              )}
              aria-expanded={expanded}
              title="Show subtasks"
            >
              <ListTree className="h-3 w-3" />
              {task.subtask_done_count || 0}/{task.subtask_count}
            </button>
          )}
          {task.recurrence_rule && (
            <Repeat2 className="h-3 w-3 shrink-0 text-muted" aria-label={`Repeats ${task.recurrence_rule}`} />
          )}
          {task.blocking_count > 0 && (
            <Lock className="h-3 w-3 shrink-0 text-warning" aria-label={`Blocked by ${task.blocking_count} task(s)`} />
          )}
          {task.tags?.length > 0 && (
            <span className="hidden min-w-0 items-center gap-1 xl:flex">
              {task.tags.slice(0, 2).map((tag) => <TagChip key={tag.id} tag={tag} />)}
              {task.tags.length > 2 && <span className="text-2xs text-muted">+{task.tags.length - 2}</span>}
            </span>
          )}
        </div>

        <span className="hidden w-36 lg:block">
          {task.project_name ? (
            <ProjectChip name={task.project_name} color={task.project_color} logoFileId={task.project_logo_file_id} className="max-w-full" />
          ) : (
            <span className="text-xs text-placeholder">Personal</span>
          )}
        </span>

        <span className="hidden w-24 items-center gap-1.5 text-xs text-muted md:flex">
          <StatusIcon status={task.status} />
          {statusMeta[task.status]?.label}
        </span>

        <span className="hidden w-5 justify-center sm:flex" title={`${task.priority || "medium"} priority`}>
          <PriorityIcon priority={task.priority} />
        </span>

        <span
          className={cn(
            "w-[4.5rem] shrink-0 text-right font-mono text-xs tabular-nums",
            isOverdue ? "text-danger" : "text-muted"
          )}
        >
          {task.due_date ? shortDate(task.due_date) : ""}
        </span>

        <span className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
          {showDeferButton && !isDone && canEdit ? (
            <RowAction
              onClick={() => onDefer?.(task.id, !task.deferred)}
              label={task.deferred ? "Move back to active" : "Park for later"}
              active={task.deferred}
              className={task.deferred ? "" : "sm:opacity-0 sm:group-hover:opacity-100"}
            >
              <Clock3 />
            </RowAction>
          ) : (
            <span className="hidden w-7 sm:block" />
          )}
          {canEdit ? (
            <RowAction
              onClick={() => onArchive?.(task.id, !task.is_archived)}
              label={task.is_archived ? "Unarchive task" : "Archive task"}
              active={task.is_archived}
              className={cn(!task.is_archived && "sm:opacity-0 sm:group-hover:opacity-100")}
            >
              {task.is_archived ? <ArchiveRestore /> : <Archive />}
            </RowAction>
          ) : (
            <span className="hidden w-7 sm:block" />
          )}
          {canDelete ? (
            <RowAction
              onClick={handleDeleteClick}
              label={confirmingDelete ? "Click again to delete" : "Delete task"}
              active={confirmingDelete}
              danger
              className={cn(!confirmingDelete && "sm:opacity-0 sm:group-hover:opacity-100")}
            >
              {confirmingDelete ? <TriangleAlert /> : <Trash2 />}
            </RowAction>
          ) : (
            <span className="hidden w-7 sm:block" />
          )}
        </span>
      </div>
      {task.subtask_count > 0 && (
        <InlineSubtasks
          task={task}
          expanded={expanded}
          onSubtaskCountChange={onSubtaskCountChange}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}

function SortableTaskRow(props) {
  const canEdit = canEditTask(props.task, props.currentUserId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    disabled: !canEdit,
  });

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      disabled={!canEdit}
      aria-label="Drag to reorder"
      className={cn(
        "flex touch-none text-placeholder",
        canEdit ? "cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing" : "cursor-default opacity-0"
      )}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 rounded-lg bg-surface shadow-md ring-1 ring-border")}
    >
      <TaskRow {...props} dragHandle={handle} />
    </div>
  );
}

function CollapsibleGroup({ title, count, icon, hint, children, defaultOpen = true, dimmed = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-8">
      <button
        type="button"
        className="mb-2 flex w-full cursor-pointer items-center gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-90")} />
        {icon}
        <span className="text-sm font-semibold text-heading">{title}</span>
        <span className="font-mono text-xs tabular-nums text-muted">{count}</span>
        {hint && <span className="ml-auto hidden text-xs text-muted sm:inline">{hint}</span>}
      </button>
      {open && <div className={cn("card divide-y divide-border overflow-hidden", dimmed && "opacity-75")}>{children}</div>}
    </section>
  );
}

// ── Later section ─────────────────────────────────────────────
export function LaterTaskList({ tasks, currentUserId, ...handlers }) {
  return (
    <CollapsibleGroup
      title="Parked for later"
      count={tasks.length}
      icon={<Clock3 className="h-3.5 w-3.5 text-muted" />}
      hint="Out of the way until you're ready"
    >
      {tasks.map((task) => (
        <div key={task.id}>
          <TaskRow task={task} currentUserId={currentUserId} selectable={false} showDeferButton {...handlers} />
        </div>
      ))}
    </CollapsibleGroup>
  );
}

// ── Archived section ──────────────────────────────────────────
export function ArchivedTaskList({ tasks, currentUserId, ...handlers }) {
  return (
    <CollapsibleGroup
      title="Archived"
      count={tasks.length}
      icon={<Archive className="h-3.5 w-3.5 text-muted" />}
      hint="Use the archive button to restore"
      dimmed
    >
      {tasks.map((task) => (
        <div key={task.id}>
          <TaskRow task={task} currentUserId={currentUserId} selectable={false} showDeferButton={false} {...handlers} />
        </div>
      ))}
    </CollapsibleGroup>
  );
}

// ── Main list (active + completed) ────────────────────────────
export default function TaskListView({
  tasks,
  onTaskClick,
  onBulkAction,
  onDelete,
  onDefer,
  onArchive,
  onDragEnd,
  onToggleComplete,
  onSubtaskCountChange,
  currentUserId,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");
  const selectableTasks = tasks.filter((task) => canEditTask(task, currentUserId));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === selectableTasks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableTasks.map((t) => t.id)));
  };

  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
  const editableSelectedIds = selectedTasks.filter((task) => canEditTask(task, currentUserId)).map((task) => task.id);
  const deletableSelectedIds = selectedTasks.filter((task) => canDeleteTask(task, currentUserId)).map((task) => task.id);

  const handleBulkAction = (action) => {
    const ids = action === "delete" ? deletableSelectedIds : editableSelectedIds;
    if (ids.length === 0) return;
    onBulkAction?.(action, ids);
    setSelectedIds(new Set());
  };

  const handleToggleExpand = useCallback((taskId) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const rowProps = (task) => ({
    task,
    isSelected: selectedIds.has(task.id),
    selectionActive: selectedIds.size > 0,
    onSelect: toggleSelect,
    onTaskClick,
    onDefer,
    onDelete,
    onArchive,
    onToggleComplete,
    expandedTaskId,
    onToggleExpand: handleToggleExpand,
    onSubtaskCountChange,
    currentUserId,
  });

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex animate-fade-in items-center gap-2.5 border-b border-border bg-surface/95 py-2 pl-8 pr-3 backdrop-blur">
          <Checkbox
            checked={selectedIds.size === selectableTasks.length}
            indeterminate={selectedIds.size < selectableTasks.length}
            onChange={toggleAll}
            aria-label="Select all tasks"
          />
          <span className="flex-1 text-sm font-medium text-heading">
            {selectedIds.size} selected
          </span>
          <Button size="sm" variant="secondary" onClick={() => handleBulkAction("complete")}>Mark done</Button>
          <Button size="sm" variant="secondary" onClick={() => handleBulkAction("archive")} disabled={editableSelectedIds.length === 0}>
            Archive
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleBulkAction("delete")} disabled={deletableSelectedIds.length === 0}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={activeTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border">
            {activeTasks.map((task) => (
              <SortableTaskRow key={task.id} {...rowProps(task)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {completedTasks.length > 0 && (
        <>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 border-t border-border bg-surface-secondary/70 py-2 pl-8 pr-4 text-left transition-colors hover:bg-surface-secondary"
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted transition-transform", showCompleted && "rotate-90")} />
            <span className="text-xs font-medium text-muted">Completed</span>
            <span className="font-mono text-xs tabular-nums text-muted">{completedTasks.length}</span>
          </button>
          {showCompleted && (
            <div className="divide-y divide-border border-t border-border">
              {completedTasks.map((task) => (
                <div key={task.id}>
                  <TaskRow {...rowProps(task)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
