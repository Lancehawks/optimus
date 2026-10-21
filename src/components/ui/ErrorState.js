"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "./Button";

export default function ErrorState({
  title = "We couldn't load this data",
  description = "Check your connection and try again.",
  onRetry,
  compact = false,
  className,
}) {
  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-light px-4 py-3",
          className
        )}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-heading">{title}</p>
          {description && <p className="mt-0.5 text-xs text-body">{description}</p>}
        </div>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-danger/25 bg-danger-light text-danger">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-[1.5rem] leading-7 text-heading">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {onRetry && (
        <Button type="button" variant="secondary" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
