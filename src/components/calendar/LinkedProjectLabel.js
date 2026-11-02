"use client";

import { cn } from "@/lib/utils";
import ProjectMark from "@/components/projects/ProjectMark";

// The project behind an event's linked tasks: its logo and name, plus a count
// when the tasks span several projects.
export default function LinkedProjectLabel({ projects, className }) {
  const [first, ...others] = projects;
  if (!first) return null;
  return (
    <div className={cn("flex min-w-0 items-center gap-1 text-3xs font-medium text-body", className)}>
      <ProjectMark project={first} size="2xs" />
      <span className="truncate">{first.name}</span>
      {others.length > 0 && <span className="shrink-0 font-mono text-muted">+{others.length}</span>}
    </div>
  );
}
