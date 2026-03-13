"use client";

import { useState, useCallback } from "react";
import { Button, Spinner, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui";
import { useChecklist } from "@/hooks/useChecklist";
import { checklistService } from "@/services/api";
import ChecklistSectionModal from "./ChecklistSectionModal";
import { cn } from "@/lib/utils";

export default function ChecklistView() {
  const { addToast } = useToast();
  const { sections, todayLogs, isLoading, refetch } = useChecklist();
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [mutating, setMutating] = useState(false);
  const [newItemInputs, setNewItemInputs] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});

  // Compute progress
  const allItems = sections.flatMap((s) => s.items || []);
  const completedCount = allItems.filter((item) => todayLogs[item.id]).length;
  const totalCount = allItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleCollapse = (sectionId) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSaveSection = useCallback(async (form) => {
    setMutating(true);
    try {
      if (editingSection) {
        await checklistService.updateSection(editingSection.id, form);
        addToast({ message: "Section updated", type: "success" });
      } else {
        await checklistService.createSection(form);
        addToast({ message: "Section created", type: "success" });
      }
      setShowModal(false);
      setEditingSection(null);
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setMutating(false);
    }
  }, [editingSection, refetch, addToast]);

  const handleDeleteSection = useCallback(async (id) => {
    setMutating(true);
    try {
      await checklistService.deleteSection(id);
      addToast({ message: "Section deleted", type: "success" });
      setShowModal(false);
      setEditingSection(null);
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setMutating(false);
    }
  }, [refetch, addToast]);

  const handleToggleItem = useCallback(async (itemId) => {
    try {
      const isCompleted = !!todayLogs[itemId];
      await checklistService.toggleLog({ item_id: itemId, completed: !isCompleted });
      refetch();
    } catch (error) {
      addToast({ message: "Failed to update", type: "error" });
    }
  }, [todayLogs, refetch, addToast]);

  const handleAddItem = useCallback(async (sectionId) => {
    const name = (newItemInputs[sectionId] || "").trim();
    if (!name) return;
    try {
      await checklistService.addItem(sectionId, { name });
      setNewItemInputs((prev) => ({ ...prev, [sectionId]: "" }));
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [newItemInputs, refetch, addToast]);

  const handleDeleteItem = useCallback(async (itemId) => {
    try {
      await checklistService.deleteItem(itemId);
      refetch();
      addToast({ message: "Item removed", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [refetch, addToast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <>
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          }
          title="No checklist yet"
          description="Create sections and items for your daily routine"
          action={{
            children: "New Section",
            onClick: () => { setEditingSection(null); setShowModal(true); },
          }}
        />
        <ChecklistSectionModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingSection(null); }}
          section={editingSection}
          onSave={handleSaveSection}
          onDelete={handleDeleteSection}
          isLoading={mutating}
        />
      </>
    );
  }

  return (
    <>
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-body-sm text-muted">Today's checklist</span>
            <span
              className="text-body-sm font-semibold"
              style={{ color: completedCount === totalCount ? "#22c55e" : undefined }}
            >
              {completedCount === totalCount ? "All done!" : `${completedCount} / ${totalCount}`}
            </span>
          </div>
          <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                backgroundColor: completedCount === totalCount ? "#22c55e" : "#14b8a6",
              }}
            />
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const items = section.items || [];
          const sectionDone = items.filter((item) => todayLogs[item.id]).length;
          const isCollapsed = collapsedSections[section.id];

          return (
            <div key={section.id} className="card overflow-hidden">
              {/* Section header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                onClick={() => toggleCollapse(section.id)}
              >
                <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: section.color }} />
                <svg
                  className={cn("h-4 w-4 text-muted transition-transform shrink-0", !isCollapsed && "rotate-90")}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <span className="text-body font-medium text-heading flex-1">{section.name}</span>
                <span className="text-caption text-muted">{sectionDone}/{items.length}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSection(section);
                    setShowModal(true);
                  }}
                  className="btn-ghost rounded-lg p-1.5 cursor-pointer opacity-0 group-hover:opacity-100 hover:opacity-100"
                  style={{ opacity: undefined }}
                >
                  <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                </button>
              </div>

              {/* Items */}
              {!isCollapsed && (
                <div className="border-t border-border">
                  {items.map((item) => {
                    const checked = !!todayLogs[item.id];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-secondary/30 transition-colors group"
                      >
                        <button
                          onClick={() => handleToggleItem(item.id)}
                          className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all",
                            checked
                              ? "border-transparent"
                              : "border-neutral-600 hover:border-neutral-500"
                          )}
                          style={checked ? { backgroundColor: section.color } : undefined}
                        >
                          {checked && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                        <span className={cn(
                          "text-body-sm flex-1 transition-all",
                          checked ? "text-muted line-through" : "text-heading"
                        )}>
                          {item.name}
                        </span>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="btn-ghost rounded-lg p-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  {/* Add item input */}
                  <div className="flex items-center gap-3 px-4 py-2 border-t border-border/50">
                    <svg className="h-4 w-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Add item..."
                      className="flex-1 bg-transparent text-body-sm text-heading placeholder:text-placeholder outline-none py-1"
                      value={newItemInputs[section.id] || ""}
                      onChange={(e) => setNewItemInputs((prev) => ({ ...prev, [section.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem(section.id);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section button */}
      <button
        onClick={() => { setEditingSection(null); setShowModal(true); }}
        className="mt-4 w-full py-3 border-2 border-dashed border-border rounded-xl text-muted hover:text-heading hover:border-neutral-500 transition-colors cursor-pointer text-body-sm font-medium flex items-center justify-center gap-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Section
      </button>

      <ChecklistSectionModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingSection(null); }}
        section={editingSection}
        onSave={handleSaveSection}
        onDelete={handleDeleteSection}
        isLoading={mutating}
      />
    </>
  );
}
