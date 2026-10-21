"use client";

import { useState, useCallback } from "react";
import { Check, ChevronRight, ListChecks, MoreHorizontal, Plus, X } from "lucide-react";
import { Button, EmptyState, ErrorState, useToast } from "@/components/ui";
import { useChecklist } from "@/hooks/useChecklist";
import { checklistService } from "@/services/api";
import ChecklistSectionModal from "./ChecklistSectionModal";
import { cn } from "@/lib/utils";

export default function ChecklistView() {
  const { addToast } = useToast();
  const { sections, todayLogs, error, isLoading, refetch } = useChecklist();
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
      <div className="space-y-3">
        {[0, 1].map((row) => <div key={row} className="skeleton h-28" />)}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <>
        <EmptyState
          icon={<ListChecks />}
          title="No routines yet"
          description="Group the habits you want to keep, like a morning or end-of-day routine."
          action={{
            leftIcon: <Plus />,
            children: "New section",
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

  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <>
      {error && <ErrorState compact className="mb-4" title="Checklist couldn't be loaded" onRetry={refetch} />}

      {totalCount > 0 && (
        <div className="mb-8">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-serif text-2xl text-heading">{allDone ? "All done for today." : "Today"}</span>
            <span className="font-mono text-xs tabular-nums text-muted">
              {completedCount}/{totalCount} · {progressPct}%
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-tertiary">
            <div className={cn("h-full rounded-full transition-all duration-500", allDone ? "bg-success" : "bg-heading")} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => {
          const items = section.items || [];
          const sectionDone = items.filter((item) => todayLogs[item.id]).length;
          const isCollapsed = collapsedSections[section.id];

          return (
            <section key={section.id} className="card overflow-hidden">
              <div
                className="group/section flex cursor-pointer items-center gap-2.5 px-4 py-3 transition-colors hover:bg-surface-secondary"
                onClick={() => toggleCollapse(section.id)}
              >
                <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", !isCollapsed && "rotate-90")} />
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: section.color }} />
                <span className="flex-1 text-sm font-semibold text-heading">{section.name}</span>
                <span className="font-mono text-xs tabular-nums text-muted">{sectionDone}/{items.length}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSection(section);
                    setShowModal(true);
                  }}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-heading group-hover/section:opacity-100"
                  aria-label={`Edit ${section.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {!isCollapsed && (
                <div className="border-t border-border">
                  {items.map((item) => {
                    const checked = !!todayLogs[item.id];
                    return (
                      <div key={item.id} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-secondary">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(item.id)}
                          aria-pressed={checked}
                          aria-label={checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
                          className={cn(
                            "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-[1.5px] transition-colors",
                            checked ? "border-transparent text-white" : "border-border-strong hover:border-heading"
                          )}
                          style={checked ? { backgroundColor: section.color || "var(--brand-500)" } : undefined}
                        >
                          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </button>
                        <span className={cn("flex-1 text-sm transition-colors", checked ? "text-muted line-through decoration-border-strong" : "text-heading")}>
                          {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-3 border-t border-border px-4 py-1.5">
                    <Plus className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      type="text"
                      placeholder="Add an item"
                      aria-label={`Add an item to ${section.name}`}
                      className="flex-1 bg-transparent py-1 text-sm text-heading outline-none placeholder:text-placeholder"
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
            </section>
          );
        })}
      </div>

      <Button
        variant="ghost"
        leftIcon={<Plus />}
        className="mt-4"
        onClick={() => {
          setEditingSection(null);
          setShowModal(true);
        }}
      >
        New section
      </Button>

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
