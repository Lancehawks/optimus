"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronLeft, History, SquarePen, Square, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { assistantService } from "@/services/api";
import { cn, formatShortDate } from "@/lib/utils";
import AssistantMarkdown from "./AssistantMarkdown";

const SUGGESTIONS = [
  "What's on my plate today?",
  "What's overdue?",
  "What does the rest of my week look like?",
  "Which projects need attention?",
];

const MAX_INPUT_HEIGHT = 160;

function iconButtonClass(active = false) {
  return cn(
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-tertiary hover:text-heading disabled:cursor-not-allowed disabled:opacity-50",
    active && "bg-surface-tertiary text-heading"
  );
}

function OptInPrompt({ onClose }) {
  return (
    <div className="py-6">
      <p className="text-sm text-body">
        Ask about your tasks, calendar, projects, notes and routines, such as what&apos;s on your plate today or what&apos;s overdue.
      </p>
      <p className="mt-3 text-sm text-muted">
        The assistant is off until you turn it on. When it&apos;s on, your questions and the workspace items it looks up to
        answer them are sent to Anthropic to write each reply.
      </p>
      <Link href="/settings#assistant" onClick={onClose} className="btn-base btn-primary mt-5">
        Turn on in Settings
      </Link>
    </div>
  );
}

function ConversationList({ conversations, error, onOpen, onDeleted }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const remove = async (id) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setDeletingId(id);
    try {
      await assistantService.deleteConversation(id);
      onDeleted(id);
    } catch {
      // The row stays; the member can try again.
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  if (error) return <p className="py-6 text-sm text-danger">{error}</p>;
  if (!conversations) {
    return (
      <div className="space-y-2 py-2">
        {[0, 1, 2].map((row) => <div key={row} className="skeleton h-10" />)}
      </div>
    );
  }
  if (conversations.length === 0) {
    return <p className="py-6 text-sm text-muted">No conversations yet.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {conversations.map((conversation) => (
        <li key={conversation.id} className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => onOpen(conversation.id)}
            className="min-w-0 flex-1 cursor-pointer rounded-md px-2 py-2 text-left hover:bg-surface-tertiary"
          >
            <span className="block truncate text-sm text-heading">{conversation.title}</span>
            <span className="block font-mono text-[0.6875rem] text-muted">{formatShortDate(conversation.updated_at)}</span>
          </button>
          <button
            type="button"
            onClick={() => remove(conversation.id)}
            onBlur={() => setConfirmingId((current) => (current === conversation.id ? null : current))}
            disabled={deletingId === conversation.id}
            className={cn(
              "flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-md px-2 text-xs transition-colors",
              confirmingId === conversation.id
                ? "bg-danger-light font-medium text-danger"
                : "w-7 px-0 text-muted hover:bg-surface-tertiary hover:text-heading"
            )}
            aria-label={confirmingId === conversation.id ? "Confirm delete" : `Delete ${conversation.title}`}
          >
            {confirmingId === conversation.id ? "Delete" : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Message({ message, status, onNavigate }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-surface-tertiary px-3.5 py-2 text-sm leading-6 text-heading">
          {message.text}
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      {message.text && <AssistantMarkdown text={message.text} onNavigate={onNavigate} />}
      {message.pending && (
        <p className={cn("flex items-center gap-2 text-xs text-muted", message.text && "mt-2")} aria-live="polite">
          <Spinner size="sm" label="Working" />
          {status || (message.text ? "Writing…" : "Thinking…")}
        </p>
      )}
    </div>
  );
}

export default function AssistantPanel({ isOpen, onClose }) {
  const { user } = useAuth();
  const enabled = Boolean(user?.ai_assistant_enabled_at);
  const [view, setView] = useState("chat");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !enabled || view !== "chat") return undefined;
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, enabled, view]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  useEffect(() => {
    if (!isOpen || !enabled || view !== "history" || conversations) return;
    let cancelled = false;
    setHistoryError(null);
    assistantService.listConversations()
      .then((data) => { if (!cancelled) setConversations(data.conversations); })
      .catch((err) => { if (!cancelled) setHistoryError(err.message); });
    return () => { cancelled = true; };
  }, [isOpen, enabled, view, conversations]);

  // Stop a reply that is still streaming when the workspace unmounts (sign-out).
  useEffect(() => () => abortRef.current?.abort(), []);

  const resizeInput = useCallback(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resizeInput();
  }, [draft, resizeInput]);

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setView("chat");
  };

  const openConversation = async (id) => {
    abortRef.current?.abort();
    setView("chat");
    setError(null);
    setConversationId(id);
    setMessages([]);
    setLoadingConversation(true);
    try {
      const data = await assistantService.getConversation(id);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingConversation(false);
    }
  };

  const send = async (raw) => {
    const text = raw.trim();
    if (!text || sending) return;
    const stamp = Date.now();
    const questionId = `local-${stamp}`;
    const replyId = `reply-${stamp}`;

    setError(null);
    setDraft("");
    setStatus(null);
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: questionId, role: "user", text },
      { id: replyId, role: "assistant", text: "", pending: true },
    ]);
    const updateReply = (change) => {
      setMessages((current) => current.map((message) => (message.id === replyId ? change(message) : message)));
    };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await assistantService.sendMessage({
        conversationId,
        text,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "conversation") {
            setConversationId(event.id);
            setConversations(null);
          } else if (event.type === "status") {
            setStatus(event.label);
          } else if (event.type === "text") {
            setStatus(null);
            updateReply((message) => ({ ...message, text: message.text + event.text }));
          } else if (event.type === "done") {
            updateReply((message) => ({ ...message, text: event.reply, pending: false }));
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        // Nothing was saved when the request itself was refused, so the
        // message goes back into the box to send again.
        if (err.status) {
          setMessages((current) => current.filter((message) => message.id !== questionId && message.id !== replyId));
          setDraft(text);
        }
        setError(err.message);
      }
    } finally {
      setMessages((current) => current.flatMap((message) => {
        if (message.id !== replyId) return [message];
        return message.text ? [{ ...message, pending: false }] : [];
      }));
      setSending(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    send(draft);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  const composer = enabled && view === "chat" ? (
    <form onSubmit={handleSubmit} className="flex w-full items-end gap-2">
      <label htmlFor="assistant-input" className="sr-only">Ask the assistant</label>
      <textarea
        id="assistant-input"
        ref={inputRef}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={4000}
        placeholder="Ask about your tasks, calendar or projects"
        className="input-base focus:input-focus min-h-9 flex-1 resize-none leading-5!"
      />
      {sending ? (
        <button
          type="button"
          onClick={() => abortRef.current?.abort()}
          className="btn-base btn-secondary h-9 w-9 shrink-0 px-0!"
          aria-label="Stop the reply"
          title="Stop"
        >
          <Square className="h-3.5 w-3.5" fill="currentColor" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!draft.trim()}
          className="btn-base btn-primary h-9 w-9 shrink-0 px-0!"
          aria-label="Send"
          title="Send (Enter)"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </form>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assistant"
      description="Answers from your workspace. It can't make changes yet."
      placement="right"
      size="md"
      footer={composer}
      bodyClassName="flex flex-col"
    >
      {!enabled ? (
        <OptInPrompt onClose={onClose} />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-5 flex items-center gap-1 border-b border-border bg-surface px-5 pb-2">
            {view === "history" ? (
              <button type="button" onClick={() => setView("chat")} className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-surface-tertiary hover:text-heading">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <p className="px-1.5 text-overline">{conversationId ? "Conversation" : "New conversation"}</p>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setView(view === "history" ? "chat" : "history")}
                className={iconButtonClass(view === "history")}
                aria-label="Past conversations"
                title="Past conversations"
                aria-pressed={view === "history"}
              >
                <History className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={startNewConversation}
                disabled={sending}
                className={iconButtonClass()}
                aria-label="New conversation"
                title="New conversation"
              >
                <SquarePen className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {view === "history" ? (
            <div className="pt-2">
              <ConversationList
                conversations={conversations}
                error={historyError}
                onOpen={openConversation}
                onDeleted={(id) => {
                  setConversations((current) => current?.filter((conversation) => conversation.id !== id) || null);
                  if (id === conversationId) startNewConversation();
                }}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-5 pt-4">
              {loadingConversation && (
                <div className="space-y-3">
                  {[0, 1].map((row) => <div key={row} className="skeleton h-12" />)}
                </div>
              )}
              {!loadingConversation && messages.length === 0 && (
                <div className="my-auto py-8">
                  <h3 className="font-serif text-[1.5rem] leading-7 text-heading">What would you like to know?</h3>
                  <p className="mt-1.5 text-sm text-muted">
                    It looks things up in your tasks, calendar, projects, notes and routines.
                  </p>
                  <div className="mt-5 flex flex-col items-start gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-left text-sm text-body transition-colors hover:border-border-strong hover:text-heading"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <Message key={message.id} message={message} status={status} onNavigate={onClose} />
              ))}
              {error && <p role="alert" className="text-xs text-danger">{error}</p>}
              <div ref={endRef} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
