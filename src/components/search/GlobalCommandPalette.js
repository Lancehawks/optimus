"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  CornerDownLeft,
  FileText,
  FolderKanban,
  Library,
  ListChecks,
  NotebookPen,
  PenTool,
  Repeat2,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { searchService } from "@/services/api";
import { cn } from "@/lib/utils";
import Spinner from "@/components/ui/Spinner";

const destinations = [
  { id: "today", title: "Today", href: "/dashboard", icon: Sun },
  { id: "tasks", title: "Tasks", href: "/tasks", icon: ListChecks },
  { id: "calendar", title: "Calendar", href: "/calendar", icon: CalendarDays },
  { id: "projects", title: "Projects", href: "/projects", icon: FolderKanban },
  { id: "notes", title: "Notes", href: "/notes", icon: NotebookPen },
  { id: "whiteboards", title: "Whiteboards", href: "/whiteboards", icon: PenTool },
  { id: "library", title: "Library", href: "/library", icon: Library },
  { id: "routines", title: "Routines", href: "/routines", icon: Repeat2 },
  { id: "settings", title: "Settings", href: "/settings", icon: Settings },
].map((item) => ({ ...item, type: "action", label: "Go to" }));

const typeIcons = {
  task: ListChecks,
  note: NotebookPen,
  project: FolderKanban,
  bookmark: Bookmark,
  resource: FileText,
};

function SearchRow({ item, isActive, onMouseEnter, onSelect }) {
  const Icon = item.icon || typeIcons[item.type] || ArrowRight;
  const detail = item.type === "action" ? null : item.description || item.meta;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
      className={cn(
        "flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left transition-colors",
        isActive ? "bg-surface-tertiary" : "hover:bg-surface-tertiary/60"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-heading" : "text-muted")} strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-medium text-heading">{item.title}</span>
        {detail && <span className="ml-2 text-muted">{detail}</span>}
      </span>
      <span className="shrink-0 text-xs text-muted">{item.label}</span>
      {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />}
    </button>
  );
}

export default function GlobalCommandPalette({ isOpen, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmedQuery = query.trim();
  const items = useMemo(() => {
    if (trimmedQuery.length >= 2) return results;
    if (!trimmedQuery) return destinations;
    const needle = trimmedQuery.toLowerCase();
    return destinations.filter((item) => item.title.toLowerCase().includes(needle));
  }, [results, trimmedQuery]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setError("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || trimmedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await searchService.global(trimmedQuery, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResults(data.results || []);
        setActiveIndex(0);
      } catch (searchError) {
        if (searchError?.name === "AbortError" || controller.signal.aborted) return;
        setResults([]);
        setError(searchError.message || "Search failed");
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, trimmedQuery]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(items.length - 1, 0)));
  }, [items.length]);

  if (!isOpen) return null;

  const handleSelect = (item) => {
    if (!item?.href) return;
    onClose();
    router.push(item.href);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (items.length ? (index + 1) % items.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
      return;
    }
    if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      handleSelect(items[activeIndex]);
    }
  };

  const searching = trimmedQuery.length >= 2;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[14vh] sm:px-4" onKeyDown={handleKeyDown}>
      <button type="button" aria-label="Close search" className="overlay animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl bg-surface shadow-lg"
      >
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or jump to…"
            aria-label="Search"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="global-search-results"
            className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-heading outline-none placeholder:text-placeholder"
          />
          {isLoading ? <Spinner size="sm" /> : <kbd className="rounded border border-border px-1.5 py-0.5 text-[0.625rem] text-muted">esc</kbd>}
        </div>

        <div id="global-search-results" className="max-h-[min(24rem,56vh)] overflow-y-auto p-1.5 scrollbar-thin" role="listbox">
          {!searching && <p className="px-2.5 pb-1 pt-2 text-overline">Jump to</p>}
          {searching && results.length > 0 && <p className="px-2.5 pb-1 pt-2 text-overline">Results</p>}

          {!isLoading && error && <div className="px-3 py-8 text-center text-sm text-danger">{error}</div>}

          {!isLoading && !error && items.length === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="font-serif text-lg text-heading">Nothing found</p>
              <p className="mt-1 text-xs text-muted">Try a task title, a phrase from a note, or a project name.</p>
            </div>
          )}

          {!error && items.length > 0 && (
            <div className="flex flex-col">
              {items.map((item, index) => (
                <SearchRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  isActive={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onSelect={() => handleSelect(item)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-surface-secondary px-4 py-2 text-[0.6875rem] text-muted">
          <span className="flex items-center gap-1.5"><kbd className="font-mono">↑↓</kbd> to move</span>
          <span className="flex items-center gap-1.5"><kbd className="font-mono">↵</kbd> to open</span>
        </div>
      </div>
    </div>
  );
}
