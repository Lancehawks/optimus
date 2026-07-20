"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchService } from "@/services/api";
import { cn } from "@/lib/utils";

const quickActions = [
  { id: "dashboard", label: "Page", title: "Open dashboard", description: "Daily command center", href: "/dashboard" },
  { id: "tasks", label: "Page", title: "Open tasks", description: "Lists, Kanban, filters, and priorities", href: "/tasks" },
  { id: "notes", label: "Page", title: "Open notes", description: "Notebooks, journals, and pinned notes", href: "/notes" },
  { id: "projects", label: "Page", title: "Open projects", description: "Solo and shared spaces", href: "/projects" },
  { id: "bookmarks", label: "Page", title: "Open saved links", description: "Bookmarks and collections", href: "/bookmarks" },
  { id: "resources", label: "Page", title: "Open resources", description: "Files, flashcards, and reading list", href: "/resources" },
];

const typeStyles = {
  task: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  note: "text-info bg-info-light border-info/20",
  project: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  bookmark: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  resource: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  action: "text-brand-300 bg-brand-500/10 border-brand-500/20",
};

function ResultIcon({ type }) {
  const common = "h-4 w-4";
  if (type === "task") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }
  if (type === "note") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H5.625A1.125 1.125 0 0 0 4.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    );
  }
  if (type === "project") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9A2.25 2.25 0 0 0 19.5 6.75h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
    );
  }
  if (type === "bookmark") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
    );
  }
  if (type === "resource") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292V6.042Z" />
      </svg>
    );
  }
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

function SearchRow({ item, isActive, onMouseEnter, onSelect }) {
  const type = item.type || "action";

  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        isActive
          ? "border-brand-500/40 bg-brand-500/12"
          : "border-transparent hover:border-border-light hover:bg-surface-tertiary"
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", typeStyles[type] || typeStyles.action)}>
        <ResultIcon type={type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body-sm font-semibold text-heading!">{item.title}</span>
          <span className="shrink-0 rounded-full bg-surface-tertiary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted">
            {item.label}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-caption text-muted!">
          {item.description || item.meta || item.href}
        </span>
      </span>
      <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
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
    return quickActions.map((action) => ({ ...action, type: "action" }));
  }, [results, trimmedQuery.length]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
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
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await searchService.global(trimmedQuery);
        setResults(data.results || []);
        setActiveIndex(0);
      } catch (searchError) {
        setResults([]);
        setError(searchError.message || "Search failed");
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timeout);
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

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh] sm:px-4" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label="Close command palette"
        className="overlay animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-modal animate-scale-in"
      >
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-3 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 focus-within:border-brand-500 focus-within:shadow-input-focus">
            <svg className="h-5 w-5 shrink-0 text-placeholder" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks, notes, projects, saved links, resources..."
              className="min-w-0 flex-1 bg-transparent text-body text-heading! outline-none placeholder:text-placeholder focus-visible:shadow-none!"
            />
            <kbd className="hidden rounded border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-muted sm:inline-flex">
              Esc
            </kbd>
          </div>
        </div>

        <div className="max-h-[56vh] overflow-y-auto p-2 scrollbar-thin">
          {trimmedQuery.length < 2 && (
            <p className="px-3 py-2 text-caption text-muted!">Quick navigation</p>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-8 text-body-sm text-muted!">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
              </svg>
              Searching...
            </div>
          )}

          {!isLoading && error && (
            <div className="px-3 py-8 text-body-sm text-danger!">{error}</div>
          )}

          {!isLoading && !error && items.length === 0 && trimmedQuery.length >= 2 && (
            <div className="px-3 py-8 text-center">
              <p className="text-body-sm font-semibold text-heading!">No results found</p>
              <p className="mt-1 text-caption text-muted!">Try a task title, note phrase, project name, link, or resource.</p>
            </div>
          )}

          {!isLoading && !error && items.length > 0 && (
            <div className="space-y-1">
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

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-caption text-muted!">
          <span>Use arrows to move</span>
          <span>Enter to open</span>
        </div>
      </div>
    </div>
  );
}
