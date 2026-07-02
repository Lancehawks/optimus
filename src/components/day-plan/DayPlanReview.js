"use client";

import { useState, useMemo } from "react";
import { Button, Spinner, useToast } from "@/components/ui";
import { dayPlanService } from "@/services/api";
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

export default function DayPlanReview({ blocks: templateBlocks, onComplete, compact = false }) {
  const { addToast } = useToast();
  const [mode, setMode] = useState("preview"); // "preview" | "edit"
  const [editBlocks, setEditBlocks] = useState([]);
  const [applying, setApplying] = useState(false);

  const displayBlocks = useMemo(() => {
    if (mode === "edit") return editBlocks;
    return templateBlocks.map((b) => ({
      ...b,
      start_time: (b.start_time || "").slice(0, 5),
      end_time: (b.end_time || "").slice(0, 5),
    }));
  }, [mode, editBlocks, templateBlocks]);

  const handleStartEdit = () => {
    setEditBlocks(
      templateBlocks.map((b) => ({
        ...b,
        start_time: (b.start_time || "").slice(0, 5),
        end_time: (b.end_time || "").slice(0, 5),
      }))
    );
    setMode("edit");
  };

  const handleEditBlock = (index, field, value) => {
    setEditBlocks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveBlock = (index) => {
    setEditBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApply = async (status) => {
    setApplying(true);
    try {
      const todayStr = getTodayStr();
      const blocksToSend = (status === "edited" ? editBlocks : displayBlocks).map((b) => {
        // Build full ISO timestamps from local date + time so timezone is preserved
        const [sh, sm] = (b.start_time || "00:00").split(":").map(Number);
        const [eh, em] = (b.end_time || "00:00").split(":").map(Number);
        const [y, mo, d] = todayStr.split("-").map(Number);
        const startDt = new Date(y, mo - 1, d, sh, sm);
        const endDt = new Date(y, mo - 1, d, eh, em);
        return {
          title: b.title,
          start_time: startDt.toISOString(),
          end_time: endDt.toISOString(),
          color: b.color,
        };
      });

      await dayPlanService.apply({
        date: todayStr,
        status,
        blocks: status === "rejected" ? [] : blocksToSend,
      });

      addToast({
        message: status === "rejected"
          ? "Day plan skipped"
          : `${blocksToSend.length} events added to calendar`,
        type: status === "rejected" ? "info" : "success",
      });
      onComplete?.(status);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setApplying(false);
    }
  };

  if (compact) {
    // Compact version for MorningReviewModal
    return (
      <div className="space-y-2">
        {displayBlocks.slice(0, 6).map((block, i) => (
          <div key={block.id || i} className="flex items-center gap-2 text-body-sm">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: block.color }} />
            <span className="text-muted">{formatTime(block.start_time)}</span>
            <span className="text-heading">{block.title}</span>
          </div>
        ))}
        {displayBlocks.length > 6 && (
          <p className="text-caption text-muted">+{displayBlocks.length - 6} more</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" onClick={() => handleApply("accepted")} isLoading={applying} className="flex-1">
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleApply("rejected")} disabled={applying} className="flex-1">
            Skip
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-h4">
          {mode === "edit" ? "Edit Today's Plan" : "Today's Plan"}
        </h3>
        {mode === "edit" && (
          <Button variant="ghost" size="sm" onClick={() => setMode("preview")}>
            Cancel Edit
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2 mb-6">
        {displayBlocks.map((block, i) => (
          <div
            key={block.id || i}
            className="card flex items-center gap-3 px-4 py-3"
          >
            <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: block.color }} />
            {mode === "edit" ? (
              <>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={block.title}
                    onChange={(e) => handleEditBlock(i, "title", e.target.value)}
                    className="w-full bg-transparent text-body-sm text-heading font-medium outline-none border-b border-border/50 focus:border-brand-500 pb-0.5"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={block.start_time}
                      onChange={(e) => handleEditBlock(i, "start_time", e.target.value)}
                      className="bg-surface-secondary border border-border rounded-lg px-2 py-1 text-caption text-heading"
                    />
                    <span className="text-muted text-caption">to</span>
                    <input
                      type="time"
                      value={block.end_time}
                      onChange={(e) => handleEditBlock(i, "end_time", e.target.value)}
                      className="bg-surface-secondary border border-border rounded-lg px-2 py-1 text-caption text-heading"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveBlock(i)}
                  className="btn-ghost rounded-lg p-1.5 cursor-pointer"
                >
                  <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-body-sm font-medium text-heading">{block.title}</p>
                  <p className="text-caption text-muted">
                    {formatTime(block.start_time)} — {formatTime(block.end_time)}
                  </p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {displayBlocks.length === 0 && (
        <p className="text-center text-muted text-body-sm py-8">No time blocks in your plan.</p>
      )}

      {/* Actions */}
      {displayBlocks.length > 0 && (
        <div className="flex items-center gap-3">
          {mode === "edit" ? (
            <Button
              onClick={() => handleApply("edited")}
              isLoading={applying}
              className="flex-1"
            >
              Add {editBlocks.length} events to calendar
            </Button>
          ) : (
            <>
              <Button onClick={() => handleApply("accepted")} isLoading={applying} className="flex-1">
                Accept & Add to Calendar
              </Button>
              <Button variant="secondary" onClick={handleStartEdit} disabled={applying} className="flex-1">
                Edit First
              </Button>
              <Button variant="ghost" onClick={() => handleApply("rejected")} disabled={applying}>
                Skip
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
