import { cn } from "@/lib/utils";
import ProjectMark from "@/components/projects/ProjectMark";

export const statusMeta = {
  todo: { label: "To do" },
  in_progress: { label: "In progress" },
  on_hold: { label: "On hold" },
  done: { label: "Done" },
};

export const priorityMeta = {
  urgent: { label: "Urgent", bars: 3 },
  high: { label: "High", bars: 3 },
  medium: { label: "Medium", bars: 2 },
  low: { label: "Low", bars: 1 },
};

/** Signal-strength bars; urgent becomes a filled alert square. */
export function PriorityIcon({ priority = "medium", className }) {
  const meta = priorityMeta[priority] || priorityMeta.medium;
  if (priority === "urgent") {
    return (
      <svg className={cn("h-3.5 w-3.5 shrink-0 text-danger", className)} viewBox="0 0 14 14" aria-label="Urgent priority" role="img">
        <rect x="0.5" y="0.5" width="13" height="13" rx="3" fill="currentColor" />
        <rect x="6.25" y="3" width="1.5" height="5" rx="0.75" fill="#fff" />
        <circle cx="7" cy="10.25" r="0.9" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg className={cn("h-3.5 w-3.5 shrink-0 text-heading", className)} viewBox="0 0 14 14" aria-label={`${meta.label} priority`} role="img">
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={1 + index * 4.5}
          y={9 - index * 3.5}
          width="3"
          height={4 + index * 3.5}
          rx="1"
          fill="currentColor"
          opacity={index < meta.bars ? 1 : 0.18}
        />
      ))}
    </svg>
  );
}

/** Progress ring: empty, half, paused and complete states. */
export function StatusIcon({ status = "todo", className }) {
  const label = statusMeta[status]?.label || "To do";
  return (
    <svg className={cn("h-3.5 w-3.5 shrink-0", className)} viewBox="0 0 14 14" fill="none" aria-label={label} role="img">
      {status === "done" ? (
        <>
          <circle cx="7" cy="7" r="6.25" fill="var(--brand-500)" />
          <path d="M4.25 7.25 6.1 9l3.65-3.75" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : status === "in_progress" ? (
        <>
          <circle cx="7" cy="7" r="6" stroke="var(--amber-500)" strokeWidth="1.5" />
          <path d="M7 3.25a3.75 3.75 0 0 1 0 7.5Z" fill="var(--amber-500)" />
        </>
      ) : status === "on_hold" ? (
        <>
          <circle cx="7" cy="7" r="6" stroke="var(--neutral-300)" strokeWidth="1.5" strokeDasharray="2.2 1.6" />
          <path d="M5.5 5v4M8.5 5v4" stroke="var(--neutral-300)" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="7" cy="7" r="6" stroke="var(--neutral-400)" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function ProjectChip({ name, color, logoFileId, className }) {
  if (!name) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted", className)}>
      {logoFileId ? (
        <ProjectMark project={{ name, color, logo_file_id: logoFileId }} size="2xs" />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: color || "var(--neutral-400)" }} />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

export function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 text-2xs leading-4 text-body">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color || "var(--neutral-400)" }} />
      {tag.name}
    </span>
  );
}
