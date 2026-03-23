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
import { cn } from "@/lib/utils";
import TaskCard from "./TaskCard";

const columns = [
  { key: "todo", label: "To Do", color: "bg-neutral-400" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "on_hold", label: "On Hold", color: "bg-amber-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
];

function DraggableCard({ task, onClick }) {
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
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

function DroppableColumn({ column, tasks, onClick, isOver }) {
  const { setNodeRef } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-72 bg-surface-secondary/80 backdrop-blur-sm rounded-xl p-3 transition-all duration-200 border border-border",
        isOver && "ring-2 ring-brand-500/30 bg-brand-500/8 border-brand-500/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn("w-2.5 h-2.5 rounded-full", column.color)} />
        <h3 className="text-body-sm text-heading! font-semibold">{column.label}</h3>
        <span className="text-caption ml-auto bg-surface-tertiary px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2.5 min-h-25">
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} onClick={onClick} />
        ))}

        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-8 text-caption text-muted border-2 border-dashed border-border-light rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks, onTaskClick, onStatusChange }) {
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
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((column) => (
          <DroppableColumn
            key={column.key}
            column={column}
            tasks={tasksByStatus[column.key]}
            onClick={onTaskClick}
            isOver={overColumnKey === column.key}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72 opacity-90 rotate-2">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
