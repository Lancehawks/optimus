"use client";

import { cn } from "@/lib/utils";
import Button from "./Button";

export default function ErrorState({
  title = "We couldn't load this data",
  description = "Check your connection and try again.",
  onRetry,
  compact = false,
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-danger/25 bg-danger-light px-6 text-center",
        compact ? "mx-3 my-3 py-6" : "py-16",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-surface-raised text-danger",
          compact ? "mb-3 h-10 w-10" : "mb-4 h-14 w-14"
        )}
      >
        <svg
          className={compact ? "h-5 w-5" : "h-7 w-7"}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.7}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-1.5a9 9 0 11-18 0 9 9 0 0118 0zm-9 4.5h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className={compact ? "text-body-sm font-semibold text-heading" : "text-h3 text-heading"}>
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-body-sm text-muted">{description}</p>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
