import { cn } from "@/lib/utils";

/** A thin meter with its count beside it, so the figure never relies on colour. */
export default function SprintProgress({ done, total, className }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label="Tasks done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-tertiary"
      >
        <div className="animate-grow-x h-full rounded-full bg-success transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted">{done}/{total} done</span>
    </div>
  );
}
