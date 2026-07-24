"use client";

import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useKeyboard } from "@/hooks/useKeyboard";

/**
 * SearchableSelect — a searchable dropdown that supports single or multi-select.
 *
 * Props:
 *  - label           (string)   — field label
 *  - placeholder     (string)   — search input placeholder
 *  - value           (array)    — selected items: [{ id, label, sublabel?, ...extra }]
 *  - onSearch        (fn)       — async (query: string) => items[]  — called on input change (debounced internally)
 *  - onSelect        (fn)       — (item) => void  — called when an item is picked
 *  - onRemove        (fn)       — (item) => void  — called when a chip X is clicked
 *  - renderItem      (fn?)      — optional custom renderer for dropdown items
 *  - renderChip      (fn?)      — optional custom renderer for selected chips
 *  - debounceMs      (number)   — debounce delay, default 300
 *  - multi           (bool)     — multi-select mode (shows chips), default true
 *  - error           (string?)  — error message
 *  - hint            (string?)  — hint text
 */
const SearchableSelect = forwardRef(function SearchableSelect(
  {
    label,
    placeholder = "Search...",
    value = [],
    onSearch,
    onSelect,
    onRemove,
    renderItem,
    renderChip,
    debounceMs = 300,
    multi = true,
    error,
    hint,
    className,
    disabled = false,
  },
  ref
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);
  useKeyboard({ Escape: () => setIsOpen(false) }, isOpen);

  // Fetch results (immediate or debounced)
  const fetchResults = useCallback(
    async (searchQuery) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setSearchError("");
      try {
        const items = await onSearch(searchQuery, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const selectedIds = new Set(value.map((v) => v.id));
        setResults((items || []).filter((item) => !selectedIds.has(item.id)));
      } catch (requestError) {
        if (requestError?.name === "AbortError" || controller.signal.aborted) return;
        setResults([]);
        setSearchError(requestError?.message || "Search failed. Try again.");
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setIsSearching(false);
        }
      }
    },
    [onSearch, value]
  );

  // Debounced search on query change
  const doSearch = useCallback(
    (searchQuery) => {
      clearTimeout(timerRef.current);
      setIsSearching(true);
      timerRef.current = setTimeout(() => fetchResults(searchQuery), debounceMs);
    },
    [fetchResults, debounceMs]
  );

  useEffect(() => {
    if (isOpen) {
      doSearch(query);
    }
    return () => {
      clearTimeout(timerRef.current);
      requestRef.current?.abort();
    };
  }, [query, doSearch, isOpen]);

  // Load initial results on open
  function handleFocus() {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      setIsSearching(true);
      fetchResults(query);
    }
  }

  function handleSelect(item) {
    if (disabled) return;
    onSelect?.(item);
    setQuery("");
    setResults([]);
    setHighlightIndex(-1);
    if (!multi) setIsOpen(false);
    else inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    }
  }

  // Default chip renderer
  function defaultRenderChip(item) {
    return (
      <span
        key={item.id}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-brand-500/15 text-brand-400 border border-brand-500/20"
      >
        <span className="truncate max-w-[180px]">{item.label}</span>
        {item.sublabel && (
          <span className="text-[9px] px-1 py-0.5 rounded-sm text-brand-300/70">
            {item.sublabel}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(item);
          }}
          disabled={disabled}
          className="text-brand-400/60 hover:text-brand-400 cursor-pointer ml-0.5"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </span>
    );
  }

  // Default dropdown item renderer
  function defaultRenderItem(item, isHighlighted) {
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelect(item)}
        onMouseEnter={() => setHighlightIndex(results.indexOf(item))}
        className={cn(
          "w-full text-left px-3 py-2 text-body-sm transition-colors flex items-center gap-2 cursor-pointer",
          isHighlighted ? "bg-surface-tertiary" : "hover:bg-surface-tertiary"
        )}
      >
        <span className="truncate flex-1">{item.label}</span>
        {item.sublabel && (
          <span className="text-caption text-muted shrink-0">
            {item.sublabel}
          </span>
        )}
      </button>
    );
  }

  const chipRenderer = renderChip || defaultRenderChip;
  const itemRenderer = renderItem || defaultRenderItem;

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {label && (
        <label className="text-body-sm text-heading! font-medium block mb-1.5">
          {label}
        </label>
      )}

      {/* Selected chips */}
      {multi && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((item) => chipRenderer(item))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              if (disabled) return;
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="input-base pl-9 w-full"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-surface-raised border border-border shadow-lg scrollbar-thin animate-slide-down">
            {results.map((item, i) => itemRenderer(item, i === highlightIndex))}
          </div>
        )}

        {/* Empty state */}
        {isOpen && !disabled && !isSearching && searchError && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-danger/25 bg-surface-raised px-3 py-3 text-center text-body-sm text-danger shadow-lg" role="alert">
            {searchError}
          </div>
        )}

        {isOpen && !disabled && !isSearching && !searchError && results.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg bg-surface-raised border border-border shadow-lg px-3 py-3 text-center text-body-sm text-muted">
            {query.trim() ? "No results found" : "No items available"}
          </div>
        )}
      </div>

      {error && <p className="text-caption text-danger! mt-1.5">{error}</p>}
      {hint && !error && <p className="text-caption mt-1.5">{hint}</p>}
    </div>
  );
});

export default SearchableSelect;
