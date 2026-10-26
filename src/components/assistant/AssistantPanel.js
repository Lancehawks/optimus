"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  Copy,
  FolderKanban,
  History,
  Info,
  Sparkles,
  Square,
  SquarePen,
  Sun,
  Trash2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { assistantService } from "@/services/api";
import { cn, formatShortDate } from "@/lib/utils";
import AssistantMarkdown from "./AssistantMarkdown";
import ModelMenu from "./ModelMenu";

const SUGGESTIONS = [
  { text: "What's on my plate today?", hint: "Events, due and overdue tasks", icon: Sun },
  { text: "What's overdue?", hint: "Everything past its due date", icon: CircleAlert },
  { text: "What does the rest of my week look like?", hint: "The days ahead, at a glance", icon: CalendarDays },
  { text: "Which projects need attention?", hint: "Behind schedule or blocked", icon: FolderKanban },
];

// The assistant's mark beside its replies and in the panel title.
function AssistantMark({ className }) {
  return (
    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-primary", className)} aria-hidden="true">
      <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

// Quiet notices under the conversation; danger for failures.
function Notice({ tone = "info", icon: Icon = Info, children }) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-5",
        tone === "danger" ? "bg-danger-light text-body" : "bg-surface-secondary text-body"
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted")} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}

const MAX_INPUT_HEIGHT = 160;

function iconButtonClass(active = false) {
  return cn(
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-tertiary hover:text-heading disabled:cursor-not-allowed disabled:opacity-50",
    active && "bg-surface-tertiary text-heading"
  );
}

const PROVIDER_NAMES = { anthropic: "Anthropic", openrouter: "OpenRouter" };

function AccessPrompt({ isAdmin, keyProviders = [], onClose }) {
  // A saved key with nothing to pick: its models haven't passed a check yet.
  if (keyProviders.length > 0) {
    const names = keyProviders.map((id) => PROVIDER_NAMES[id] || id).join(" and ");
    return (
      <div className="my-auto py-6">
        <p className="text-sm text-body">
          Your {names} key is saved, but none of its models are switched on yet. Each model has to pass a quick check
          before anyone can use it, so the assistant only runs on models that handle your workspace correctly.
        </p>
        <p className="mt-3 text-sm text-muted">
          {isAdmin
            ? "Run the checks on the Models tab and switch on the models that pass. They'll then appear in this chat."
            : "Ask an admin to check and switch on models from the Admin page. They'll then appear in this chat."}
        </p>
        {isAdmin && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/admin?tab=models" onClick={onClose} className="btn-base btn-primary">Check models</Link>
          </div>
        )}
      </div>
    );
  }
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

// Offered after a model can't answer: other models the member can use. When
// the free daily allowance is gone, free models are left out (it's shared
// across all of them).
function SwitchModel({ models, current, code, onPick }) {
  const alternatives = (models || [])
    .filter((model) => model.key !== current && (code !== "free_daily_limit" || !model.free))
    .slice(0, 3);
  if (alternatives.length === 0) {
    return code === "free_daily_limit" ? (
      <p className="text-muted">
        To keep going today, add credits on OpenRouter (buying $10 or more also raises the free limit to 1,000 a day),
        add an Anthropic key, or ask an admin for the workspace AI key.
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted">Switch to</span>
      {alternatives.map((model) => (
        <button
          key={model.key}
          type="button"
          onClick={() => onPick(model.key)}
          className="cursor-pointer rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-heading transition-colors hover:border-border-strong"
        >
          {model.label}{model.free ? " · free" : ""}
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be refused; nothing else to do.
        }
      }}
      className="flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[0.6875rem] text-muted opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-heading focus-visible:opacity-100 group-hover:opacity-100"
      aria-label={copied ? "Copied" : "Copy reply"}
    >
      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Message({ message, status, onNavigate }) {
  if (message.role === "user") {
    return (
      <div className="flex animate-fade-in justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-surface-tertiary px-3.5 py-2 text-sm leading-6 text-heading">
          {message.text}
        </p>
      </div>
    );
  }
  return (
    <div className="group flex min-w-0 animate-fade-in gap-3">
      <AssistantMark className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {message.text && <AssistantMarkdown text={message.text} onNavigate={onNavigate} />}
        {message.pending ? (
          <p className={cn("flex items-center gap-2 text-xs text-muted", message.text && "mt-2")} aria-live="polite">
            <Spinner size="sm" label="Working" />
            <span className="animate-pulse-soft">{status || (message.text ? "Writing…" : "Thinking…")}</span>
          </p>
        ) : (
          <div className="mt-1.5 flex h-6 items-center gap-2">
            {message.model && <span className="font-mono text-[0.625rem] text-placeholder">{message.model}</span>}
            {message.text && <CopyButton text={message.text} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistantPanel({ isOpen, onClose, prompt = null, onPromptHandled = () => {} }) {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(/\s+/)[0] || null;
  const [models, setModels] = useState(null);
  const [modelsError, setModelsError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [conversationModel, setConversationModel] = useState(null);
  const [freeQuota, setFreeQuota] = useState(null);
  const [keyProviders, setKeyProviders] = useState([]);
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
  const sendRef = useRef(null);
  const [conversationTitle, setConversationTitle] = useState(null);

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
    setKeyProviders(data.keyProviders || []);
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
    setConversationTitle(null);
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
      setConversationTitle(data.conversation.title);
      // Carry on with the conversation's model when it's still available.
      if (models?.some((model) => model.key === data.conversation.model)) setSelectedModel(data.conversation.model);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingConversation(false);
    }
  };

  // `fresh` starts a new conversation, even if one is open.
  const send = async (raw, { fresh = false } = {}) => {
    const text = raw.trim();
    if (!text || sending) return;
    const targetConversation = fresh ? null : conversationId;
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
    let currentConversation = targetConversation;

    try {
      await assistantService.sendMessage({
        conversationId: targetConversation,
        text,
        model: selectedModel,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "conversation") {
            currentConversation = event.id;
            setConversationId(event.id);
            setConversationModel(event.model);
            setConversationTitle(event.title);
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
              setConversationTitle(null);
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

  // The latest `send`, for the effect below; effects run in order, so this
  // is current by the time that one reads it.
  useEffect(() => {
    sendRef.current = send;
  });

  // Opened with a question (for example from Today): ask it in a new
  // conversation once the models are known.
  useEffect(() => {
    if (!isOpen || !prompt || !models) return;
    if (models.length > 0) {
      setView("chat");
      setConversationId(null);
      setConversationModel(null);
      setConversationTitle(null);
      setMessages([]);
      setError(null);
      sendRef.current(prompt, { fresh: true });
    }
    onPromptHandled();
  }, [isOpen, prompt, models, onPromptHandled]);

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
    <form onSubmit={handleSubmit} className="w-full">
      <div className="rounded-xl border border-border bg-surface shadow-xs transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[var(--shadow-focus)]">
        <label htmlFor="assistant-input" className="sr-only">Ask the assistant</label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          placeholder={conversationId ? "Ask a follow-up" : "Ask about your day, tasks, projects or notes"}
          className="block max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm leading-6 text-heading placeholder:text-placeholder focus:outline-none"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <ModelMenu
            models={models}
            value={selectedModel}
            onChange={(key) => { setSelectedModel(key); setErrorCode(null); }}
            disabled={sending}
            freeExhausted={freeQuota?.remaining === 0}
          />
          <span className="ml-auto hidden text-[0.6875rem] text-placeholder sm:block">
            {sending ? "Answering…" : "Enter to send · Shift+Enter for a new line"}
          </span>
          {sending ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="btn-base btn-secondary ml-auto h-8 w-8 shrink-0 rounded-lg px-0! sm:ml-0"
              aria-label="Stop the reply"
              title="Stop"
            >
              <Square className="h-3 w-3" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="btn-base btn-primary ml-auto h-8 w-8 shrink-0 rounded-lg px-0! sm:ml-0"
              aria-label="Send"
              title="Send (Enter)"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={<span className="flex items-center gap-2"><AssistantMark />Assistant</span>}
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
              <p className="min-w-0 truncate px-1.5 text-xs font-medium text-body" title={conversationTitle || undefined}>
                {conversationId ? conversationTitle || "Conversation" : "New conversation"}
              </p>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
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
                <AccessPrompt isAdmin={user?.role === "admin"} keyProviders={keyProviders} onClose={onClose} />
              )}
              {!loadingConversation && messages.length === 0 && enabled && (
                <div className="my-auto animate-fade-in py-6">
                  <AssistantMark className="h-9 w-9 rounded-xl [&_svg]:h-4.5 [&_svg]:w-4.5" />
                  <h3 className="mt-4 font-serif text-[1.75rem] leading-8 text-heading">
                    {firstName ? `What would you like to know, ${firstName}?` : "What would you like to know?"}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    Ask in your own words. It looks things up in your tasks, calendar, projects, notes and routines.
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map(({ text, hint, icon: Icon }) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => send(text)}
                        className="group flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-secondary"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-muted transition-colors group-hover:text-primary">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-5 text-heading">{text}</span>
                          <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-6 text-xs text-placeholder">
                    It reads your workspace but can&apos;t change anything yet.
                  </p>
                </div>
              )}
              {messages.map((message) => (
                <Message key={message.id} message={message} status={status} onNavigate={onClose} />
              ))}
              {error && (
                <Notice tone="danger" icon={CircleAlert}>
                  <p>{error}</p>
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
                </Notice>
              )}
              {enabled && conversationId && conversationModel && selectedModel !== conversationModel && (
                <Notice>
                  <p>
                    Your next message goes to <span className="font-medium text-heading">{selectedOption?.label || "the selected model"}</span>.
                    It sees this conversation&apos;s text, but not the earlier lookups.
                  </p>
                </Notice>
              )}
              {selectedOption?.free && (
                <Notice tone={freeQuota && freeQuota.remaining <= 5 ? "warning" : "info"} icon={freeQuota && freeQuota.remaining <= 5 ? AlertTriangle : Info}>
                  <p>
                    {freeQuota
                      ? <><span className="font-medium text-heading">{freeQuota.remaining} of {freeQuota.limit}</span> free requests left today. A question uses about 2 to 6.</>
                      : "Free model."}
                    {" "}Free models are slower, and their providers may log what&apos;s sent.
                  </p>
                </Notice>
              )}
              <div ref={endRef} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
