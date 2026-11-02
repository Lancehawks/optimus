"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ArrowLeft, ArrowRight, Flag, GripVertical, Pencil, Play, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, SearchBox, Select, Spinner, useToast } from "@/components/ui";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import { PriorityIcon, ProjectChip, StatusIcon } from "@/components/tasks/TaskGlyphs";
import TaskModal from "@/components/tasks/TaskModal";
import { useTaskSheet } from "@/components/sprints/useTaskSheet";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { sprintService } from "@/services/api";
import { formatSprintRange, sprintTimeStatus } from "@/lib/sprintDates";
import { cn } from "@/lib/utils";

function PlanRow({ task, panel, moveLabel, moveIcon, onMove, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: { task, panel } });

  return (
    <li ref={setNodeRef} className={cn("flex items-center gap-2 py-2 pl-1.5 pr-2", isDragging && "opacity-30")}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${task.title}`}
        className="hidden h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-placeholder hover:text-heading active:cursor-grabbing sm:flex"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <StatusIcon status={task.status} className="ml-1.5 sm:ml-0" />
      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className={cn("block truncate text-sm", task.status === "done" ? "text-muted line-through" : "text-heading")}>{task.title}</span>
        {task.project_name && <ProjectChip name={task.project_name} color={task.project_color} logoFileId={task.project_logo_file_id} className="mt-0.5 max-w-full" />}
      </button>
      <PriorityIcon priority={task.priority} />
      <button
        type="button"
        onClick={() => onMove(task)}
        aria-label={moveLabel}
        title={moveLabel}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-tertiary hover:text-heading"
      >
        {moveIcon}
      </button>
    </li>
  );
}

function PlanPanel({ id, title, meta, controls, isLoading, error, onRetry, emptyText, children, footer }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn("flex min-w-0 flex-col rounded-xl bg-surface ring-1 ring-border transition-colors", isOver && "bg-brand-50 ring-brand-200")}
    >
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-sm font-medium text-heading">{title}</h3>
          {meta && <span className="shrink-0 font-mono text-2xs tabular-nums text-muted">{meta}</span>}
        </div>
        {controls}
      </header>
      <div className="min-h-[16rem] flex-1 overflow-y-auto scrollbar-thin lg:max-h-[34rem]">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : error ? (
          <ErrorState compact className="m-3" title="These tasks couldn't be loaded" description={error.message} onRetry={onRetry} />
        ) : children ? (
          <ul className="divide-y divide-border">{children}</ul>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-muted">{emptyText}</p>
        )}
        {footer}
      </div>
    </section>
  );
}

/** Pulls open tasks from every project into a sprint, by button or by drag. */
export default function SprintPlanner({ openSprints, activeSprint, initialSprintId, today, onEdit, onNew, onStart, onChanged }) {
  const { addToast } = useToast();
  const { projects } = useProjects();
  const sheet = useTaskSheet();
  const [selectedId, setSelectedId] = useState(initialSprintId || activeSprint?.id || null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", project_id: "" });
  const [draggedTask, setDraggedTask] = useState(null);
  const searchTimer = useRef(null);
  const sprint = openSprints.find((candidate) => candidate.id === selectedId) || openSprints[0] || null;
  const sprintId = sprint?.id || "";

  const backlog = useTasks({ ...filters, sprint_id: "none" });
  const planned = useTasks({ sprint_id: sprintId }, { enabled: Boolean(sprintId) });
  const { setTasks: setBacklog, refetch: refetchBacklog } = backlog;
  const { setTasks: setPlanned, refetch: refetchPlanned } = planned;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const handleSearchChange = (event) => {
    const { value } = event.target;
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilters((current) => ({ ...current, search: value })), 300);
  };

  const recoverFrom = useCallback((error) => {
    refetchBacklog();
    refetchPlanned();
    addToast({ message: error.message, type: "error" });
  }, [addToast, refetchBacklog, refetchPlanned]);

  const addToSprint = useCallback(async (task) => {
    setBacklog((current) => current.filter((item) => item.id !== task.id));
    setPlanned((current) => [{ ...task, sprint_id: sprintId }, ...current]);
    try {
      await sprintService.addTasks(sprintId, [task.id]);
      onChanged();
    } catch (error) {
      recoverFrom(error);
    }
  }, [onChanged, recoverFrom, setBacklog, setPlanned, sprintId]);

  const removeFromSprint = useCallback(async (task) => {
    setPlanned((current) => current.filter((item) => item.id !== task.id));
    if (task.status !== "done") {
      setBacklog((current) => [{ ...task, sprint_id: null }, ...current]);
    }
    try {
      await sprintService.removeTasks(sprintId, [task.id]);
      onChanged();
    } catch (error) {
      recoverFrom(error);
    }
  }, [onChanged, recoverFrom, setBacklog, setPlanned, sprintId]);

  const handleDragEnd = ({ active, over }) => {
    setDraggedTask(null);
    const { task, panel } = active.data.current || {};
    if (!task || !over || over.id === panel) return;
    if (over.id === "sprint") addToSprint(task);
    else removeFromSprint(task);
  };

  const handleTaskSaved = () => {
    refetchBacklog();
    refetchPlanned();
    onChanged();
  };

  if (!sprint) {
    return (
      <div className="card">
        <EmptyState
          icon={<Flag />}
          title="Nothing to plan yet"
          description="Create a sprint, then pull tasks into it from any of your projects."
          action={{ children: "New sprint", leftIcon: <Plus />, onClick: onNew }}
        />
      </div>
    );
  }

  const hasFilters = Boolean(filters.search || filters.project_id);
  // Moves update the lists straight away, so count them until a page is missing.
  const backlogCount = backlog.hasMore ? backlog.pagination.filteredCount : backlog.tasks.length;
  const plannedCount = planned.hasMore ? planned.pagination.filteredCount : planned.tasks.length;
  const canStart = sprint.status === "planned" && !activeSprint;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="w-full sm:w-64">
          <Select
            aria-label="Sprint to plan"
            value={sprint.id}
            onChange={(event) => setSelectedId(event.target.value)}
            options={openSprints.map((option) => ({
              value: option.id,
              label: option.status === "active" ? `${option.name} (active)` : option.name,
            }))}
          />
        </div>
        <p className="font-mono text-2xs tabular-nums text-muted">
          {formatSprintRange(sprint.start_date, sprint.end_date)} · {sprintTimeStatus(sprint, today).label}
        </p>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="ghost" onClick={() => onEdit(sprint)} leftIcon={<Pencil />}>Edit</Button>
          <Button variant="secondary" onClick={sheet.newTask} leftIcon={<Plus />}>Add task</Button>
          {canStart && <Button onClick={() => onStart(sprint)} leftIcon={<Play />}>Start sprint</Button>}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setDraggedTask(active.data.current?.task || null)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedTask(null)}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <PlanPanel
            id="backlog"
            title="Backlog"
            meta={backlog.isLoading ? null : `${backlogCount} open`}
            isLoading={backlog.isLoading}
            error={backlog.error}
            onRetry={refetchBacklog}
            emptyText={hasFilters ? "Nothing matches these filters." : "Every open task you can edit is already in a sprint."}
            controls={(
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="min-w-40 flex-1">
                  <SearchBox value={searchInput} onChange={handleSearchChange} placeholder="Search backlog" />
                </div>
                {projects.length > 0 && (
                  <div className="w-full sm:w-44">
                    <Select
                      aria-label="Filter backlog by project"
                      value={filters.project_id}
                      onChange={(event) => setFilters((current) => ({ ...current, project_id: event.target.value }))}
                      options={[{ value: "", label: "All projects" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]}
                    />
                  </div>
                )}
              </div>
            )}
            footer={<LoadMoreButton hasMore={backlog.hasMore} isLoading={backlog.isLoadingMore} onLoadMore={backlog.loadMore} className="py-3" />}
          >
            {backlog.tasks.length > 0 && backlog.tasks.map((task) => (
              <PlanRow
                key={task.id}
                task={task}
                panel="backlog"
                moveLabel={`Add ${task.title} to ${sprint.name}`}
                moveIcon={<ArrowRight className="h-4 w-4" />}
                onMove={addToSprint}
                onOpen={sheet.openTask}
              />
            ))}
          </PlanPanel>

          <PlanPanel
            id="sprint"
            title={sprint.name}
            meta={planned.isLoading ? null : `${plannedCount} ${plannedCount === 1 ? "task" : "tasks"}`}
            isLoading={planned.isLoading}
            error={planned.error}
            onRetry={refetchPlanned}
            emptyText="Drag tasks here, or use the arrow on any backlog task."
            controls={sprint.goal ? <p className="mt-1 line-clamp-2 text-xs text-muted">{sprint.goal}</p> : null}
            footer={<LoadMoreButton hasMore={planned.hasMore} isLoading={planned.isLoadingMore} onLoadMore={planned.loadMore} className="py-3" />}
          >
            {planned.tasks.length > 0 && planned.tasks.map((task) => (
              <PlanRow
                key={task.id}
                task={task}
                panel="sprint"
                moveLabel={`Remove ${task.title} from ${sprint.name}`}
                moveIcon={<ArrowLeft className="h-4 w-4" />}
                onMove={removeFromSprint}
                onOpen={sheet.openTask}
              />
            ))}
          </PlanPanel>
        </div>

        <DragOverlay dropAnimation={null}>
          {draggedTask ? (
            <div className="max-w-sm truncate rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading shadow-md">
              {draggedTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskModal isOpen={sheet.isOpen} onClose={sheet.close} task={sheet.task} onSave={handleTaskSaved} defaultSprintId={sprint.id} />
    </>
  );
}
