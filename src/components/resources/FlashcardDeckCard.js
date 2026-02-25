"use client";

import { Badge, Button, Dropdown } from "@/components/ui";

export default function FlashcardDeckCard({ deck, onClick, onStudy, onEdit, onDelete }) {
  return (
    <div className="card card-hover p-4 cursor-pointer" onClick={() => onClick?.(deck)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-heading! font-medium">{deck.name}</h3>
          {deck.description && (
            <p className="text-body-sm text-muted! mt-1 truncate">{deck.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="neutral" size="sm">
              {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
            </Badge>
            {deck.due_count > 0 && (
              <span className="text-caption font-medium text-brand-400">
                {deck.due_count} due
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {deck.due_count > 0 && (
            <Button size="sm" onClick={() => onStudy(deck)}>
              Study
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(deck)}>
            Edit
          </Button>
          <Dropdown
            align="right"
            trigger={
              <button className="btn-ghost rounded-lg p-1.5 cursor-pointer">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            }
            items={[
              { label: "Delete", danger: true, onClick: () => onDelete(deck) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
