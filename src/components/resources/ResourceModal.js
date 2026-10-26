"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Link2, Paperclip, X } from "lucide-react";
import { Modal, Input, Textarea, Select, Button, Tabs } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { fileService } from "@/services/api";
import { uploadWorkspaceFile } from "@/lib/uploadClient";
import { UPLOAD_RULES, formatBytes, resourceTypeFor } from "@/lib/uploadRules";

const typeOptions = [
  { value: "pdf", label: "PDF" },
  { value: "doc", label: "Document" },
  { value: "image", label: "Image" },
  { value: "link", label: "Link" },
  { value: "other", label: "Other" },
];

const sourceTabs = [
  { key: "file", label: "Upload a file" },
  { key: "link", label: "Link" },
];

const ACCEPT = UPLOAD_RULES.resource.contentTypes.join(",");

function titleFromFileName(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 255);
}

export default function ResourceModal({ isOpen, onClose, resource, onSave, isLoading }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("link");
  const [source, setSource] = useState("file");
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [upload, setUpload] = useState(null); // { progress } while uploading
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);
  // Files uploaded in this session but not yet saved to the resource.
  const unsavedUploadRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    unsavedUploadRef.current = null;
    setUpload(null);
    setUploadError(null);
    if (resource) {
      setTitle(resource.title || "");
      setType(resource.type || "link");
      setNotes(resource.notes || "");
      if (resource.file_id) {
        setSource("file");
        setFile({ id: resource.file_id, name: resource.file_name || resource.title, size_bytes: resource.file_size_bytes });
        setFileUrl("");
      } else {
        setSource(resource.file_url ? "link" : "file");
        setFile(null);
        setFileUrl(resource.file_url || "");
      }
    } else {
      setTitle("");
      setType("other");
      setSource("file");
      setFile(null);
      setFileUrl("");
      setNotes("");
    }
  }, [resource, isOpen]);

  const discardUnsavedUpload = () => {
    const pending = unsavedUploadRef.current;
    unsavedUploadRef.current = null;
    if (pending) void fileService.delete(pending).catch(() => {});
  };

  const handleClose = () => {
    discardUnsavedUpload();
    onClose();
  };

  const handleFileChosen = async (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen || !user) return;
    setUploadError(null);
    setUpload({ progress: 0 });
    try {
      const saved = await uploadWorkspaceFile(chosen, {
        userId: user.id,
        purpose: "resource",
        onProgress: (progress) => setUpload({ progress }),
      });
      discardUnsavedUpload();
      unsavedUploadRef.current = saved.id;
      setFile(saved);
      setType(resourceTypeFor(saved.content_type));
      if (!title.trim()) setTitle(titleFromFileName(chosen.name));
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUpload(null);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!title.trim() || upload) return;
    const base = { id: resource?.id, title: title.trim(), type, notes: notes.trim() || null };
    if (source === "file" && file) {
      unsavedUploadRef.current = null;
      onSave({ ...base, fileId: file.id });
    } else {
      onSave({ ...base, fileUrl: source === "link" ? fileUrl.trim() || null : null, ...(resource?.file_id ? { fileId: null } : {}) });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={resource ? "Edit resource" : "Add a resource"}
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
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading} disabled={Boolean(upload)}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs size="sm" tabs={sourceTabs} activeTab={source} onChange={setSource} />

        {source === "file" ? (
          <div>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFileChosen} className="sr-only" tabIndex={-1} aria-hidden="true" />
            {upload ? (
              <div className="rounded-xl border border-border px-4 py-3" role="status">
                <p className="text-sm text-heading">Uploading… {Math.round(upload.progress)}%</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${upload.progress}%` }} />
                </div>
              </div>
            ) : file ? (
              <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted">
                  <Paperclip className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-heading">{file.name}</span>
                  {file.size_bytes != null && <span className="block text-xs text-muted">{formatBytes(file.size_bytes)}</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>Replace</Button>
                <button
                  type="button"
                  onClick={() => {
                    discardUnsavedUpload();
                    setFile(null);
                  }}
                  aria-label="Remove file"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-border-strong px-4 py-6 text-center transition-colors hover:bg-surface-secondary"
              >
                <FileUp className="h-5 w-5 text-muted" />
                <span className="text-sm text-heading">Choose a file to upload</span>
                <span className="text-xs text-muted">PDF, documents, images, audio or video · up to {formatBytes(UPLOAD_RULES.resource.maxBytes)}</span>
              </button>
            )}
            {uploadError && <p className="mt-2 text-xs text-danger" role="alert">{uploadError}</p>}
          </div>
        ) : (
          <Input
            label="URL"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            leftIcon={<Link2 />}
          />
        )}

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
