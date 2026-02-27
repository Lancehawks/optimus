"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Textarea, Select, Button } from "@/components/ui";

export default function BookmarkModal({
  isOpen,
  onClose,
  bookmark,
  collections,
  tags,
  onSave,
  isLoading,
}) {
  const [form, setForm] = useState({
    url: "",
    title: "",
    description: "",
    collectionId: "",
    tags: [],
  });

  useEffect(() => {
    if (bookmark) {
      setForm({
        url: bookmark.url || "",
        title: bookmark.title || "",
        description: bookmark.description || "",
        collectionId: bookmark.collection_id || "",
        tags: bookmark.tags ? bookmark.tags.map((t) => t.id) : [],
      });
    } else {
      setForm({
        url: "",
        title: "",
        description: "",
        collectionId: "",
        tags: [],
      });
    }
  }, [bookmark]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      url: form.url,
      title: form.title,
      description: form.description,
      collectionId: form.collectionId || null,
      tags: form.tags,
    });
  };

  const toggleTag = (tagId) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((id) => id !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  const collectionOptions = [
    { value: "", label: "No collection" },
    ...collections.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={bookmark ? "Edit Link" : "Add Link"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="URL"
          type="url"
          value={form.url}
          onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
          placeholder="https://example.com"
          required
          autoFocus
        />

        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Title (auto-fetched if empty)"
        />

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description..."
          rows={3}
        />

        <Select
          label="Collection"
          value={form.collectionId}
          onChange={(e) => setForm((prev) => ({ ...prev, collectionId: e.target.value }))}
          options={collectionOptions}
        />

        {/* Tag picker */}
        {tags && tags.length > 0 && (
          <div>
            <label className="text-body-sm font-medium text-heading! mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isSelected = form.tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="inline-flex text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border"
                    style={{
                      backgroundColor: isSelected ? tag.color + "30" : "transparent",
                      color: tag.color,
                      borderColor: isSelected ? tag.color : tag.color + "40",
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {bookmark ? "Save Changes" : "Add Link"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
