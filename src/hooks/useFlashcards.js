"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { flashcardDeckService } from "@/services/api";

const NO_DECKS = [];
const NO_CARDS = [];

export function useFlashcardDecks() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["flashcard-decks", "list"],
    queryFn: async () => (await flashcardDeckService.list()).decks,
  });
  return { decks: data ?? NO_DECKS, error, isLoading, refetch };
}

export function useDeckCards(deckId) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["flashcard-decks", "cards", deckId],
    queryFn: async () => (await flashcardDeckService.get(deckId)).cards,
    enabled: Boolean(deckId),
  });
  return { cards: (deckId && !error && data) || NO_CARDS, error, isLoading, refetch };
}

export function useFlashcardMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createDeck = async (data) => {
    setIsLoading(true);
    try {
      const result = await flashcardDeckService.create(data);
      onSuccess?.();
      return result.deck;
    } finally {
      setIsLoading(false);
    }
  };

  const updateDeck = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await flashcardDeckService.update(id, data);
      onSuccess?.();
      return result.deck;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDeck = async (id) => {
    setIsLoading(true);
    try {
      await flashcardDeckService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const addCard = async (deckId, data) => {
    setIsLoading(true);
    try {
      const result = await flashcardDeckService.addCard(deckId, data);
      onSuccess?.();
      return result.card;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCard = async (deckId, cardId, data) => {
    setIsLoading(true);
    try {
      const result = await flashcardDeckService.updateCard(deckId, cardId, data);
      onSuccess?.();
      return result.card;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCard = async (deckId, cardId) => {
    setIsLoading(true);
    try {
      await flashcardDeckService.deleteCard(deckId, cardId);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  const submitReview = async (deckId, data) => {
    setIsLoading(true);
    try {
      const result = await flashcardDeckService.submitReview(deckId, data);
      return result.card;
    } finally {
      setIsLoading(false);
    }
  };

  return { createDeck, updateDeck, deleteDeck, addCard, updateCard, deleteCard, submitReview, isLoading };
}
