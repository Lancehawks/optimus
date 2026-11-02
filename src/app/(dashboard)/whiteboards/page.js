"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { PenTool, Plus } from "lucide-react";
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
      <div className="page-fill">
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
    <div className="page">
      <div className="flex flex-col items-center px-4 py-20 text-center lg:hidden">
        <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-secondary text-muted">
          <PenTool className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-title">Whiteboards</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">Whiteboards need a pointer. Open Optimus on a laptop or desktop to draw.</p>
      </div>

      <div className="hidden lg:block">
        <PageHeader
          title="Whiteboards"
          meta={<PageHeaderStat label={pagination.filteredCount === 1 ? "board" : "boards"} value={pagination.filteredCount || 0} />}
          actions={
            <Button onClick={() => setShowTemplates(true)} leftIcon={<Plus />}>
              New board
            </Button>
          }
        />

        <div className="mb-6 max-w-xs">
          <SearchBox value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search boards" />
        </div>

        {error && <ErrorState compact className="mb-4" title="Whiteboards couldn't be loaded" onRetry={refetch} />}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="card overflow-hidden">
                <div className="skeleton aspect-[4/3] rounded-none" />
                <div className="p-3.5"><div className="skeleton h-3.5 w-2/3" /></div>
              </div>
            ))}
          </div>
        ) : whiteboards.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<PenTool />}
              title={search ? "No matching boards" : "A blank canvas"}
              description={search ? "Try a different search." : "Sketch flows, wireframes and systems. Start blank or from a template."}
              action={!search ? { children: "New board", onClick: () => setShowTemplates(true), leftIcon: <Plus /> } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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

        <Modal isOpen={showTemplates} onClose={() => setShowTemplates(false)} title="Start a board" size="lg">
          <TemplateSelector onSelect={handleCreateFromTemplate} />
        </Modal>

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
      </div>
    </div>
  );
}
