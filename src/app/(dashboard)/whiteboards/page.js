"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Button, EmptyState, ErrorState, Modal, SearchBox, Spinner, useToast } from "@/components/ui";
import { useWhiteboards, useWhiteboardMutations } from "@/hooks/useWhiteboards";
import { whiteboardService } from "@/services/api";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import WhiteboardCard from "@/components/whiteboards/WhiteboardCard";
import WhiteboardModal from "@/components/whiteboards/WhiteboardModal";
import TemplateSelector from "@/components/whiteboards/TemplateSelector";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import { useAuth } from "@/context/AuthContext";
import { loadWhiteboardDraft } from "@/lib/whiteboardDraftStore";

const WhiteboardCanvas = dynamic(() => import("@/components/whiteboards/WhiteboardCanvas"), {
  ssr: false,
  loading: () => <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>,
});
export default function WhiteboardsPage() {
  const { addToast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedWhiteboard, setSelectedWhiteboard] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingWhiteboard, setEditingWhiteboard] = useState(null);
  const contentVersionRef = useRef(1);

  const { whiteboards, error, pagination, isLoading, refetch, hasMore, loadMore, isLoadingMore } = useWhiteboards({
    search: search || undefined,
  });

  const { createWhiteboard, updateWhiteboard, deleteWhiteboard, duplicateWhiteboard, isLoading: mutationLoading } =
    useWhiteboardMutations(refetch);
  const canEditWhiteboard = useCallback((whiteboard) => (
    whiteboard?.user_id === user?.id || whiteboard?.is_project_owner
  ), [user?.id]);
  const canDeleteWhiteboard = useCallback((whiteboard) => (
    whiteboard?.project_id ? Boolean(whiteboard?.is_project_owner) : whiteboard?.user_id === user?.id
  ), [user?.id]);

  // Open whiteboard in editor
  const handleOpen = useCallback(async (wb) => {
    try {
      const data = await whiteboardService.get(wb.id);
      const localDraft = await loadWhiteboardDraft(wb.id).catch(() => null);
      const serverUpdatedAt = new Date(data.whiteboard.updated_at || 0).getTime();
      if (localDraft?.data && localDraft.updatedAt > serverUpdatedAt) {
        data.whiteboard.excalidraw_data = localDraft.data;
        addToast({ message: "Recovered unsaved whiteboard changes from this device.", type: "info" });
      }
      contentVersionRef.current = Number(data.whiteboard.content_version) || 1;
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
      contentVersionRef.current = Number(wb.content_version) || 1;
      setSelectedWhiteboard(wb);
      setIsEditing(true);
      addToast({ message: "Whiteboard created", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [createWhiteboard, addToast]);

  // Auto-save from canvas (handles both excalidrawData and thumbnailUrl)
  const handleAutoSave = useCallback(async (data) => {
    if (!selectedWhiteboard || !canEditWhiteboard(selectedWhiteboard)) return;
    try {
      // data can be { elements, appState, files } or { thumbnailUrl }
      if (data.thumbnailUrl) {
        return await updateWhiteboard(selectedWhiteboard.id, { thumbnailUrl: data.thumbnailUrl });
      } else {
        const updated = await updateWhiteboard(selectedWhiteboard.id, {
          excalidrawData: data,
          contentVersion: contentVersionRef.current,
        });
        contentVersionRef.current = Number(updated.content_version) || contentVersionRef.current + 1;
        setSelectedWhiteboard((current) => (
          current?.id === updated.id
            ? { ...current, content_version: updated.content_version, updated_at: updated.updated_at }
            : current
        ));
        return updated;
      }
    } catch (error) {
      addToast({
        message: error.status === 409
          ? error.message
          : "Whiteboard save failed. Your local draft is preserved; retry before leaving.",
        type: "error",
      });
      throw error;
    }
  }, [selectedWhiteboard, canEditWhiteboard, updateWhiteboard, addToast]);

  // Back to list
  const handleBackToList = useCallback(() => {
    setSelectedWhiteboard(null);
    setIsEditing(false);
    refetch();
  }, [refetch]);

  // Inline rename from canvas toolbar
  const handleCanvasRename = useCallback(async (newTitle) => {
    if (!canEditWhiteboard(selectedWhiteboard)) return;
    try {
      await updateWhiteboard(selectedWhiteboard.id, { title: newTitle });
      setSelectedWhiteboard((prev) => ({ ...prev, title: newTitle }));
    } catch (error) {
      addToast({ message: "Failed to rename whiteboard", type: "error" });
      throw error;
    }
  }, [selectedWhiteboard, canEditWhiteboard, updateWhiteboard, addToast]);

  // Edit (rename + category + project)
  const handleEditSubmit = useCallback(async ({ title, category, projectId }) => {
    try {
      if (editingWhiteboard && canEditWhiteboard(editingWhiteboard)) {
        await updateWhiteboard(editingWhiteboard.id, { title, category, projectId });
        addToast({ message: "Whiteboard updated", type: "success" });
        refetch();
      }
      setShowModal(false);
      setEditingWhiteboard(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [editingWhiteboard, canEditWhiteboard, updateWhiteboard, addToast, refetch]);

  // Delete
  const handleDelete = useCallback(async (id) => {
    const whiteboard = whiteboards.find((item) => item.id === id) || selectedWhiteboard;
    if (!canDeleteWhiteboard(whiteboard)) return;
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
  }, [whiteboards, selectedWhiteboard, canDeleteWhiteboard, deleteWhiteboard, addToast]);

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
    if (!canEditWhiteboard(wb)) return;
    try {
      await updateWhiteboard(wb.id, { isPinned: !wb.is_pinned });
      addToast({ message: wb.is_pinned ? "Unpinned" : "Pinned to top", type: "success" });
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [canEditWhiteboard, updateWhiteboard, addToast, refetch]);

  // Editor view
  if (isEditing && selectedWhiteboard) {
    return (
      <div className="optimus-fullscreen optimus-screen-whiteboards flex h-[calc(100dvh-56px)] flex-col lg:h-[calc(100vh-64px)]">
        <WhiteboardCanvas
          initialData={selectedWhiteboard.excalidraw_data}
          whiteboardId={selectedWhiteboard.id}
          onSave={handleAutoSave}
          onBack={handleBackToList}
          title={selectedWhiteboard.title}
          onRename={handleCanvasRename}
          readOnly={!canEditWhiteboard(selectedWhiteboard)}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="optimus-fullscreen optimus-screen-whiteboards flex h-[calc(100dvh-56px)] flex-col lg:h-[calc(100vh-64px)]">

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
      <div className="optimus-screen-header px-6 pt-6 pb-4 border-b border-border shrink-0">
        <PageHeader
          title="Whiteboards"
          eyebrow="Visual thinking"
          description={search ? `Results for ${search}` : "Map ideas, processes, and decisions visually."}
          className="mb-4 border-0 pb-0"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
            </svg>
          }
          meta={<PageHeaderStat label={pagination.filteredCount === 1 ? "board" : "boards"} value={pagination.filteredCount || 0} tone="brand" />}
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

      {error && (
        <ErrorState compact title="Whiteboards could not be loaded" onRetry={refetch} />
      )}

      {/* Content */}
      <div className="optimus-screen-content flex-1 overflow-y-auto scrollbar-thin p-6">
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
          <>
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
                  canEdit={canEditWhiteboard(wb)}
                  canDelete={canDeleteWhiteboard(wb)}
                />
              ))}
            </div>
            <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
          </>
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
