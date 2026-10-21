"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/components/ui";
import { EVENT_COLOR_OPTIONS, FOCUS_BLOCK_COLOR } from "@/lib/eventDisplay";

const PRESET_COLORS = EVENT_COLOR_OPTIONS.map((color) => color.value);

export default function DayPlanBlockModal({ isOpen, onClose, block, onSave, onDelete, isLoading }) {
  const [form, setForm] = useState({
    title: "",
    start_time: "09:00",
    end_time: "10:00",
    color: FOCUS_BLOCK_COLOR,
  });

  useEffect(() => {
    if (block) {
      setForm({
        title: block.title || "",
        start_time: (block.start_time || "09:00").slice(0, 5),
        end_time: (block.end_time || "10:00").slice(0, 5),
        color: block.color || FOCUS_BLOCK_COLOR,
      });
    } else {
      setForm({ title: "", start_time: "09:00", end_time: "10:00", color: FOCUS_BLOCK_COLOR });
    }
  }, [block, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.end_time <= form.start_time) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={block ? "Edit time block" : "New time block"}
      footer={
        <>
          {block && onDelete && (
            <Button variant="ghost" onClick={() => onDelete(block.id)} className="mr-auto text-danger! hover:bg-danger-light!" disabled={isLoading}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>{block ? "Save" : "Add block"}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Deep work, exercise, admin…"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Starts" type="time" className="font-mono" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <Input
            label="Ends"
            type="time"
            className="font-mono"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            error={form.end_time <= form.start_time ? "Must be after the start" : ""}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-heading">Colour</p>
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Block colour">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.color === c}
                aria-label={`Colour ${c}`}
                className={`h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110 ${form.color === c ? "ring-2 ring-heading ring-offset-2 ring-offset-surface" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setForm({ ...form, color: c })}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
