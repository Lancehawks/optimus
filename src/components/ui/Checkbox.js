"use client";

import { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Checkbox({
  label,
  checked = false,
  onChange,
  disabled = false,
  indeterminate = false,
  className,
  ...props
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const active = checked || indeterminate;

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
          active ? "border-brand-500 bg-brand-500 text-white" : "border-border-strong bg-surface"
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
        {indeterminate && !checked && <Minus className="h-3 w-3" strokeWidth={3} />}
      </span>
      {label && <span className="text-sm text-body">{label}</span>}
    </label>
  );
}
