import { cn } from "@/lib/utils";

export function PageHeaderStat({ label, value, tone = "neutral" }) {
  const toneClasses = {
    neutral: "bg-surface-tertiary text-muted",
    brand: "bg-brand-500/10 text-brand-700",
    danger: "bg-danger-light text-danger",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
    info: "bg-info-light text-info",
  };

  return (
    <span className={cn("donezo-page-stat optimus-page-stat", toneClasses[tone])}>
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
  eyebrow = "Optimus workspace",
  className,
}) {
  return (
    <header className={cn("donezo-page-header optimus-page-header", className)}>
      <div className="donezo-page-header-inner">
        <div className="donezo-page-heading">
          {icon && (
            <span className="donezo-page-icon">
              {icon}
            </span>
          )}
          <div className="donezo-page-copy">
            <p className="donezo-page-kicker">{eyebrow}</p>
            <h1>{title}</h1>
            {description && (
              <p className="donezo-page-description">{description}</p>
            )}
            {meta && (
              <div className="donezo-page-meta">
                {meta}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="donezo-page-actions">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
