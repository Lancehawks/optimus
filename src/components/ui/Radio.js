"use client";

import { cn } from "@/lib/utils";

export default function Radio({ label, checked = false, onChange, disabled = false, name, value, className, ...props }) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-surface transition-colors",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
          checked ? "border-brand-500" : "border-border-strong"
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-brand-500" />}
      </span>
      {label && <span className="text-sm text-body">{label}</span>}
    </label>
  );
}
