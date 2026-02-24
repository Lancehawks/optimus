"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import TaskCard from "./TaskCard";

const columns = [
  { key: "todo", label: "To Do", color: "bg-neutral-400" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "on_hold", label: "On Hold", color: "bg-amber-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
];

export default function KanbanBoard({ tasks, onTaskClick, onStatusChange }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const tasksByStatus = columns.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {});

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, columnKey) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId && onStatusChange) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== columnKey) {
        onStatusChange(taskId, columnKey);
      }
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
      {columns.map((column) => (
        <div
          key={column.key}
          className={cn(
            "shrink-0 w-72 bg-surface-secondary/80 backdrop-blur-sm rounded-xl p-3 transition-all duration-200 border border-border",
            dragOverColumn === column.key && "ring-2 ring-brand-500/30 bg-brand-500/8 border-brand-500/30"
          )}
          onDragOver={(e) => handleDragOver(e, column.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.key)}
        >
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className={cn("w-2.5 h-2.5 rounded-full", column.color)} />
            <h3 className="text-body-sm text-heading! font-semibold">{column.label}</h3>
            <span className="text-caption ml-auto bg-surface-tertiary px-2 py-0.5 rounded-full">
              {tasksByStatus[column.key].length}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-2.5 min-h-25">
            {tasksByStatus[column.key].map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragEnd={handleDragEnd}
              >
                <TaskCard
                  task={task}
                  onClick={onTaskClick}
                  isDragging={draggedTaskId === task.id}
                />
              </div>
            ))}

            {tasksByStatus[column.key].length === 0 && (
              <div className="flex items-center justify-center py-8 text-caption text-muted border-2 border-dashed border-border-light rounded-lg">
                Drop tasks here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
