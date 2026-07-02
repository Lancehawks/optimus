"use client";

import { useState, useCallback } from "react";
import { Button, EmptyState, Modal, SearchBox, Spinner, useToast } from "@/components/ui";
import { useWhiteboards, useWhiteboardMutations } from "@/hooks/useWhiteboards";
import { whiteboardService } from "@/services/api";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import WhiteboardCard from "@/components/whiteboards/WhiteboardCard";
import WhiteboardModal from "@/components/whiteboards/WhiteboardModal";
import WhiteboardCanvas from "@/components/whiteboards/WhiteboardCanvas";
import TemplateSelector from "@/components/whiteboards/TemplateSelector";
export default function WhiteboardsPage() {
  const { addToast } = useToast();

  const [search, setSearch] = useState("");
  const [selectedWhiteboard, setSelectedWhiteboard] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingWhiteboard, setEditingWhiteboard] = useState(null);

  const { whiteboards, isLoading, refetch } = useWhiteboards({
    search: search || undefined,
  });

  const { createWhiteboard, updateWhiteboard, deleteWhiteboard, duplicateWhiteboard, isLoading: mutationLoading } =
    useWhiteboardMutations(refetch);

  // Open whiteboard in editor
  const handleOpen = useCallback(async (wb) => {
    try {
      const data = await whiteboardService.get(wb.id);
      setSelectedWhiteboard(data.whiteboard);
      setIsEditing(true);
    } catch (error) {
      addToast({ message: "Failed to open whiteboard", type: "error" });
    }
  }, [addToast]);

  // Create from template
  const handleCreateFromTemplate = useCallback(async (template) => {
    try {
      const wb = await createWhiteboard({
        title: template.name === "blank" ? "Untitled" : template.label,
        excalidrawData: template.data,
      });
      setShowTemplates(false);
      setSelectedWhiteboard(wb);
      setIsEditing(true);
      addToast({ message: "Whiteboard created", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [createWhiteboard, addToast]);

  // Auto-save from canvas (handles both excalidrawData and thumbnailUrl)
  const handleAutoSave = useCallback(async (data) => {
    if (!selectedWhiteboard) return;
    try {
      // data can be { elements, appState, files } or { thumbnailUrl }
      if (data.thumbnailUrl) {
        await updateWhiteboard(selectedWhiteboard.id, { thumbnailUrl: data.thumbnailUrl });
      } else {
        await updateWhiteboard(selectedWhiteboard.id, { excalidrawData: data });
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, [selectedWhiteboard, updateWhiteboard]);

  // Back to list
  const handleBackToList = useCallback(() => {
    setSelectedWhiteboard(null);
    setIsEditing(false);
    refetch();
  }, [refetch]);

  // Inline rename from canvas toolbar
  const handleCanvasRename = useCallback(async (newTitle) => {
    try {
      await updateWhiteboard(selectedWhiteboard.id, { title: newTitle });
      setSelectedWhiteboard((prev) => ({ ...prev, title: newTitle }));
    } catch (error) {
      addToast({ message: "Failed to rename whiteboard", type: "error" });
    }
  }, [selectedWhiteboard, updateWhiteboard, addToast]);

  // Edit (rename + category + project)
  const handleEditSubmit = useCallback(async ({ title, category, projectId }) => {
    try {
      if (editingWhiteboard) {
        await updateWhiteboard(editingWhiteboard.id, { title, category, projectId });
        addToast({ message: "Whiteboard updated", type: "success" });
        refetch();
      }
      setShowModal(false);
      setEditingWhiteboard(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [editingWhiteboard, updateWhiteboard, addToast, refetch]);

  // Delete
  const handleDelete = useCallback(async (id) => {
    try {
      await deleteWhiteboard(id);
      addToast({ message: "Whiteboard deleted", type: "success" });
      if (selectedWhiteboard?.id === id) {
        setSelectedWhiteboard(null);
        setIsEditing(false);
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [deleteWhiteboard, addToast, selectedWhiteboard]);

  // Duplicate
  const handleDuplicate = useCallback(async (id) => {
    try {
      await duplicateWhiteboard(id);
      addToast({ message: "Board duplicated", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [duplicateWhiteboard, addToast]);

  // Toggle pin
  const handleTogglePin = useCallback(async (wb) => {
    try {
      await updateWhiteboard(wb.id, { isPinned: !wb.is_pinned });
      addToast({ message: wb.is_pinned ? "Unpinned" : "Pinned to top", type: "success" });
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [updateWhiteboard, addToast, refetch]);

  // Editor view
  if (isEditing && selectedWhiteboard) {
    return (
      <div className="h-screen flex flex-col">
        <WhiteboardCanvas
          initialData={selectedWhiteboard.excalidraw_data}
          onSave={handleAutoSave}
          onBack={handleBackToList}
          title={selectedWhiteboard.title}
          onRename={handleCanvasRename}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="flex flex-col h-screen">

      {/* ── Mobile gate — whiteboards need a real pointer device ── */}
      <div className="lg:hidden flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-surface flex items-center justify-center mb-5 border border-border">
          <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </div>
        <h2 className="text-h3 mb-2">Whiteboards</h2>
        <p className="text-body text-muted max-w-xs">
          Please open Optimus on a laptop or desktop computer to use Whiteboards.
        </p>
      </div>

      {/* ── Desktop content ── */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <PageHeader
          title="Whiteboards"
          description={search ? `Search: ${search}` : "All boards"}
          className="mb-4 border-0 pb-0"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
            </svg>
          }
          meta={<PageHeaderStat label={whiteboards.length === 1 ? "board" : "boards"} value={whiteboards.length} tone="brand" />}
          actions={
            <Button
              onClick={() => setShowTemplates(true)}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              New Board
            </Button>
          }
        />
        <SearchBox
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search boards..."
          className="max-w-xs"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : whiteboards.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
            }
            title="No whiteboards yet"
            description={
              search
                ? "No boards match your search"
                : "Create your first whiteboard to start drawing"
            }
            action={
              !search
                ? { children: "New Board", onClick: () => setShowTemplates(true) }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {whiteboards.map((wb) => (
              <WhiteboardCard
                key={wb.id}
                whiteboard={wb}
                onClick={() => handleOpen(wb)}
                onDelete={() => handleDelete(wb.id)}
                onDuplicate={() => handleDuplicate(wb.id)}
                onTogglePin={() => handleTogglePin(wb)}
                onRename={() => {
                  setEditingWhiteboard(wb);
                  setShowModal(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template selector modal */}
      <Modal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        title="Choose a template"
        size="md"
      >
        <TemplateSelector onSelect={handleCreateFromTemplate} />
      </Modal>

      {/* Edit modal */}
      <WhiteboardModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingWhiteboard(null);
        }}
        onSubmit={handleEditSubmit}
        whiteboard={editingWhiteboard}
        isLoading={mutationLoading}
      />
      </div>{/* end desktop content */}
    </div>
  );
}
