"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className, id, ...props },
  ref
) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-body-sm text-heading! font-medium block mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "input-base focus:input-focus appearance-none pr-10 cursor-pointer",
            !props.value && placeholder && "text-placeholder",
            error && "border-danger! focus:border-danger! focus:shadow-[0_0_0_3px_rgb(239_68_68/0.15)]!",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </div>
      {error && <p className="text-caption text-danger! mt-1.5">{error}</p>}
      {hint && !error && <p className="text-caption mt-1.5">{hint}</p>}
    </div>
  );
});

export default Select;
