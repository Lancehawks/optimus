"use client";

import { useState, useEffect, useCallback } from "react";
import { flashcardDeckService } from "@/services/api";

export function useFlashcardDecks() {
  const [decks, setDecks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await flashcardDeckService.list();
      setDecks(data.decks);
    } catch (error) {
      console.error("Failed to fetch flashcard decks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  return { decks, isLoading, refetch: fetchDecks };
}

export function useDeckCards(deckId) {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!deckId) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await flashcardDeckService.get(deckId);
      setCards(data.cards);
    } catch (error) {
      console.error("Failed to fetch deck cards:", error);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return { cards, isLoading, refetch: fetchCards };
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
