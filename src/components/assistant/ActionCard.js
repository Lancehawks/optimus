"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Info, X } from "lucide-react";
import Spinner from "@/components/ui/Spinner";

const OPEN_LABELS = {
  create_task: "Open task",
  update_task: "Open task",
  create_note: "Open note",
  append_to_note: "Open note",
  create_event: "Open calendar",
  update_event: "Open calendar",
  plan_my_day: "Open calendar",
  move_tasks: "Open tasks",
  add_subtasks: "Open task",
  add_to_sprint: "Open sprints",
  complete_routine: "Open routines",
  save_memory: "Open settings",
};

function Outcome({ action, onNavigate }) {
  if (action.status === "cancelled") {
    return <p className="flex items-center gap-1.5 text-xs text-muted"><X className="h-3.5 w-3.5" aria-hidden="true" />Cancelled. Nothing was changed.</p>;
  }
  if (action.status === "failed") {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-xs text-body">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
        {action.result?.error || "That couldn't be done."}
      </p>
    );
  }
  if (action.status === "applying") {
    return <p className="text-xs text-muted">This didn&apos;t finish. Check whether the change went through before trying again.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-heading">
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        Done
        {action.result?.href && (
          <Link href={action.result.href} onClick={onNavigate} className="ml-1 font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
            {OPEN_LABELS[action.tool] || "Open"}
          </Link>
        )}
      </p>
      {action.result?.warning && <p className="text-xs text-muted">{action.result.warning}</p>}
    </div>
  );
}

// A change the assistant drafted. Every detail shown came from the server, and
// long text is shown whole so nothing goes in unseen.
export default function ActionCard({ action, onDecide, onNavigate, disabled = false }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const { card } = action;
  const pending = action.status === "pending";

  const decide = async (decision) => {
    setBusy(decision);
    setError(null);
    try {
      await onDecide(action.id, decision);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label={card.title} className="mt-3 rounded-xl border border-border bg-surface p-3 first:mt-0">
      <h4 className="text-xs font-semibold text-heading">{card.title}</h4>
      <dl className="mt-2 space-y-1">
        {card.fields?.map((field) => (
          <div key={field.label} className="flex gap-2 text-xs leading-5">
            <dt className="w-16 shrink-0 text-muted">{field.label}</dt>
            <dd className="min-w-0 flex-1 break-words text-heading">{field.value}</dd>
          </div>
        ))}
      </dl>
      {card.body && (
        <div className="mt-2">
          <p className="text-xs text-muted">{card.body.label}</p>
          <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-secondary px-2.5 py-2 text-xs leading-5 text-body">
            {card.body.text}
          </p>
        </div>
      )}
      {card.notice && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-body">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          {card.notice}
        </p>
      )}
      <div className="mt-3">
        {pending ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => decide("confirm")} disabled={Boolean(busy) || disabled} className="btn-base btn-primary h-8 px-3 text-xs">
              {busy === "confirm" ? <Spinner size="sm" label="Applying" /> : "Confirm"}
            </button>
            <button type="button" onClick={() => decide("cancel")} disabled={Boolean(busy) || disabled} className="btn-base btn-secondary h-8 px-3 text-xs">
              Cancel
            </button>
          </div>
        ) : (
          <Outcome action={action} onNavigate={onNavigate} />
        )}
        {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
