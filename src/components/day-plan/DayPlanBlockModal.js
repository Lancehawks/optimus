"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/components/ui";

const PRESET_COLORS = [
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#22c55e",
  "#ec4899",
];

export default function DayPlanBlockModal({ isOpen, onClose, block, onSave, onDelete, isLoading }) {
  const [form, setForm] = useState({
    title: "",
    start_time: "09:00",
    end_time: "10:00",
    color: "#14b8a6",
  });

  useEffect(() => {
    if (block) {
      setForm({
        title: block.title || "",
        start_time: (block.start_time || "09:00").slice(0, 5),
        end_time: (block.end_time || "10:00").slice(0, 5),
        color: block.color || "#14b8a6",
      });
    } else {
      setForm({ title: "", start_time: "09:00", end_time: "10:00", color: "#14b8a6" });
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
      title={block ? "Edit Time Block" : "New Time Block"}
      footer={
        <>
          {block && onDelete && (
            <Button variant="danger" onClick={() => onDelete(block.id)} className="mr-auto" disabled={isLoading}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {block ? "Save" : "Add Block"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Morning Exercise"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Start Time</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-body-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">End Time</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-body-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
        </div>

        {form.end_time <= form.start_time && (
          <p className="text-caption text-red-400">End time must be after start time</p>
        )}

        <div>
          <label className="text-body-sm text-heading! font-medium block mb-1.5">Color</label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-8 h-8 rounded-lg cursor-pointer transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: form.color === c ? `2px solid ${c}` : "none",
                  outlineOffset: form.color === c ? "2px" : "0",
                }}
                onClick={() => setForm({ ...form, color: c })}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
