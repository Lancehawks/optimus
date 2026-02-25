"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Select, Button } from "@/components/ui";

const statusOptions = [
  { value: "unread", label: "Unread" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
];

export default function ReadingListModal({ isOpen, onClose, item, onSave, isLoading }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("unread");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setUrl(item.url || "");
      setStatus(item.status || "unread");
      setProgress(item.progress || 0);
    } else {
      setTitle("");
      setUrl("");
      setStatus("unread");
      setProgress(0);
    }
  }, [item, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: item?.id,
      title: title.trim(),
      url: url.trim() || null,
      status,
      progress: Math.min(100, Math.max(0, parseInt(progress) || 0)),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? "Edit Reading Item" : "Add to Reading List"}
      footer={
        <>
          {item && (
            <Button
              variant="danger"
              onClick={() => onSave({ id: item.id, _delete: true })}
              isLoading={isLoading}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you reading?"
          required
        />
        <Input
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={statusOptions}
        />
        <Input
          label="Progress"
          type="number"
          value={progress}
          onChange={(e) => setProgress(e.target.value)}
          min={0}
          max={100}
          placeholder="0-100"
        />
      </form>
    </Modal>
  );
}
