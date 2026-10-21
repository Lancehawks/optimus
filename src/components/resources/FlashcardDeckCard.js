"use client";

import { MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { Button, Dropdown } from "@/components/ui";

export default function FlashcardDeckCard({ deck, onClick, onStudy, onEdit, onDelete }) {
  const due = Number(deck.due_count || 0);
  const total = Number(deck.card_count || 0);

  return (
    <div
      className="card card-hover group flex min-h-40 cursor-pointer flex-col p-5"
      onClick={() => onClick?.(deck)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick?.(deck);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-xl leading-7 text-heading">{deck.name}</h3>
          {deck.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{deck.description}</p>}
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="-mr-1.5 -mt-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-heading focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Actions for ${deck.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
            items={[
              { label: "Edit cards", icon: <Pencil />, onClick: () => onEdit(deck) },
              { divider: true },
              { label: "Delete deck", danger: true, icon: <Trash2 />, onClick: () => onDelete(deck) },
            ]}
          />
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between pt-6">
        <p className="font-mono text-xs tabular-nums text-muted">
          {total} card{total === 1 ? "" : "s"}
          {due > 0 && <span className="text-heading"> · {due} due</span>}
        </p>
        {due > 0 && (
          <span onClick={(event) => event.stopPropagation()}>
            <Button size="sm" leftIcon={<Play />} onClick={() => onStudy(deck)}>Study</Button>
          </span>
        )}
      </div>
    </div>
  );
}
