"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "py-1.5 pl-8 pr-8 text-xs",
  md: "pl-10 pr-10",
};

const iconSizeClasses = {
  sm: "left-2.5 h-3.5 w-3.5",
  md: "left-3 h-4 w-4",
};

const clearSizeClasses = {
  sm: "right-2 h-3.5 w-3.5",
  md: "right-3 h-4 w-4",
};

const SearchBox = forwardRef(function SearchBox(
  { placeholder = "Search...", value, onChange, onClear, size = "md", className, ...props },
  ref
) {
  return (
    <div className="relative w-full">
      <svg
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-placeholder pointer-events-none",
          iconSizeClasses[size]
        )}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "input-base placeholder:text-placeholder focus:input-focus",
          sizeClasses[size],
          className
        )}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-placeholder hover:text-muted transition-colors cursor-pointer",
            clearSizeClasses[size]
          )}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-full w-full">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
});

export default SearchBox;
