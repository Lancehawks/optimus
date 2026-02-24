"use client";

import { cn } from "@/lib/utils";

export default function Radio({
  label,
  checked = false,
  onChange,
  disabled = false,
  name,
  value,
  className,
  ...props
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
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
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-border-strong transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/30 peer-focus-visible:ring-offset-1",
          checked ? "border-brand-500" : "bg-surface"
        )}
      >
        {checked && (
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
        )}
      </span>
      {label && <span className="text-body-sm">{label}</span>}
    </label>
  );
}
