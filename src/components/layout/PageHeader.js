import { cn } from "@/lib/utils";

export function PageHeaderStat({ label, value, tone = "neutral" }) {
  const toneClasses = {
    neutral: "bg-surface-tertiary text-muted",
    brand: "bg-brand-500/10 text-brand-300",
    danger: "bg-danger-light text-danger",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
    info: "bg-info-light text-info",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption", toneClasses[tone])}>
      <strong className="text-heading!">{value}</strong>
      {label}
    </span>
  );
}

export default function PageHeader({
  title,
  description,
  icon,
  meta,
  actions,
  className,
}) {
  return (
    <header className={cn("mb-6 border-b border-border-light pb-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary text-brand-300">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-h1 truncate">{title}</h1>
            {description && (
              <p className="mt-1 text-body-sm text-muted!">{description}</p>
            )}
            {meta && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {meta}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
