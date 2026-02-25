"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Textarea, Select, Button } from "@/components/ui";

const typeOptions = [
  { value: "pdf", label: "PDF" },
  { value: "doc", label: "Document" },
  { value: "image", label: "Image" },
  { value: "link", label: "Link" },
  { value: "other", label: "Other" },
];

export default function ResourceModal({ isOpen, onClose, resource, onSave, isLoading }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("link");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (resource) {
      setTitle(resource.title || "");
      setType(resource.type || "link");
      setFileUrl(resource.file_url || "");
      setNotes(resource.notes || "");
    } else {
      setTitle("");
      setType("link");
      setFileUrl("");
      setNotes("");
    }
  }, [resource, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: resource?.id,
      title: title.trim(),
      type,
      fileUrl: fileUrl.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resource ? "Edit Resource" : "Add Resource"}
      footer={
        <>
          {resource && (
            <Button
              variant="danger"
              onClick={() => onSave({ id: resource.id, _delete: true })}
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
          placeholder="Resource title"
          required
        />
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={typeOptions}
        />
        <Input
          label="URL / File Link"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://..."
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this resource..."
          rows={3}
        />
      </form>
    </Modal>
  );
}
