"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { cn, toLocalDateStr } from "@/lib/utils";
import TaskCard from "./TaskCard";

const columns = [
  {
    key: "todo",
    label: "To Do",
    hint: "Ready to start",
    dot: "bg-neutral-400",
    accent: "bg-neutral-400",
    pill: "border-neutral-500/25 bg-neutral-500/10 text-neutral-200",
    surface: "bg-surface-secondary/85",
  },
  {
    key: "in_progress",
    label: "In Progress",
    hint: "Being worked on",
    dot: "bg-blue-500",
    accent: "bg-blue-500",
    pill: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    surface: "bg-blue-500/5",
  },
  {
    key: "on_hold",
    label: "On Hold",
    hint: "Needs update",
    dot: "bg-amber-500",
    accent: "bg-amber-500",
    pill: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    surface: "bg-amber-500/5",
  },
  {
    key: "done",
    label: "Done",
    hint: "Completed",
    dot: "bg-green-500",
    accent: "bg-green-500",
    pill: "border-green-500/25 bg-green-500/10 text-green-300",
    surface: "bg-green-500/5",
  },
];

function isOverdueTask(task) {
  return task.due_date && task.status !== "done" && toLocalDateStr(task.due_date) < toLocalDateStr();
}

function DraggableCard({ task, onClick, currentUserId }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-30")}
    >
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} currentUserId={currentUserId} />
    </div>
  );
}

function ColumnHeader({ column, tasks }) {
  const sharedCount = tasks.filter((task) => task.project_name).length;
  const overdueCount = tasks.filter(isOverdueTask).length;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className={cn("inline-flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5", column.pill)}>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", column.dot)} />
          <span className="truncate text-xs font-semibold">{column.label}</span>
        </div>
        <span className="rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-heading!">
          {tasks.length}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <span className="text-caption text-muted">{column.hint}</span>
        {(sharedCount > 0 || overdueCount > 0) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {sharedCount > 0 && (
              <span className="rounded-full bg-info-light px-1.5 py-px text-[0.625rem] font-medium leading-4 text-blue-400">
                {sharedCount} shared
              </span>
            )}
            {overdueCount > 0 && (
              <span className="rounded-full bg-danger-light px-1.5 py-px text-[0.625rem] font-medium leading-4 text-danger">
                {overdueCount} late
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DroppableColumn({ column, tasks, onClick, isOver, currentUserId }) {
  const { setNodeRef } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative shrink-0 w-[18.5rem] rounded-lg border border-border p-3 transition-all duration-200",
        column.surface,
        isOver && "ring-2 ring-brand-500/30 bg-brand-500/8 border-brand-500/30"
      )}
    >
      <span className={cn("absolute left-3 right-3 top-0 h-0.5 rounded-full", column.accent)} />
      <ColumnHeader column={column} tasks={tasks} />

      <div className="space-y-2.5 min-h-[22rem]">
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            onClick={onClick}
            currentUserId={currentUserId}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-light bg-surface/30 px-4 py-6 text-center">
            <span className={cn("h-2.5 w-2.5 rounded-full", column.dot)} />
            <span className="text-caption text-muted">Drop tasks here</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardMetric({ label, value, tone = "neutral" }) {
  const toneClasses = {
    neutral: "bg-surface-tertiary text-muted",
    brand: "bg-brand-500/10 text-brand-300",
    danger: "bg-danger-light text-danger",
    info: "bg-info-light text-blue-400",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption", toneClasses[tone])}>
      <strong className="text-heading!">{value}</strong>
      {label}
    </span>
  );
}

export default function KanbanBoard({ tasks, onTaskClick, onStatusChange, currentUserId }) {
  const [activeTask, setActiveTask] = useState(null);
  const [overColumnKey, setOverColumnKey] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const tasksByStatus = columns.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {});
  const activeCount = tasks.filter((task) => task.status !== "done").length;
  const sharedCount = tasks.filter((task) => task.project_name).length;
  const overdueCount = tasks.filter(isOverdueTask).length;

  const handleDragStart = useCallback((event) => {
    const task = event.active.data.current?.task;
    setActiveTask(task || null);
  }, []);

  const handleDragOver = useCallback((event) => {
    const overId = event.over?.id;
    if (overId && columns.some((c) => c.key === overId)) {
      setOverColumnKey(overId);
    } else {
      setOverColumnKey(null);
    }
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnKey(null);

    if (!over) return;

    const taskId = active.id;
    let targetColumn = null;

    // Check if dropped over a column directly
    if (columns.some((c) => c.key === over.id)) {
      targetColumn = over.id;
    }

    if (targetColumn) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== targetColumn) {
        onStatusChange?.(taskId, targetColumn);
      }
    }
  }, [tasks, onStatusChange]);

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    setOverColumnKey(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-light bg-surface-secondary/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500/10 text-brand-300">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.125 4.5h15.75c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 18.375V5.625C3 5.004 3.504 4.5 4.125 4.5z" />
              </svg>
            </span>
            <div>
              <p className="text-body-sm font-semibold text-heading!">Kanban board</p>
              <p className="text-caption text-muted">Personal tasks stay private. Shared tasks show their project.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <BoardMetric label="active" value={activeCount} tone="brand" />
            {sharedCount > 0 && <BoardMetric label="shared" value={sharedCount} tone="info" />}
            {overdueCount > 0 && <BoardMetric label="late" value={overdueCount} tone="danger" />}
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {columns.map((column) => (
            <DroppableColumn
              key={column.key}
              column={column}
              tasks={tasksByStatus[column.key]}
              onClick={onTaskClick}
              isOver={overColumnKey === column.key}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[18.5rem] opacity-90 rotate-2">
            <TaskCard task={activeTask} currentUserId={currentUserId} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
