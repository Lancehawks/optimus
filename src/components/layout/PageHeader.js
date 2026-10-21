import { cn } from "@/lib/utils";

const statTones = {
  neutral: "text-heading",
  brand: "text-brand-500",
  danger: "text-danger",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
};

export function PageHeaderStat({ label, value, tone = "neutral" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs text-muted">
      <strong className={cn("font-mono text-[0.8125rem] font-medium tabular-nums", statTones[tone] || statTones.neutral)}>
        {value}
      </strong>
      {label}
    </span>
  );
}

/**
 * Page identity: a serif title, an optional one-line description, quiet
 * figures underneath, and actions aligned to the right.
 */
export default function PageHeader({ title, description, meta, actions, className, children }) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <h1 className="text-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">{meta}</div>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
