"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/components/ui";

const PRESET_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export default function ChecklistSectionModal({ isOpen, onClose, section, onSave, onDelete, isLoading }) {
  const [form, setForm] = useState({ name: "", color: "#6366f1" });

  useEffect(() => {
    if (section) {
      setForm({ name: section.name || "", color: section.color || "#6366f1" });
    } else {
      setForm({ name: "", color: "#6366f1" });
    }
  }, [section, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={section ? "Edit Section" : "New Section"}
      footer={
        <>
          {section && onDelete && (
            <Button variant="danger" onClick={() => onDelete(section.id)} className="mr-auto" disabled={isLoading}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {section ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Section Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Morning Routine"
          required
        />
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
