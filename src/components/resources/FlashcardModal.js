"use client";

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
      title={deck ? "Edit Deck" : "Create Deck"}
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
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-body-sm font-medium text-heading! mb-3">Cards</h4>

              {cards && cards.length > 0 ? (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto scrollbar-thin">
                  {cards.map((card) => (
                    <div key={card.id} className="p-3 rounded-lg bg-surface-raised border border-border">
                      {editingCardId === card.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            placeholder="Front"
                            rows={2}
                          />
                          <Textarea
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            placeholder="Back"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveCard(card.id)} isLoading={isLoading}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-body-sm text-heading! truncate">
                              <span className="text-muted!">Q:</span> {card.front}
                            </p>
                            <p className="text-body-sm text-muted! truncate mt-0.5">
                              <span>A:</span> {card.back}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEdit(card)}
                              className="btn-ghost rounded-lg p-1 cursor-pointer"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onDeleteCard(deck.id, card.id)}
                              className="btn-ghost rounded-lg p-1 cursor-pointer text-danger! hover:bg-danger-light"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-muted! mb-4">No cards yet. Add your first card below.</p>
              )}

              <div className="p-3 rounded-lg border border-dashed border-border space-y-2">
                <p className="text-body-sm font-medium text-heading!">Add Card</p>
                <Textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="Front (question)"
                  rows={2}
                />
                <Textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Back (answer)"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={handleAddCard}
                  isLoading={isLoading}
                  disabled={!newFront.trim() || !newBack.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
