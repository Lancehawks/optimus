"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";

const centerSizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const sheetSizes = {
  sm: "sm:w-[26rem]",
  md: "sm:w-[32rem]",
  lg: "sm:w-[40rem]",
  xl: "sm:w-[48rem]",
};

/**
 * Dialog surface. `placement="right"` renders a full-height sheet for
 * detail views; the default centred dialog suits short forms.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  placement = "center",
  children,
  footer,
  className,
  bodyClassName,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const returnFocusRef = useRef(null);

  useKeyboard({ Escape: onClose }, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      panel.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      const target = returnFocusRef.current;
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isSheet = placement === "right";

  return (
    <div className={cn("fixed inset-0 z-50 flex", isSheet ? "justify-end sm:p-2" : "items-center justify-center p-4")}>
      <div className="overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialog"}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex w-full flex-col bg-surface shadow-lg outline-none",
          isSheet
            ? cn("h-full animate-sheet-in sm:rounded-2xl", sheetSizes[size] || sheetSizes.md)
            : cn("max-h-[calc(100dvh-2rem)] animate-scale-in rounded-2xl", centerSizes[size] || centerSizes.md),
          className
        )}
      >
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[1rem] font-semibold leading-6 text-heading">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1.5 -mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-tertiary hover:text-heading"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 scrollbar-thin",
            title ? "pb-5" : "py-5",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer && (
          <div className={cn(
            "flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-secondary px-5 py-3",
            isSheet ? "sm:rounded-b-2xl" : "rounded-b-2xl"
          )}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
