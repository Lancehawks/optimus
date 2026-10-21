"use client";

import { cn } from "@/lib/utils";

const sizeMap = {
  sm: { track: "h-4 w-7", thumb: "h-3 w-3", translate: "translate-x-3.5" },
  md: { track: "h-5 w-9", thumb: "h-4 w-4", translate: "translate-x-4.5" },
};

export default function Toggle({ checked = false, onChange, disabled = false, size = "md", label, className }) {
  const s = sizeMap[size] || sizeMap.md;

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2.5",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
          s.track,
          checked ? "bg-brand-500" : "bg-neutral-500",
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "inline-block rounded-full bg-white shadow-sm transition-transform duration-150",
            s.thumb,
            checked ? s.translate : "translate-x-0"
          )}
        />
      </button>
      {label && <span className="text-sm text-body">{label}</span>}
    </label>
  );
}
