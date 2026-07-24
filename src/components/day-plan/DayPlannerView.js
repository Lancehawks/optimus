"use client";

import { useState, useCallback } from "react";
import { Badge, Button, EmptyState, ErrorState, Spinner, useToast } from "@/components/ui";
import { useDayPlan, useDayPlanStatus } from "@/hooks/useDayPlan";
import { dayPlanService } from "@/services/api";
import DayPlanBlockModal from "./DayPlanBlockModal";
import DayPlanReview from "./DayPlanReview";
import { cn } from "@/lib/utils";

function formatTime(timeStr) {
  const [h, m] = (timeStr || "00:00").slice(0, 5).split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_LABELS = {
  accepted: { text: "Accepted", color: "text-green-400 bg-green-500/15" },
  edited: { text: "Edited & Accepted", color: "text-blue-400 bg-blue-500/15" },
  rejected: { text: "Skipped", color: "text-muted bg-surface-secondary" },
};

export default function DayPlannerView() {
  const { addToast } = useToast();
  const { blocks, error, isLoading, refetch } = useDayPlan();
  const todayStr = getTodayStr();
  const { status: todayStatus, refetch: refetchStatus } = useDayPlanStatus(todayStr);
  const [showModal, setShowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [mutating, setMutating] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const handleSaveBlock = useCallback(async (form) => {
    setMutating(true);
    try {
      if (editingBlock) {
        await dayPlanService.updateBlock(editingBlock.id, form);
        addToast({ message: "Block updated", type: "success" });
      } else {
        await dayPlanService.createBlock(form);
        addToast({ message: "Block added", type: "success" });
      }
      setShowModal(false);
      setEditingBlock(null);
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setMutating(false);
    }
  }, [editingBlock, refetch, addToast]);

  const handleDeleteBlock = useCallback(async (id) => {
    setMutating(true);
    try {
      await dayPlanService.deleteBlock(id);
      addToast({ message: "Block deleted", type: "success" });
      setShowModal(false);
      setEditingBlock(null);
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setMutating(false);
    }
  }, [refetch, addToast]);

  const handleReviewComplete = useCallback((status) => {
    setShowReview(false);
    refetchStatus();
  }, [refetchStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show review mode
  if (showReview) {
    return (
      <div className="max-w-xl mx-auto">
        <DayPlanReview blocks={blocks} onComplete={handleReviewComplete} />
        <button
          onClick={() => setShowReview(false)}
          className="mt-4 text-body-sm text-muted hover:text-heading cursor-pointer"
        >
          &larr; Back to template
        </button>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <>
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No day plan template"
          description="Create time blocks to plan your ideal day"
          action={{
            children: "Add First Block",
            onClick: () => { setEditingBlock(null); setShowModal(true); },
          }}
        />
        <DayPlanBlockModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingBlock(null); }}
          block={editingBlock}
          onSave={handleSaveBlock}
          onDelete={handleDeleteBlock}
          isLoading={mutating}
        />
      </>
    );
  }

  // Compute total planned hours
  const totalMinutes = blocks.reduce((sum, b) => {
    const [sh, sm] = (b.start_time || "00:00").slice(0, 5).split(":").map(Number);
    const [eh, em] = (b.end_time || "00:00").slice(0, 5).split(":").map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  return (
    <>
      {error && (
        <ErrorState compact title="Day plan could not be loaded" onRetry={refetch} />
      )}
      {/* Today's status + apply button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-muted">
            {blocks.length} blocks &middot; {totalHours}h{totalMins > 0 ? ` ${totalMins}m` : ""} planned
          </span>
          {todayStatus && (
            <span className={cn(
              "text-caption px-2 py-0.5 rounded-full font-medium",
              STATUS_LABELS[todayStatus]?.color
            )}>
              Today: {STATUS_LABELS[todayStatus]?.text}
            </span>
          )}
        </div>
        {!todayStatus && blocks.length > 0 && (
          <Button size="sm" onClick={() => setShowReview(true)}>
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            Apply Today
          </Button>
        )}
      </div>

      {/* Visual timeline */}
      <div className="space-y-2">
        {blocks.map((block) => (
          <div
            key={block.id}
            onClick={() => { setEditingBlock(block); setShowModal(true); }}
            className="card flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-surface-secondary/30 transition-colors group"
          >
            <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: block.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-body font-medium text-heading truncate">{block.title}</p>
              <p className="text-caption text-muted">
                {formatTime(block.start_time)} — {formatTime(block.end_time)}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingBlock(block);
                  setShowModal(true);
                }}
                className="btn-ghost rounded-lg p-1.5 cursor-pointer"
              >
                <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add block button */}
      <button
        onClick={() => { setEditingBlock(null); setShowModal(true); }}
        className="mt-4 w-full py-3 border-2 border-dashed border-border rounded-xl text-muted hover:text-heading hover:border-neutral-500 transition-colors cursor-pointer text-body-sm font-medium flex items-center justify-center gap-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Time Block
      </button>

      <DayPlanBlockModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingBlock(null); }}
        block={editingBlock}
        onSave={handleSaveBlock}
        onDelete={handleDeleteBlock}
        isLoading={mutating}
      />
    </>
  );
}
