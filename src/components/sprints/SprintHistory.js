"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck, CircleDashed, History, Pencil } from "lucide-react";
import { Button, EmptyState, ErrorState, Spinner } from "@/components/ui";
import { ProjectChip } from "@/components/tasks/TaskGlyphs";
import SprintProgress from "@/components/sprints/SprintProgress";
import { useApiResource } from "@/hooks/useApiResource";
import { sprintService } from "@/services/api";
import { formatSprintRange } from "@/lib/sprintDates";
import { cn } from "@/lib/utils";

function SprintRecord({ sprintId }) {
  const loadTasks = useCallback(async (signal) => {
    const data = await sprintService.get(sprintId, { signal });
    return data.sprint.tasks;
  }, [sprintId]);
  const { data: tasks, error, refetch } = useApiResource(loadTasks);

  if (error) {
    return <ErrorState compact className="my-2" title="This sprint's tasks couldn't be loaded" description={error.message} onRetry={refetch} />;
  }
  if (!tasks) {
    return <div className="flex justify-center py-6"><Spinner size="sm" /></div>;
  }
  if (tasks.length === 0) {
    return <p className="py-4 text-sm text-muted">No tasks to show.</p>;
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2.5 py-2">
          {task.outcome === "completed"
            ? <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            : <CircleDashed className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />}
          <Link href={`/tasks?task_id=${task.id}`} className="min-w-0 flex-1 truncate text-sm text-heading hover:underline">
            {task.title}
          </Link>
          {task.project_name && (
            <ProjectChip name={task.project_name} color={task.project_color} logoFileId={task.project_logo_file_id} className="hidden max-w-40 sm:inline-flex" />
          )}
          <span className="w-20 shrink-0 text-right text-xs text-muted">{task.outcome === "completed" ? "Done" : "Unfinished"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Closed sprints, newest first, each opening onto what happened to its tasks. */
export default function SprintHistory({ completedSprints, onEdit }) {
  const [expandedId, setExpandedId] = useState(null);

  if (completedSprints.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<History />}
          title="No closed sprints yet"
          description="When you close a sprint, what you finished and carried over is kept here."
        />
      </div>
    );
  }

  return (
    <ul className="card divide-y divide-border">
      {completedSprints.map((sprint) => {
        const isExpanded = expandedId === sprint.id;
        const unfinished = sprint.task_count - sprint.done_count;
        return (
          <li key={sprint.id}>
            <div className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : sprint.id)}
                aria-expanded={isExpanded}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left"
              >
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isExpanded && "rotate-90")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-heading">{sprint.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-2xs tabular-nums text-muted">
                    <span>{formatSprintRange(sprint.start_date, sprint.end_date)}</span>
                    {unfinished > 0 && <span>{unfinished} unfinished</span>}
                    {sprint.added_count > 0 && <span>{sprint.added_count} added mid-sprint</span>}
                  </span>
                </span>
                <SprintProgress done={sprint.done_count} total={sprint.task_count} className="hidden w-52 shrink-0 sm:flex" />
              </button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(sprint)} aria-label={`Edit ${sprint.name}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            {isExpanded && (
              <div className="px-4 pb-3 sm:pl-11">
                {sprint.goal && <p className="mb-2 text-sm text-body">{sprint.goal}</p>}
                <SprintRecord sprintId={sprint.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
