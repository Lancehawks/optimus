"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Select, Button } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";

const CATEGORY_OPTIONS = [
  { value: "", label: "No category" },
  { value: "Design", label: "Design" },
  { value: "Architecture", label: "Architecture" },
  { value: "Brainstorm", label: "Brainstorm" },
  { value: "Wireframe", label: "Wireframe" },
  { value: "Flowchart", label: "Flowchart" },
  { value: "Planning", label: "Planning" },
  { value: "Other", label: "Other" },
];

export default function WhiteboardModal({ isOpen, onClose, onSubmit, whiteboard, isLoading }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const isEditing = !!whiteboard;

  const { projects } = useProjects();

  useEffect(() => {
    if (isOpen) {
      setTitle(whiteboard?.title || "");
      setCategory(whiteboard?.category || "");
      setProjectId(whiteboard?.project_id || "");
    }
  }, [isOpen, whiteboard]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      category: category || null,
      projectId: projectId || null,
    });
  };

  const projectOptions = [
    { value: "", label: "No project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Whiteboard" : "New Whiteboard"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {isEditing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          id="whiteboardTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My whiteboard"
          autoFocus
        />
        <Select
          label="Category"
          id="whiteboardCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={CATEGORY_OPTIONS}
        />
        <Select
          label="Project"
          id="whiteboardProject"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projectOptions}
        />
      </form>
    </Modal>
  );
}
