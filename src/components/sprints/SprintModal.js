"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, DatePicker, Input, Modal, Textarea, useToast } from "@/components/ui";
import { sprintService } from "@/services/api";
import { toLocalDateStr } from "@/lib/utils";

const deleteMessages = {
  planned: "Delete this sprint? Its tasks go back to your backlog.",
  active: "Delete this sprint? Its tasks go back to your backlog.",
  completed: "Delete this sprint's record? Its tasks stay in your task list.",
};

// DatePicker parses its value with new Date(), which reads a bare date as UTC.
const pickerValue = (date) => (date ? `${date}T00:00:00` : "");

/** Create or edit a sprint. `defaults` fills a new one. */
export default function SprintModal({ isOpen, onClose, sprint, defaults, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ name: "", goal: "", startDate: "", endDate: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(sprint
      ? { name: sprint.name, goal: sprint.goal || "", startDate: sprint.start_date, endDate: sprint.end_date }
      : { name: "", goal: "", startDate: "", endDate: "", ...defaults });
  }, [defaults, isOpen, sprint]);

  const setField = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const data = { ...form, goal: form.goal.trim() || null };
      const result = sprint ? await sprintService.update(sprint.id, data) : await sprintService.create(data);
      addToast({ message: sprint ? "Sprint updated" : "Sprint created", type: "success" });
      onSaved?.(result.sprint);
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(deleteMessages[sprint.status])) return;
    setIsSaving(true);
    try {
      await sprintService.delete(sprint.id);
      addToast({ message: "Sprint deleted", type: "success" });
      onSaved?.(null);
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const footer = (
    <>
      {sprint && (
        <Button variant="ghost" onClick={handleDelete} disabled={isSaving} className="mr-auto text-danger! hover:bg-danger-light!" leftIcon={<Trash2 />}>
          Delete
        </Button>
      )}
      <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
      <Button onClick={handleSubmit} isLoading={isSaving}>{sprint ? "Save changes" : "Create sprint"}</Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sprint ? "Edit sprint" : "New sprint"}
      placement="right"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="sprintName"
          label="Name"
          value={form.name}
          onChange={(event) => setField("name")(event.target.value)}
          maxLength={255}
          required
        />
        <Textarea
          id="sprintGoal"
          label="Goal"
          value={form.goal}
          onChange={(event) => setField("goal")(event.target.value)}
          placeholder="What will make this sprint a success?"
          maxLength={2000}
          rows={3}
        />
        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            label="Starts"
            value={pickerValue(form.startDate)}
            onChange={(date) => setField("startDate")(date ? toLocalDateStr(date) : "")}
          />
          <DatePicker
            label="Ends"
            value={pickerValue(form.endDate)}
            onChange={(date) => setField("endDate")(date ? toLocalDateStr(date) : "")}
          />
        </div>
      </form>
    </Modal>
  );
}
