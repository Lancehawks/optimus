"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { aiChatService } from "@/services/api";

export const AI_MODELS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { value: "deepseek-r1", label: "DeepSeek R1" },
];

export function usePuterAI() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState(AI_MODELS[0].value);
  const [error, setError] = useState(null);
  const [puterReady, setPuterReady] = useState(false);

  // Persistence state
  const [chatId, setChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  const abortRef = useRef(false);

  // Load chat list on mount
  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = useCallback(async () => {
    try {
      setChatsLoading(true);
      const data = await aiChatService.list();
      setChats(data.chats || []);
    } catch {
      // Silently fail — user may not have tables yet
      setChats([]);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  // Load a specific chat
  const loadChat = useCallback(async (id) => {
    try {
      setError(null);
      const data = await aiChatService.get(id);
      setChatId(id);
      setModel(data.chat.model || AI_MODELS[0].value);
      setMessages(
        (data.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );
    } catch {
      setError("Failed to load chat");
    }
  }, []);

  // Delete a chat
  const deleteChat = useCallback(async (id) => {
    try {
      await aiChatService.delete(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatId === id) {
        setChatId(null);
        setMessages([]);
      }
    } catch {
      setError("Failed to delete chat");
    }
  }, [chatId]);

  // Send a message with persistence
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;
    if (typeof puter === "undefined") {
      setError("AI engine is still loading. Please wait a moment.");
      return;
    }

    setError(null);
    abortRef.current = false;

    const userMsg = { id: Date.now(), role: "user", content: text };
    const assistantId = Date.now() + 1;
    const assistantMsg = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    let activeChatId = chatId;

    try {
      // Create a new chat if none active
      if (!activeChatId) {
        const title = text.length > 50 ? text.slice(0, 50) + "..." : text;
        const data = await aiChatService.create({ title, model });
        activeChatId = data.chat.id;
        setChatId(activeChatId);
        setChats((prev) => [data.chat, ...prev]);
      }

      // Save user message to DB
      await aiChatService.addMessage(activeChatId, {
        role: "user",
        content: text,
      });

      // Build conversation history for puter.ai.chat
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await puter.ai.chat(history, {
        model,
        stream: true,
      });

      let fullContent = "";

      for await (const part of response) {
        if (abortRef.current) break;
        const token = part?.text || "";
        if (token) {
          fullContent += token;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + token }
                : m
            )
          );
        }
      }

      // Save assistant message to DB after streaming completes
      if (fullContent && activeChatId && !abortRef.current) {
        await aiChatService.addMessage(activeChatId, {
          role: "assistant",
          content: fullContent,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to get a response");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, model, isStreaming, chatId]);

  // New chat (reset without deleting)
  const clearChat = useCallback(() => {
    abortRef.current = true;
    setChatId(null);
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    model,
    setModel,
    error,
    puterReady,
    setPuterReady,
    sendMessage,
    clearChat,
    // Persistence
    chatId,
    chats,
    chatsLoading,
    loadChat,
    deleteChat,
    loadChats,
  };
}
