"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useChecklist } from "@/hooks/useChecklist";
import { useJustCompleted } from "@/hooks/useJustCompleted";
import { checklistService } from "@/services/api";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/dashboard/SectionHeading";

function RoutineTick({ done }) {
  const justDone = useJustCompleted(done);
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        done ? "border-success bg-success text-white" : "border-border-strong group-hover:border-muted",
        justDone && "animate-pop"
      )}
    >
      {done && <Check className={cn("h-3 w-3", justDone && "animate-check")} strokeWidth={3} />}
    </span>
  );
}

export default function TodayRoutines() {
  const { sections, todayLogs, isLoading, error, refetch } = useChecklist();
  const { addToast } = useToast();
  const [optimistic, setOptimistic] = useState({});

  const items = sections.flatMap((section) =>
    (section.items || []).map((item) => ({ ...item, sectionName: section.name, sectionColor: section.color }))
  );
  const isDone = (item) => (item.id in optimistic ? optimistic[item.id] : Boolean(todayLogs[item.id]));
  const doneCount = items.filter(isDone).length;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const toggle = async (item) => {
    const next = !isDone(item);
    setOptimistic((current) => ({ ...current, [item.id]: next }));
    try {
      await checklistService.toggleLog({ item_id: item.id, completed: next });
      await refetch();
    } catch {
      addToast({ message: "That routine couldn't be updated", type: "error" });
    } finally {
      setOptimistic((current) => {
        const rest = { ...current };
        delete rest[item.id];
        return rest;
      });
    }
  };

  return (
    <section>
      <SectionHeading
        title="Routines"
        count={items.length ? `${doneCount}/${items.length}` : null}
        href="/routines"
        actionLabel="Manage"
      />
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((row) => <div key={row} className="skeleton h-4" />)}
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-muted">Routines couldn&apos;t load.</p>
        ) : items.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-heading">No routines yet</p>
            <p className="mt-0.5 text-xs text-muted">Daily habits you want to keep show up here.</p>
            <Link href="/routines" className="mt-3 inline-block text-xs font-medium text-heading underline underline-offset-4">
              Create a routine
            </Link>
          </div>
        ) : (
          <>
            <div className="h-0.5 bg-surface-tertiary">
              <div className="animate-grow-x h-full bg-success transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <ul className="divide-y divide-border">
              {items.slice(0, 7).map((item) => {
                const done = isDone(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      className="group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                      aria-pressed={done}
                    >
                      <RoutineTick done={done} />
                      <span className={cn("min-w-0 flex-1 truncate text-sm", done ? "text-muted line-through decoration-border-strong" : "text-heading")}>
                        {item.name}
                      </span>
                      <span className="shrink-0 truncate text-xs text-placeholder">{item.sectionName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {items.length > 7 && (
              <Link href="/routines" className="block border-t border-border px-4 py-2 text-xs text-muted hover:text-heading">
                {items.length - 7} more in Routines
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
