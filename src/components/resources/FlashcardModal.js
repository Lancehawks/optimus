"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Modal, Input, Textarea, Button } from "@/components/ui";

export default function FlashcardModal({
  isOpen,
  onClose,
  deck,
  cards,
  onSaveDeck,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  isLoading,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  useEffect(() => {
    if (deck) {
      setName(deck.name || "");
      setDescription(deck.description || "");
    } else {
      setName("");
      setDescription("");
    }
    setNewFront("");
    setNewBack("");
    setEditingCardId(null);
  }, [deck, isOpen]);

  const handleSaveDeck = () => {
    if (!name.trim()) return;
    onSaveDeck({
      id: deck?.id,
      name: name.trim(),
      description: description.trim() || null,
    });
  };

  const handleAddCard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    onAddCard(deck.id, { front: newFront.trim(), back: newBack.trim() });
    setNewFront("");
    setNewBack("");
  };

  const handleStartEdit = (card) => {
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const handleSaveCard = (cardId) => {
    if (!editFront.trim() || !editBack.trim()) return;
    onUpdateCard(deck.id, cardId, { front: editFront.trim(), back: editBack.trim() });
    setEditingCardId(null);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditFront("");
    setEditBack("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={deck ? "Edit deck" : "New deck"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveDeck} isLoading={isLoading}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Deck Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Biology Chapter 5"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this deck about?"
          rows={2}
        />

        {deck && (
          <>
            <div className="mt-2 border-t border-border pt-5">
              <h4 className="mb-2 flex items-baseline gap-2 text-overline">
                Cards <span className="normal-case tracking-normal">{cards?.length || 0}</span>
              </h4>

              {cards && cards.length > 0 ? (
                <div className="mb-4 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border scrollbar-thin">
                  {cards.map((card) => (
                    <div key={card.id} className="group px-3 py-2.5">
                      {editingCardId === card.id ? (
                        <div className="space-y-2">
                          <Textarea value={editFront} onChange={(e) => setEditFront(e.target.value)} placeholder="Front" rows={2} />
                          <Textarea value={editBack} onChange={(e) => setEditBack(e.target.value)} placeholder="Back" rows={2} />
                          <div className="flex gap-1.5">
                            <Button size="sm" onClick={() => handleSaveCard(card.id)} isLoading={isLoading}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-heading">{card.front}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">{card.back}</p>
                          </div>
                          <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => handleStartEdit(card)} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-heading" aria-label="Edit card">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => onDeleteCard(deck.id, card.id)} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-danger" aria-label="Delete card">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-sm text-muted">No cards yet. Add the first one below.</p>
              )}

              <div className="space-y-2 rounded-lg bg-surface-secondary p-3">
                <Textarea value={newFront} onChange={(e) => setNewFront(e.target.value)} placeholder="Front — the question" rows={2} aria-label="Card front" />
                <Textarea value={newBack} onChange={(e) => setNewBack(e.target.value)} placeholder="Back — the answer" rows={2} aria-label="Card back" />
                <Button size="sm" onClick={handleAddCard} isLoading={isLoading} disabled={!newFront.trim() || !newBack.trim()} leftIcon={<Plus />}>
                  Add card
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
