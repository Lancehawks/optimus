"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUp, ChevronLeft, History, SquarePen, Square, Trash2 } from "lucide-react";
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

function AccessPrompt({ isAdmin, onClose }) {
  return (
    <div className="my-auto py-6">
      <p className="text-sm text-body">
        Ask about your tasks, calendar, projects, notes and routines, such as what&apos;s on your plate today or what&apos;s overdue.
      </p>
      <p className="mt-3 text-sm text-muted">
        To use it, add your own API key, for example a free OpenRouter key, or
        {isAdmin ? " turn on the workspace AI key for yourself on the Admin page." : " ask an admin to let you use the workspace AI key."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/settings#api-keys" onClick={onClose} className="btn-base btn-primary">Add an API key</Link>
        {isAdmin && <Link href="/admin" onClick={onClose} className="btn-base btn-secondary">Open Admin</Link>}
      </div>
    </div>
  );
}

const SOURCE_GROUPS = [
  { key: "workspace", label: (option) => "Workspace key", match: (option) => option.keySource === "workspace" },
  { key: "anthropic", label: () => "Your Anthropic key", match: (option) => option.keySource === "member" && option.provider === "anthropic" },
  { key: "openrouter", label: () => "Your OpenRouter key", match: (option) => option.keySource === "member" && option.provider === "openrouter" },
];

function ModelPicker({ models, value, onChange, disabled, freeExhausted }) {
  if (!models?.length) return null;
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      <span className="sr-only">Model</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-7 min-w-0 max-w-[12rem] cursor-pointer truncate rounded-md border border-border bg-surface px-2 text-xs text-heading hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        title="Model for your next message"
      >
        {SOURCE_GROUPS.map((group) => {
          const options = models.filter(group.match);
          if (options.length === 0) return null;
          return (
            <optgroup key={group.key} label={group.label(options[0])}>
              {options.map((option) => (
                <option key={option.key} value={option.key} disabled={option.free && freeExhausted && option.key !== value}>
                  {option.label}{option.free ? (freeExhausted ? " · free, none left today" : " · free") : ""}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
}

// Offered after a model can't answer: other models the member can use. When
// the free daily allowance is gone, free models are left out (it's shared
// across all of them).
function SwitchModel({ models, current, code, onPick }) {
  const alternatives = (models || [])
    .filter((model) => model.key !== current && (code !== "free_daily_limit" || !model.free))
    .slice(0, 3);
  if (alternatives.length === 0) {
    return code === "free_daily_limit" ? (
      <p className="text-xs text-muted">
        To keep going today, add credits on OpenRouter (buying $10 or more also raises the free limit to 1,000 a day),
        add an Anthropic key, or ask an admin for the workspace AI key.
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">Switch to</span>
      {alternatives.map((model) => (
        <button
          key={model.key}
          type="button"
          onClick={() => onPick(model.key)}
          className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs text-heading transition-colors hover:border-border-strong hover:bg-surface-tertiary"
        >
          {model.label}{model.free ? " (free)" : ""}
        </button>
      ))}
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
      {message.model && !message.pending && (
        <p className="mt-1.5 font-mono text-[0.625rem] text-placeholder">{message.model}</p>
      )}
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
  const [models, setModels] = useState(null);
  const [modelsError, setModelsError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [conversationModel, setConversationModel] = useState(null);
  const [freeQuota, setFreeQuota] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const enabled = Boolean(models?.length);
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

  const loadModels = useCallback(async () => {
    const data = await assistantService.listModels();
    const exhausted = data.freeQuota?.remaining === 0;
    const usable = (key) => data.models.some((model) => model.key === key && !(model.free && exhausted));
    setModels(data.models);
    setFreeQuota(data.freeQuota);
    // Keep the current choice while it's usable; otherwise fall back to the
    // default, then to any model that isn't out of free requests.
    setSelectedModel((current) => {
      if (usable(current)) return current;
      if (usable(data.selected)) return data.selected;
      return data.models.find((model) => usable(model.key))?.key || data.selected;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setModelsError(null);
    loadModels().catch((err) => { if (!cancelled) setModelsError(err.message); });
    return () => { cancelled = true; };
  }, [isOpen, loadModels]);

  useEffect(() => {
    if (!isOpen || view !== "history" || conversations) return;
    let cancelled = false;
    setHistoryError(null);
    assistantService.listConversations()
      .then((data) => { if (!cancelled) setConversations(data.conversations); })
      .catch((err) => { if (!cancelled) setHistoryError(err.message); });
    return () => { cancelled = true; };
  }, [isOpen, view, conversations]);

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
    setConversationModel(null);
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
      setConversationModel(data.conversation.model);
      // Carry on with the conversation's model when it's still available.
      if (models?.some((model) => model.key === data.conversation.model)) setSelectedModel(data.conversation.model);
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
    const modelLabelForReply = models?.find((model) => model.key === selectedModel)?.label || null;
    const questionId = `local-${stamp}`;
    const replyId = `reply-${stamp}`;

    setError(null);
    setErrorCode(null);
    setDraft("");
    setStatus(null);
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: questionId, role: "user", text },
      { id: replyId, role: "assistant", text: "", pending: true, model: modelLabelForReply },
    ]);
    const updateReply = (change) => {
      setMessages((current) => current.map((message) => (message.id === replyId ? change(message) : message)));
    };
    const controller = new AbortController();
    abortRef.current = controller;
    const usedFreeModel = Boolean(models?.find((model) => model.key === selectedModel)?.free);
    let currentConversation = conversationId;

    try {
      await assistantService.sendMessage({
        conversationId,
        text,
        model: selectedModel,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "conversation") {
            currentConversation = event.id;
            setConversationId(event.id);
            setConversationModel(event.model);
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
            setErrorCode(event.code || null);
            // Nothing was kept: take the message back so it can be resent,
            // for example with another model.
            if (event.restoreDraft) {
              setMessages((current) => current.filter((message) => message.id !== questionId && message.id !== replyId));
              setDraft(text);
            }
            if (event.conversationRemoved) {
              currentConversation = null;
              setConversationId(null);
              setConversationModel(null);
            }
          }
        },
      });
    } catch (err) {
      if (err.name === "AbortError") {
        // Stopped: show what the server kept (a message stopped before any
        // reply isn't kept, so it goes back in the box).
        if (currentConversation) {
          assistantService.getConversation(currentConversation)
            .then((data) => {
              setMessages(data.messages);
              if (!data.messages.some((message) => message.role === "user" && message.text === text)) setDraft(text);
            })
            .catch(() => {
              setConversationId(null);
              setConversationModel(null);
              setMessages([]);
              setDraft(text);
            });
        }
      } else {
        // Nothing was saved when the request itself was refused, so the
        // message goes back into the box to send again.
        if (err.status) {
          setMessages((current) => current.filter((message) => message.id !== questionId && message.id !== replyId));
          setDraft(text);
        }
        setError(err.message);
        setErrorCode(err.code || null);
      }
    } finally {
      // Free requests are counted per day; refresh what's left.
      if (usedFreeModel) loadModels().catch(() => {});
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

  const selectedOption = models?.find((model) => model.key === selectedModel) || null;

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
      {!models && !modelsError ? (
        <div className="space-y-3 pt-2">
          {[0, 1].map((row) => <div key={row} className="skeleton h-12" />)}
        </div>
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
            <div className="ml-auto flex min-w-0 items-center gap-0.5">
              {view === "chat" && (
                <ModelPicker
                  models={models}
                  value={selectedModel}
                  onChange={(key) => { setSelectedModel(key); setErrorCode(null); }}
                  disabled={sending}
                  freeExhausted={freeQuota?.remaining === 0}
                />
              )}
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
              {modelsError && <p role="alert" className="text-xs text-danger">{modelsError}</p>}
              {!loadingConversation && messages.length === 0 && !enabled && (
                <AccessPrompt isAdmin={user?.role === "admin"} onClose={onClose} />
              )}
              {!loadingConversation && messages.length === 0 && enabled && (
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
              {(errorCode === "free_daily_limit" || errorCode === "rate_limited") && (
                <SwitchModel
                  models={models}
                  current={selectedModel}
                  code={errorCode}
                  onPick={(key) => {
                    setSelectedModel(key);
                    setError(null);
                    setErrorCode(null);
                    inputRef.current?.focus();
                  }}
                />
              )}
              {enabled && conversationId && conversationModel && selectedModel !== conversationModel && (
                <p className="text-xs text-muted">
                  Your next message goes to {selectedOption?.label || "the selected model"}. It sees this conversation&apos;s
                  text, but not the earlier lookups.
                </p>
              )}
              {selectedOption?.free && (
                <p className={cn("flex items-start gap-1.5 text-xs", freeQuota && freeQuota.remaining <= 5 ? "text-body" : "text-muted")}>
                  {freeQuota && freeQuota.remaining <= 5 && (
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <span>
                    Free model
                    {freeQuota ? `: ${freeQuota.remaining} of ${freeQuota.limit} free requests left today (a question uses about 2 to 6)` : ""}.
                    {" "}Free models are slower and their providers may log what&apos;s sent.
                  </span>
                </p>
              )}
              <div ref={endRef} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
