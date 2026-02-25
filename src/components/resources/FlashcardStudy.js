"use client";

import { useState, useEffect, useCallback } from "react";
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
        <div className="p-4 rounded-2xl bg-brand-500/10 text-brand-400 mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-h3 text-heading!">No cards due for review</h3>
        <p className="text-body-sm text-muted! mt-2">Come back later!</p>
        <Button variant="ghost" onClick={onClose} className="mt-6">
          Close
        </Button>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-success-light text-green-500 mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-h3 text-heading!">Session complete!</h3>
        <p className="text-body-sm text-muted! mt-2">
          You reviewed {reviewedCount} {reviewedCount === 1 ? "card" : "cards"}.
        </p>
        <Button onClick={onClose} className="mt-6">
          Close
        </Button>
      </div>
    );
  }

  const card = dueCards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-h4 text-heading!">{deckName}</h3>
          <p className="text-body-sm text-muted!">
            Card {currentIndex + 1} of {dueCards.length}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Exit
        </Button>
      </div>

      <div className="w-full mb-2 h-1 rounded-full bg-neutral-700">
        <div
          className="h-1 rounded-full bg-brand-500 transition-all"
          style={{ width: `${((currentIndex) / dueCards.length) * 100}%` }}
        />
      </div>

      <div
        className="relative min-h-64 w-full cursor-pointer my-8"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className={cn(
            "relative w-full min-h-64 transition-transform duration-500"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center p-8 rounded-2xl border border-border bg-surface-raised"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="text-center">
              <p className="text-caption text-muted! mb-2 uppercase tracking-wider">Question</p>
              <p className="text-h3 text-heading!">{card.front}</p>
              <p className="text-caption text-muted! mt-4">Click to reveal answer</p>
            </div>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center p-8 rounded-2xl border border-border bg-surface-raised"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="text-center">
              <p className="text-caption text-muted! mb-2 uppercase tracking-wider">Answer</p>
              <p className="text-h3 text-heading!">{card.back}</p>
            </div>
          </div>
        </div>
      </div>

      {isFlipped && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => handleRate(0)}
            disabled={isReviewing}
            className="px-5 py-2.5 rounded-xl font-medium text-body-sm bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            Again
          </button>
          <button
            onClick={() => handleRate(2)}
            disabled={isReviewing}
            className="px-5 py-2.5 rounded-xl font-medium text-body-sm bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hard
          </button>
          <button
            onClick={() => handleRate(3)}
            disabled={isReviewing}
            className="px-5 py-2.5 rounded-xl font-medium text-body-sm bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            Good
          </button>
          <button
            onClick={() => handleRate(5)}
            disabled={isReviewing}
            className="px-5 py-2.5 rounded-xl font-medium text-body-sm bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
