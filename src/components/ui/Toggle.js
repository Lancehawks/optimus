"use client";

import { cn } from "@/lib/utils";

const sizeMap = {
  sm: { track: "h-5 w-9", thumb: "h-3.5 w-3.5", translate: "translate-x-4" },
  md: { track: "h-6 w-11", thumb: "h-4.5 w-4.5", translate: "translate-x-5" },
};

export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  label,
  className,
}) {
  const s = sizeMap[size];

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2.5 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full transition-colors cursor-pointer",
          s.track,
          checked ? "bg-brand-500" : "bg-neutral-200",
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "inline-block rounded-full bg-white shadow-xs transition-transform",
            s.thumb,
            checked ? s.translate : "translate-x-0.5"
          )}
        />
      </button>
      {label && <span className="text-body-sm">{label}</span>}
    </label>
  );
}
