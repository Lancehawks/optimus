"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Textarea, Select, Button } from "@/components/ui";

const CATEGORIES = [
  { value: "", label: "No category" },
  { value: "Health", label: "Health" },
  { value: "Learning", label: "Learning" },
  { value: "Work", label: "Work" },
  { value: "Personal", label: "Personal" },
  { value: "Wellness", label: "Wellness" },
  { value: "Other", label: "Other" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const PRESET_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

export default function HabitModal({ isOpen, onClose, habit, onSave, isLoading }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    frequency: "daily",
    category: "",
    color: "#22c55e",
  });

  useEffect(() => {
    if (habit) {
      setForm({
        name: habit.name || "",
        description: habit.description || "",
        frequency: habit.frequency || "daily",
        category: habit.category || "",
        color: habit.color || "#22c55e",
      });
    } else {
      setForm({
        name: "",
        description: "",
        frequency: "daily",
        category: "",
        color: "#22c55e",
      });
    }
  }, [habit, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={habit ? "Edit Habit" : "New Habit"}
      footer={
        <>
          {habit && (
            <Button
              variant="danger"
              onClick={() => onSave(null)}
              className="mr-auto"
              disabled={isLoading}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {habit ? "Save Changes" : "Create Habit"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Morning meditation"
          required
        />

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Frequency"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            options={FREQUENCIES}
          />

          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={CATEGORIES}
          />
        </div>

        <div>
          <label className="text-body-sm text-heading! font-medium block mb-1.5">
            Color
          </label>
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
