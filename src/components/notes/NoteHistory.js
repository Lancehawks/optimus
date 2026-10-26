"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { History, RotateCcw } from "lucide-react";
import { Button, EmptyState, ErrorState, Modal, Spinner } from "@/components/ui";
import { noteService } from "@/services/api";
import { cn } from "@/lib/utils";

const NotePreview = dynamic(() => import("@/components/notes/NoteEditor").then((mod) => mod.NotePreview), {
  ssr: false,
  loading: () => <div className="flex h-40 items-center justify-center"><Spinner /></div>,
});

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function versionTime(version) {
  return timeFormat.format(new Date(version.edited_at || version.created_at));
}

// Earlier versions of a note, with a read-only preview and restore.
export default function NoteHistory({ isOpen, onClose, noteId, canRestore, onRestore }) {
  const [versions, setVersions] = useState(null);
  const [listError, setListError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!isOpen || !noteId) return undefined;
    let active = true;
    setVersions(null);
    setListError(null);
    setPreview(null);
    noteService.versions(noteId)
      .then((data) => {
        if (!active) return;
        setVersions(data.versions || []);
        setSelectedId(data.versions?.[0]?.id || null);
      })
      .catch((error) => active && setListError(error));
    return () => {
      active = false;
    };
  }, [isOpen, noteId]);

  useEffect(() => {
    if (!selectedId || !noteId) return undefined;
    let active = true;
    setPreview(null);
    setPreviewError(null);
    noteService.version(noteId, selectedId)
      .then((data) => active && setPreview(data.version))
      .catch((error) => active && setPreviewError(error));
    return () => {
      active = false;
    };
  }, [noteId, selectedId]);

  const handleRestore = async () => {
    if (!preview) return;
    setRestoring(true);
    try {
      await onRestore(preview);
      onClose();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Version history"
      size="xl"
      footer={canRestore ? (
        <>
          <span className="mr-auto text-xs text-muted">The current version is kept in history when you restore.</span>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handleRestore} isLoading={restoring} disabled={!preview} leftIcon={<RotateCcw />}>
            Restore this version
          </Button>
        </>
      ) : undefined}
    >
      {listError ? (
        <ErrorState compact title="History couldn't be loaded" description={listError.message} />
      ) : versions === null ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : versions.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No earlier versions yet"
          description="A version is saved every 10 minutes while you write, and before any restore."
        />
      ) : (
        <div className="grid min-h-[24rem] gap-4 sm:grid-cols-[13rem_1fr]">
          <ol className="max-h-[60vh] space-y-1 overflow-y-auto pr-1 scrollbar-thin" aria-label="Versions">
            {versions.map((version) => (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(version.id)}
                  aria-current={version.id === selectedId}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-colors",
                    version.id === selectedId ? "bg-surface-tertiary" : "hover:bg-surface-secondary"
                  )}
                >
                  <span className="block text-sm text-heading">{versionTime(version)}</span>
                  <span className="block truncate text-xs text-muted">{version.edited_by_name || "Unknown"}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="max-h-[60vh] min-w-0 overflow-y-auto rounded-xl border border-border scrollbar-thin">
            {previewError ? (
              <ErrorState compact className="m-3" title="This version couldn't be loaded" description={previewError.message} />
            ) : !preview ? (
              <div className="flex h-40 items-center justify-center"><Spinner /></div>
            ) : (
              <div className="py-4">
                <h3 className="px-(--note-gutter) pb-2 font-serif text-2xl text-heading note-column">{preview.title}</h3>
                <div className="note-column">
                  <NotePreview key={preview.id} blocks={preview.content_blocks} content={preview.content} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
