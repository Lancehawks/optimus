"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useKeyboard } from "@/hooks/useKeyboard";

export default function Dropdown({
  trigger,
  items = [],
  align = "left",
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useClickOutside(ref, () => setIsOpen(false), isOpen);
  useKeyboard({ Escape: () => setIsOpen(false) }, isOpen);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            "absolute z-40 mt-2 min-w-45 rounded-xl bg-surface-raised border border-border shadow-lg animate-slide-down py-1.5",
            align === "right" ? "right-0" : "left-0",
            className
          )}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={i} className="divider my-1" />;
            }

            return (
              <button
                key={i}
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-body-sm transition-colors text-left cursor-pointer",
                  item.danger
                    ? "text-danger! hover:bg-danger-light"
                    : "hover:bg-surface-tertiary"
                )}
              >
                {item.icon && (
                  <span className="h-4 w-4 shrink-0">{item.icon}</span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
