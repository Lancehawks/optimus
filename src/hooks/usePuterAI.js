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

  // Convert a File to a data URL for display
  const fileToDataURL = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

  // Send a message with persistence
  const sendMessage = useCallback(async (text, files = []) => {
    if ((!text.trim() && files.length === 0) || isStreaming) return;
    if (typeof puter === "undefined") {
      setError("AI engine is still loading. Please wait a moment.");
      return;
    }

    setError(null);
    abortRef.current = false;

    // Build image previews for display
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const otherFiles = files.filter((f) => !f.type.startsWith("image/"));
    const imagePreviews = await Promise.all(
      imageFiles.map((f) => fileToDataURL(f))
    );

    const attachmentInfo = otherFiles.length > 0
      ? otherFiles.map((f) => f.name).join(", ")
      : "";

    const displayContent = text || (files.length > 0 ? `[Attached ${files.length} file${files.length > 1 ? "s" : ""}]` : "");

    const userMsg = {
      id: Date.now(),
      role: "user",
      content: displayContent,
      images: imagePreviews,
      fileNames: otherFiles.map((f) => f.name),
    };
    const assistantId = Date.now() + 1;
    const assistantMsg = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    let activeChatId = chatId;

    try {
      // Create a new chat if none active
      if (!activeChatId) {
        const titleText = text.trim() || `Files: ${files.map((f) => f.name).join(", ")}`;
        const title = titleText.length > 50 ? titleText.slice(0, 50) + "..." : titleText;
        const data = await aiChatService.create({ title, model });
        activeChatId = data.chat.id;
        setChatId(activeChatId);
        setChats((prev) => [data.chat, ...prev]);
      }

      // Save user message to DB (text only — files are not persisted)
      const dbContent = attachmentInfo
        ? `${text}\n\n[Attached files: ${attachmentInfo}]`
        : text;
      await aiChatService.addMessage(activeChatId, {
        role: "user",
        content: dbContent || displayContent,
      });

      // Build conversation history for puter.ai.chat
      const history = [...messages, { role: "user", content: text || "Describe what you see in the attached files." }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call puter.ai.chat — pass image files separately
      let response;
      if (imageFiles.length > 0) {
        // puter.ai.chat supports File objects for images
        const imageArg = imageFiles.length === 1 ? imageFiles[0] : imageFiles;
        response = await puter.ai.chat(
          text || "Describe what you see in the attached image(s).",
          imageArg,
          {
            model,
            stream: true,
          }
        );
      } else {
        response = await puter.ai.chat(history, {
          model,
          stream: true,
        });
      }

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
