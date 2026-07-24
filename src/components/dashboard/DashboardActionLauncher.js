"use client";

import { useEffect, useRef, useState } from "react";
import { Command, FolderPlus, Search, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardActionLauncher({ onAddProject }) {
  const [isOpen, setIsOpen] = useState(false);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const handlePointerDown = (event) => {
      if (launcherRef.current && !launcherRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const runAction = (action) => {
    setIsOpen(false);
    action();
  };

  const actions = [
    {
      label: "Search workspace",
      hint: "Ctrl K",
      icon: Search,
      action: () => window.dispatchEvent(new Event("optimus-open-command-palette")),
    },
    {
      label: "Review day",
      icon: Sparkles,
      action: () => window.dispatchEvent(new Event("optimus-open-review")),
    },
    {
      label: "Add project",
      icon: FolderPlus,
      action: onAddProject,
    },
    {
      label: "Quick capture",
      hint: "Ctrl Shift K",
      icon: Zap,
      action: () => window.dispatchEvent(new Event("optimus-open-quick-capture")),
    },
  ];

  return (
    <div ref={launcherRef} className={cn("dashboard-action-launcher", isOpen && "dashboard-action-launcher-open")}>
      <div className="dashboard-action-menu" role="menu" aria-label="Dashboard actions" aria-hidden={!isOpen}>
        {actions.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="dashboard-action-item"
              style={{ "--action-index": index }}
              onClick={() => runAction(item.action)}
              tabIndex={isOpen ? 0 : -1}
            >
              <span>
                <strong>{item.label}</strong>
                {item.hint && <small>{item.hint}</small>}
              </span>
              <i><Icon aria-hidden="true" /></i>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="dashboard-action-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close dashboard actions" : "Open dashboard actions"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="dashboard-action-trigger-glow" aria-hidden="true" />
        <Command aria-hidden="true" />
      </button>
    </div>
  );
}
