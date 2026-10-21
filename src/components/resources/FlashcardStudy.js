"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui";
import { flashcardDeckService } from "@/services/api";
import { useFlashcardMutations } from "@/hooks/useFlashcards";

export default function FlashcardStudy({ deckId, deckName, onClose }) {
  const [dueCards, setDueCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);

  const { submitReview, isLoading: isReviewing } = useFlashcardMutations();

  const fetchDueCards = useCallback(async () => {
    setIsLoadingCards(true);
    try {
      const data = await flashcardDeckService.get(deckId);
      const now = new Date();
      const due = (data.cards || []).filter(
        (card) => new Date(card.next_review_at) <= now
      );
      setDueCards(due);
      if (due.length === 0) {
        setSessionComplete(true);
      }
    } catch (error) {
      console.error("Failed to fetch cards for study:", error);
    } finally {
      setIsLoadingCards(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  const handleRate = async (grade) => {
    const card = dueCards[currentIndex];
    await submitReview(deckId, { cardId: card.id, grade });
    const nextReviewed = reviewedCount + 1;
    setReviewedCount(nextReviewed);

    if (currentIndex + 1 < dueCards.length) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setSessionComplete(true);
    }
  };

  // Space flips the card; 1–4 rate it once the answer is showing.
  const rateRef = useRef(handleRate);
  useEffect(() => {
    rateRef.current = handleRate;
  });
  useEffect(() => {
    const grades = { 1: 0, 2: 2, 3: 3, 4: 5 };
    const onKey = (event) => {
      if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (event.key === " ") {
        event.preventDefault();
        setIsFlipped((flipped) => !flipped);
      } else if (isFlipped && event.key in grades && !isReviewing) {
        event.preventDefault();
        rateRef.current(grades[event.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFlipped, isReviewing]);

  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (dueCards.length === 0 && !sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-serif text-3xl text-heading">Nothing due.</p>
        <p className="mt-2 text-sm text-muted">Every card in this deck is scheduled for later.</p>
        <Button variant="secondary" onClick={onClose} className="mt-6">Back to decks</Button>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-serif text-3xl text-heading">Session complete.</p>
        <p className="mt-2 text-sm text-muted">
          You reviewed <span className="font-mono text-heading">{reviewedCount}</span> {reviewedCount === 1 ? "card" : "cards"}.
        </p>
        <Button onClick={onClose} className="mt-6">Back to decks</Button>
      </div>
    );
  }

  const card = dueCards[currentIndex];
  const ratings = [
    { value: 0, label: "Again", key: "1" },
    { value: 2, label: "Hard", key: "2" },
    { value: 3, label: "Good", key: "3" },
    { value: 5, label: "Easy", key: "4" },
  ];

  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-heading">{deckName}</p>
          <p className="font-mono text-xs tabular-nums text-muted">
            {currentIndex + 1} / {dueCards.length}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>End session</Button>
      </div>

      <div className="h-0.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
        <div className="h-full rounded-full bg-heading transition-all" style={{ width: `${(currentIndex / dueCards.length) * 100}%` }} />
      </div>

      <button
        type="button"
        className="relative my-8 block min-h-72 w-full cursor-pointer text-left"
        style={{ perspective: "1200px" }}
        onClick={() => setIsFlipped(!isFlipped)}
        aria-label={isFlipped ? "Show question" : "Reveal answer"}
      >
        <div
          className="relative min-h-72 w-full transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-overline">Question</p>
            <p className="mt-4 font-serif text-[2rem] leading-tight text-heading">{card.front}</p>
            <p className="mt-6 text-xs text-muted">Click or press space to reveal</p>
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-secondary p-10 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-overline">Answer</p>
            <p className="mt-4 font-serif text-[2rem] leading-tight text-heading">{card.back}</p>
          </div>
        </div>
      </button>

      {isFlipped && (
        <div className="grid animate-slide-up grid-cols-4 gap-2">
          {ratings.map((rating) => (
            <button
              key={rating.value}
              type="button"
              onClick={() => handleRate(rating.value)}
              disabled={isReviewing}
              className="flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-heading transition-colors hover:border-border-strong hover:bg-surface-secondary disabled:opacity-50"
            >
              {rating.label}
              <kbd className="text-[0.625rem] text-muted">{rating.key}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
