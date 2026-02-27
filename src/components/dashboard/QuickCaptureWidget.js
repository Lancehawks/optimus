"use client";

import { useState, useRef } from "react";
import { useTaskMutations } from "@/hooks/useTasks";
import { useNoteMutations } from "@/hooks/useNotes";
import { useToast } from "@/components/ui";

const TYPES = [
  { id: "task", label: "Task", icon: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { id: "note", label: "Note", icon: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )},
];

export default function QuickCaptureWidget() {
  const [type, setType] = useState("task");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const inputRef = useRef(null);

  const { addToast } = useToast();
  const { createTask } = useTaskMutations();
  const { createNote } = useNoteMutations();

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      if (type === "task") {
        await createTask({ title: trimmed });
        setSuccessMsg("Task added");
      } else {
        await createNote({ title: trimmed, content: "" });
        setSuccessMsg("Note created");
      }
      setValue("");
      inputRef.current?.focus();
      // Clear success message after 2s
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err) {
      addToast({ type: "error", message: "Failed to create. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-rose-500/10">
          <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <h3 className="text-h4">Quick Capture</h3>
      </div>

      {/* Type selector */}
      <div className="flex gap-1.5 p-1 rounded-lg bg-neutral-800 border border-neutral-700">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-medium transition-all cursor-pointer ${
              type === t.id
                ? "bg-brand-500 text-white shadow-sm"
                : "text-muted hover:text-heading"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "task" ? "What needs to be done?" : "What's on your mind?"}
          disabled={isSubmitting}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-body-sm text-heading placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!value.trim() || isSubmitting}
          className="w-full py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-body-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Capture {type === "task" ? "Task" : "Note"}
            </>
          )}
        </button>
      </form>

      {/* Success flash */}
      {successMsg && (
        <div className="flex items-center gap-2 text-emerald-400 text-body-sm animate-fade-in">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {successMsg}
        </div>
      )}
    </div>
  );
}
