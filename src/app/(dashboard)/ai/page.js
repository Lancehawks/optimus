"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Script from "next/script";
import { EmptyState, Spinner } from "@/components/ui";
import { usePuterAI } from "@/hooks/usePuterAI";
import ChatMessage from "@/components/ai/ChatMessage";
import ChatInput from "@/components/ai/ChatInput";
import ModelSelector from "@/components/ai/ModelSelector";
import { cn } from "@/lib/utils";

function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AIPage() {
  const {
    messages,
    isStreaming,
    model,
    setModel,
    error,
    puterReady,
    setPuterReady,
    sendMessage,
    clearChat,
    chatId,
    chats,
    chatsLoading,
    loadChat,
    deleteChat,
  } = usePuterAI();

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto-scroll: only if user is near the bottom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handlePuterReady = useCallback(() => {
    setPuterReady(true);
  }, [setPuterReady]);

  const handleDeleteChat = useCallback(async (e, id) => {
    e.stopPropagation();
    await deleteChat(id);
  }, [deleteChat]);

  return (
    <>
      <Script
        src="https://js.puter.com/v2/"
        strategy="afterInteractive"
        onReady={handlePuterReady}
      />

      <div className="flex h-screen">
        {/* Chat History Sidebar */}
        <div
          className={cn(
            "border-r border-border bg-surface-secondary flex flex-col shrink-0 transition-all duration-200",
            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
          )}
        >
          {/* Sidebar header */}
          <div className="p-3 border-b border-border shrink-0">
            <button
              onClick={clearChat}
              className="btn-base btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {chatsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : chats.length === 0 ? (
              <p className="text-caption text-center py-8 px-3">No chat history yet</p>
            ) : (
              <div className="py-1">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => loadChat(chat.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-start gap-2 group transition-colors cursor-pointer",
                      chatId === chat.id
                        ? "bg-brand-500/10 text-heading"
                        : "text-muted hover:bg-surface-tertiary hover:text-body"
                    )}
                  >
                    <svg className="h-4 w-4 mt-0.5 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{chat.title}</p>
                      <p className="text-[0.65rem] text-muted mt-0.5">{timeAgo(chat.updated_at)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/15 hover:text-red-400 transition-all shrink-0 cursor-pointer"
                      title="Delete chat"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-body transition-colors cursor-pointer"
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <h1 className="text-h4 text-heading!">AI Assistant</h1>
              <ModelSelector model={model} onModelChange={setModel} />
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="btn-base btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={
                    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  }
                  title="AI Assistant"
                  description="Ask anything. Powered by GPT, Claude, Gemini, DeepSeek and more."
                />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-4 py-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            {error && (
              <div className="max-w-3xl mx-auto px-4 pb-4">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-2.5 text-sm">
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            isStreaming={isStreaming}
            disabled={!puterReady}
          />
        </div>
      </div>
    </>
  );
}
