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
import { StatusIcon } from "./TaskGlyphs";

const columns = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "on_hold", label: "On hold" },
  { key: "done", label: "Done" },
];

function isOverdueTask(task) {
  return task.due_date && task.status !== "done" && toLocalDateStr(task.due_date) < toLocalDateStr();
}

function DraggableCard({ task, onClick, currentUserId }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-30")}>
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} currentUserId={currentUserId} />
    </div>
  );
}

function DroppableColumn({ column, tasks, onClick, isOver, currentUserId }) {
  const { setNodeRef } = useDroppable({ id: column.key });
  const overdueCount = tasks.filter(isOverdueTask).length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[17.5rem] shrink-0 flex-col rounded-xl bg-surface-secondary p-2 ring-1 ring-border transition-colors",
        isOver && "bg-brand-50 ring-brand-200"
      )}
    >
      <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
        <StatusIcon status={column.key} />
        <span className="text-sm font-medium text-heading">{column.label}</span>
        <span className="font-mono text-xs tabular-nums text-muted">{tasks.length}</span>
        {overdueCount > 0 && (
          <span className="ml-auto font-mono text-[0.6875rem] text-danger">{overdueCount} late</span>
        )}
      </div>

      <div className="min-h-[20rem] flex-1 space-y-2">
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} onClick={onClick} currentUserId={currentUserId} />
        ))}
        {tasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border-strong/70 text-xs text-placeholder">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
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
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4 scrollbar-thin">
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

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[17rem] rotate-1 opacity-95">
            <TaskCard task={activeTask} currentUserId={currentUserId} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
