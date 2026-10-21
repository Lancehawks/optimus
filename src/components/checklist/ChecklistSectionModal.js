"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/components/ui";

const PRESET_COLORS = [
  "#0d6b88",
  "#3868c6",
  "#3598b0",
  "#27836c",
  "#dfb63b",
  "#cf5c63",
  "#745388",
  "#a85078",
];

export default function ChecklistSectionModal({ isOpen, onClose, section, onSave, onDelete, isLoading }) {
  const [form, setForm] = useState({ name: "", color: "#0d6b88" });

  useEffect(() => {
    if (section) {
      setForm({ name: section.name || "", color: section.color || "#0d6b88" });
    } else {
      setForm({ name: "", color: "#0d6b88" });
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
      title={section ? "Edit section" : "New section"}
      footer={
        <>
          {section && onDelete && (
            <Button variant="ghost" onClick={() => onDelete(section.id)} className="mr-auto text-danger! hover:bg-danger-light!" disabled={isLoading}>
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
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Morning, Evening, Weekly review…"
          required
        />
        <div>
          <p className="mb-1.5 text-xs font-medium text-heading">Colour</p>
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Section colour">
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
