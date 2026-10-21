"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SearchBox = forwardRef(function SearchBox(
  { placeholder = "Search", value, onChange, onClear, size = "md", className, ...props },
  ref
) {
  return (
    <div className="relative w-full min-w-0">
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-placeholder",
          size === "sm" ? "left-2 h-3.5 w-3.5" : "left-2.5 h-4 w-4"
        )}
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "input-base focus:input-focus [&::-webkit-search-cancel-button]:hidden",
          size === "sm" ? "min-h-7! py-1! pl-7! pr-7! text-xs!" : "pl-8! pr-8!",
          className
        )}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-placeholder transition-colors hover:text-heading"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

export default SearchBox;
