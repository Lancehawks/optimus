"use client";

import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldLabel, FieldMessage } from "./Field";
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
        className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-surface-secondary pl-2 pr-1 text-xs font-medium text-heading"
      >
        <span className="truncate max-w-[180px]">{item.label}</span>
        {item.sublabel && (
          <span className="text-[0.6875rem] font-normal text-muted">
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
          aria-label={`Remove ${item.label}`}
          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-tertiary hover:text-heading"
        >
          <X className="h-3 w-3" />
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
          "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-body transition-colors",
          isHighlighted ? "bg-surface-tertiary" : "hover:bg-surface-tertiary"
        )}
      >
        <span className="truncate flex-1">{item.label}</span>
        {item.sublabel && (
          <span className="shrink-0 text-xs text-muted">
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
      <FieldLabel>{label}</FieldLabel>

      {/* Selected chips */}
      {multi && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((item) => chipRenderer(item))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" aria-hidden="true" />
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
            className="input-base focus:input-focus w-full pl-8!"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-muted" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && results.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-56 w-full animate-slide-down overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-md scrollbar-thin">
            {results.map((item, i) => itemRenderer(item, i === highlightIndex))}
          </div>
        )}

        {/* Empty state */}
        {isOpen && !disabled && !isSearching && searchError && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-danger/25 bg-surface px-3 py-3 text-center text-sm text-danger shadow-md" role="alert">
            {searchError}
          </div>
        )}

        {isOpen && !disabled && !isSearching && !searchError && results.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-surface px-3 py-3 text-center text-sm text-muted shadow-md">
            {query.trim() ? "No results found" : "No items available"}
          </div>
        )}
      </div>

      <FieldMessage error={error} hint={hint} />
    </div>
  );
});

export default SearchableSelect;
