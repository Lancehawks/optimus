"use client";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone } from '@/lib/calendarTime';

import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import {
  getEventDisplayColor,
  getEventStatusMeta,
  getLinkedTaskCompletion,
  getLinkedTaskProjects,
  isEventStatusLit,
} from "@/lib/eventDisplay";
import ProjectMark from "@/components/projects/ProjectMark";
import LinkedProjectLabel from "./LinkedProjectLabel";

export default function EventBlock({
  event,
  top,
  height,
  left,
  width,
  onClick,
}) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const color = getEventDisplayColor(event);
  const statusMeta = getEventStatusMeta(event);
  const taskCompletion = getLinkedTaskCompletion(event);
  const litStatus = isEventStatusLit(event);
  const isShort = height < 40;
  const projects = getLinkedTaskProjects(event);
  const projectNames = projects.map((project) => project.name).join(", ");
  // The project row takes the time's place on blocks too short for both; the
  // grid already shows when they are.
  const showTime = projects.length === 0 || height >= 56;
  const projectRowHeight = projects.length > 0 ? 18 : 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className="pointer-events-auto absolute cursor-pointer overflow-hidden rounded-[5px] px-2 text-left text-heading transition-[filter] hover:brightness-[0.97] dark:hover:brightness-110"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: left || "0%",
        width: width || "100%",
        backgroundColor: `color-mix(in srgb, ${color} ${litStatus ? 8 : 15}%, var(--neutral-800))`,
        boxShadow: `inset 2.5px 0 0 ${color}, 0 0 0 1px var(--neutral-800)`,
        zIndex: 10,
      }}
      title={`${event.title} (${formatTimeShort(event.start_time, timeZone)} – ${formatTimeShort(event.end_time, timeZone)})${projectNames ? ` · ${projectNames}` : ""}`}
    >
      {isShort ? (
        <div className="flex h-full items-center gap-1.5">
          {projects[0] && <ProjectMark project={projects[0]} size="2xs" />}
          <span className={cn("truncate text-2xs font-medium", litStatus && "text-muted line-through")}>{event.title}</span>
          <span className="shrink-0 font-mono text-3xs text-muted">{formatTimeShort(event.start_time, timeZone)}</span>
        </div>
      ) : (
        <div className="py-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className={cn("truncate", litStatus && "text-muted line-through")}>{event.title}</span>
            {litStatus && (
              <span className="shrink-0 font-mono text-[0.625rem] uppercase text-muted">{statusMeta.label}</span>
            )}
          </div>
          <LinkedProjectLabel projects={projects} className="mt-0.5" />
          {showTime && (
            <div className="mt-0.5 font-mono text-3xs tabular-nums text-muted">
              {formatTimeShort(event.start_time, timeZone)} – {formatTimeShort(event.end_time, timeZone)}
            </div>
          )}
          {event.location && height > 60 + projectRowHeight && (
            <div className="mt-0.5 truncate text-3xs text-muted">{event.location}</div>
          )}
          {event.linked_tasks?.length > 0 && height > 45 + projectRowHeight && (
            <div className="mt-0.5 flex items-center gap-1 text-3xs text-muted">
              <CircleCheck className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {taskCompletion.total > 1
                  ? `${taskCompletion.done}/${taskCompletion.total} tasks done`
                  : event.linked_tasks.length === 1
                    ? event.linked_tasks[0].title
                    : `${event.linked_tasks.length} tasks`}
              </span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
