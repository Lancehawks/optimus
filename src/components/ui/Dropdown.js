"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useKeyboard } from "@/hooks/useKeyboard";

export default function Dropdown({ trigger, items = [], align = "left", className }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useClickOutside(ref, () => setIsOpen(false), isOpen);
  useKeyboard({ Escape: () => setIsOpen(false) }, isOpen);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 min-w-44 animate-slide-down rounded-xl border border-border bg-surface p-1 shadow-md",
            align === "right" ? "right-0" : "left-0",
            className
          )}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={i} className="mx-1 my-1 h-px bg-border" />;
            }

            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors",
                  item.danger ? "text-danger hover:bg-danger-light" : "text-body hover:bg-surface-tertiary hover:text-heading"
                )}
              >
                {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
