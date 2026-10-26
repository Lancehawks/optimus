"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";

const GROUPS = [
  { key: "workspace", label: "Workspace key", match: (option) => option.keySource === "workspace" },
  { key: "anthropic", label: "Your Anthropic key", match: (option) => option.keySource === "member" && option.provider === "anthropic" },
  { key: "openrouter", label: "Your OpenRouter key", match: (option) => option.keySource === "member" && option.provider === "openrouter" },
];

function describe(option, unavailable) {
  if (option.free) return unavailable ? "Free · none left today" : "Free";
  if (option.openWeights) return "Open weights";
  return null;
}

// The model for the next message, as a compact button in the chat box that
// opens a list grouped by whose key pays. Arrow keys move, Enter picks,
// Escape closes without closing the panel.
export default function ModelMenu({ models, value, onChange, disabled = false, freeExhausted = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef(new Map());
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  const groups = GROUPS
    .map((group) => ({ ...group, options: models.filter(group.match) }))
    .filter((group) => group.options.length > 0);
  const ordered = groups.flatMap((group) => group.options);
  const selected = models.find((option) => option.key === value) || null;
  const unavailable = (option) => option.free && freeExhausted && option.key !== value;
  const choosable = ordered.filter((option) => !unavailable(option));

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      optionRefs.current.get(selected && !unavailable(selected) ? selected.key : choosable[0]?.key)?.focus();
    });
    return () => cancelAnimationFrame(frame);
    // Focus moves once, when the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (option) => {
    if (unavailable(option)) return;
    onChange(option.key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const moveFocus = (step) => {
    if (choosable.length === 0) return;
    const index = choosable.findIndex((option) => optionRefs.current.get(option.key) === document.activeElement);
    const next = choosable[(index + step + choosable.length) % choosable.length];
    optionRefs.current.get(next.key)?.focus();
  };

  const handleListKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      optionRefs.current.get((event.key === "Home" ? choosable[0] : choosable.at(-1))?.key)?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  if (models.length === 0) return null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${selected?.label || "none"}`}
        className={cn(
          "inline-flex h-7 max-w-full cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-body transition-colors hover:bg-surface-tertiary hover:text-heading disabled:cursor-not-allowed disabled:opacity-60",
          open && "bg-surface-tertiary text-heading"
        )}
      >
        <span className="truncate">{selected?.label || "Choose a model"}</span>
        {selected?.free && <span className="font-normal text-muted">· free</span>}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Model for your next message"
          onKeyDown={handleListKeyDown}
          className="absolute bottom-full left-0 z-30 mb-2 max-h-80 w-72 animate-scale-in overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg scrollbar-thin"
        >
          {groups.map((group) => (
            <div key={group.key} role="group" aria-labelledby={`model-group-${group.key}`}>
              <p id={`model-group-${group.key}`} className="px-2.5 pb-1 pt-2.5 text-overline">{group.label}</p>
              {group.options.map((option) => {
                const isSelected = option.key === value;
                const blocked = unavailable(option);
                const detail = describe(option, blocked);
                return (
                  <div
                    key={option.key}
                    ref={(node) => {
                      if (node) optionRefs.current.set(option.key, node);
                      else optionRefs.current.delete(option.key);
                    }}
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    aria-disabled={blocked}
                    onClick={() => choose(option)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        choose(option);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 outline-none transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", isSelected ? "font-medium text-heading" : "text-body")}>{option.label}</span>
                      {detail && <span className="block text-[0.6875rem] text-muted">{detail}</span>}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
