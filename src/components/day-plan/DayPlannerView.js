"use client";
import { useAuth } from '@/context/AuthContext';
import { dateKey, resolveTimeZone } from '@/lib/calendarTime';

import { useState, useCallback } from "react";
import { ArrowLeft, CalendarPlus, Clock3, Pencil, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, useToast } from "@/components/ui";
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


const STATUS_LABELS = {
  accepted: { text: "Applied today", color: "bg-success-light text-success" },
  edited: { text: "Edited and applied", color: "bg-success-light text-success" },
  rejected: { text: "Skipped today", color: "bg-surface-tertiary text-muted" },
};

function durationLabel(start, end) {
  const [sh, sm] = (start || "00:00").slice(0, 5).split(":").map(Number);
  const [eh, em] = (end || "00:00").slice(0, 5).split(":").map(Number);
  const minutes = Math.max(0, eh * 60 + em - (sh * 60 + sm));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

export default function DayPlannerView() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const { blocks, error, isLoading, refetch } = useDayPlan();
  const todayStr = dateKey(new Date(), timeZone);
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
      <div className="space-y-2" role="status" aria-label="Loading day plan">
        {[0, 1, 2].map((row) => <div key={row} className="skeleton h-14" />)}
      </div>
    );
  }

  // Show review mode
  if (showReview) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowReview(false)}
          className="mb-5 inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-heading"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the plan
        </button>
        <DayPlanReview blocks={blocks} onComplete={handleReviewComplete} />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Clock3 />}
          title="Shape your ideal day"
          description="Add time blocks like deep work or admin. Each morning you can apply them to the calendar."
          action={{
            leftIcon: <Plus />,
            children: "Add a block",
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
      {error && <ErrorState compact className="mb-4" title="Day plan couldn't be loaded" onRetry={refetch} />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-muted">
            {blocks.length} blocks · {totalHours}h{totalMins > 0 ? ` ${totalMins}m` : ""} planned
          </span>
          {todayStatus && <span className={cn("badge", STATUS_LABELS[todayStatus]?.color)}>{STATUS_LABELS[todayStatus]?.text}</span>}
        </div>
        {!todayStatus && blocks.length > 0 && (
          <Button size="sm" leftIcon={<CalendarPlus />} onClick={() => setShowReview(true)}>
            Apply to today
          </Button>
        )}
      </div>

      <ol className="relative">
        {blocks.map((block) => (
          <li key={block.id} className="group grid grid-cols-[4.5rem_1fr] gap-4">
            <span className="pt-3 text-right font-mono text-xs tabular-nums text-muted">{formatTime(block.start_time)}</span>
            <button
              type="button"
              onClick={() => { setEditingBlock(block); setShowModal(true); }}
              className="mb-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
              style={{ backgroundColor: `color-mix(in srgb, ${block.color} 12%, var(--neutral-800))`, boxShadow: `inset 3px 0 0 ${block.color}` }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-heading">{block.title}</span>
                <span className="block font-mono text-2xs text-muted">
                  {formatTime(block.start_time)} – {formatTime(block.end_time)} · {durationLabel(block.start_time, block.end_time)}
                </span>
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-[4.5rem_1fr] gap-4">
        <span />
        <Button variant="ghost" leftIcon={<Plus />} className="justify-self-start" onClick={() => { setEditingBlock(null); setShowModal(true); }}>
          Add a block
        </Button>
      </div>

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
