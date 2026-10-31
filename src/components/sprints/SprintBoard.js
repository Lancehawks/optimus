"use client";

import { useCallback } from "react";
import { CircleCheck, Flag, ListPlus, Pencil, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, useToast } from "@/components/ui";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import TaskModal from "@/components/tasks/TaskModal";
import SprintProgress from "@/components/sprints/SprintProgress";
import { useTaskSheet } from "@/components/sprints/useTaskSheet";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/context/AuthContext";
import { taskService } from "@/services/api";
import { formatSprintRange, sprintTimeStatus } from "@/lib/sprintDates";
import { cn } from "@/lib/utils";

function ActiveSprintBoard({ sprint, today, onEdit, onClose, onPlan, onChanged }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { tasks, setTasks, isLoading, error, refetch, hasMore, loadMore, isLoadingMore } = useTasks({ sprint_id: sprint.id });
  const sheet = useTaskSheet();
  const time = sprintTimeStatus(sprint, today);

  const handleStatusChange = useCallback(async (taskId, status) => {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
    try {
      await taskService.update(taskId, { status });
      onChanged();
    } catch (requestError) {
      refetch();
      addToast({ message: requestError.message, type: "error" });
    }
  }, [addToast, onChanged, refetch, setTasks]);

  const handleTaskSaved = useCallback(() => {
    refetch();
    onChanged();
  }, [onChanged, refetch]);

  return (
    <>
      <section className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 className="font-serif text-[1.625rem] leading-8 text-heading">{sprint.name}</h2>
            {sprint.goal && <p className="mt-1 max-w-2xl text-sm text-body">{sprint.goal}</p>}
            <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-2xs tabular-nums text-muted">
              <span>{formatSprintRange(sprint.start_date, sprint.end_date)}</span>
              <span className={cn(time.overdue && "text-warning")}>{time.label}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={onEdit} leftIcon={<Pencil />}>Edit</Button>
            <Button variant="secondary" onClick={sheet.newTask} leftIcon={<Plus />}>Add task</Button>
            <Button variant={time.overdue ? "primary" : "secondary"} onClick={onClose} leftIcon={<CircleCheck />}>Close sprint</Button>
          </div>
        </div>
        {sprint.task_count > 0 && <SprintProgress done={sprint.done_count} total={sprint.task_count} className="mt-4 max-w-2xl" />}
      </section>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden" aria-hidden="true">
          {[0, 1, 2, 3].map((column) => <div key={column} className="skeleton h-80 w-[17.5rem] shrink-0 rounded-xl" />)}
        </div>
      ) : error && tasks.length === 0 ? (
        <ErrorState title="This sprint's tasks couldn't be loaded" description={error.message} onRetry={refetch} />
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Flag />}
            title="Nothing in this sprint yet"
            description="Pull tasks in from your backlog, across any of your projects."
            action={{ children: "Plan this sprint", leftIcon: <ListPlus />, onClick: onPlan }}
          />
        </div>
      ) : (
        <KanbanBoard tasks={tasks} onTaskClick={sheet.openTask} onStatusChange={handleStatusChange} currentUserId={user?.id} />
      )}

      {!isLoading && tasks.length > 0 && (
        <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
      )}

      <TaskModal isOpen={sheet.isOpen} onClose={sheet.close} task={sheet.task} onSave={handleTaskSaved} defaultSprintId={sprint.id} />
    </>
  );
}

/** The Current view: the active sprint's board, or a way to begin one. */
export default function SprintBoard({ activeSprint, plannedSprints, today, onEdit, onClose, onPlan, onStart, onNew, onChanged }) {
  if (activeSprint) {
    return (
      <ActiveSprintBoard
        key={activeSprint.id}
        sprint={activeSprint}
        today={today}
        onEdit={() => onEdit(activeSprint)}
        onClose={onClose}
        onPlan={onPlan}
        onChanged={onChanged}
      />
    );
  }

  if (plannedSprints.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Flag />}
          title="No sprint running"
          description="Choose a stretch of time and pull in the work you'll finish during it."
          action={{ children: "New sprint", leftIcon: <Plus />, onClick: onNew }}
        />
      </div>
    );
  }

  return (
    <section>
      <h2 className="mb-1 font-serif text-[1.625rem] leading-8 text-heading">No sprint running</h2>
      <p className="mb-4 text-sm text-muted">Start your next sprint when you&apos;re ready.</p>
      <ul className="card divide-y divide-border">
        {plannedSprints.map((sprint) => (
          <li key={sprint.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-heading">{sprint.name}</p>
              <p className="mt-0.5 font-mono text-2xs tabular-nums text-muted">
                {formatSprintRange(sprint.start_date, sprint.end_date)} · {sprint.task_count} {sprint.task_count === 1 ? "task" : "tasks"}
              </p>
            </div>
            <Button variant="ghost" onClick={() => onPlan(sprint.id)}>Plan</Button>
            <Button onClick={() => onStart(sprint)}>Start</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
