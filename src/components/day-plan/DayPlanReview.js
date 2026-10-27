"use client";
import { useAuth } from '@/context/AuthContext';
import { dateKey, resolveTimeZone, zonedInputToDate } from '@/lib/calendarTime';

import { useState, useMemo } from "react";
import { CalendarPlus, X } from "lucide-react";
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


export default function DayPlanReview({ blocks: templateBlocks, onComplete, compact = false }) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
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
      const todayStr = dateKey(new Date(), timeZone);
      const blocksToSend = (status === "edited" ? editBlocks : displayBlocks).map((b) => {
        const startDt = zonedInputToDate(todayStr + 'T' + b.start_time.slice(0,5), timeZone);
        const endDt = zonedInputToDate(todayStr + 'T' + b.end_time.slice(0,5), timeZone);
        return {
          title: b.title,
          start_time: startDt.toISOString(),
          end_time: endDt.toISOString(),
          color: b.color,
        };
      });

      const result = await dayPlanService.apply({
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
      if (result.googleError) addToast({message: 'Plan saved. Google sync is pending; retry Calendar sync.', type: 'error'});
      onComplete?.(status);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setApplying(false);
    }
  };

  if (compact) {
    return (
      <div className="rounded-lg border border-border">
        <div className="divide-y divide-border">
          {displayBlocks.slice(0, 6).map((block, i) => (
            <div key={block.id || i} className="flex items-center gap-3 px-3 py-2">
              <span className="h-3.5 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: block.color }} />
              <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-muted">{formatTime(block.start_time)}</span>
              <span className="truncate text-sm text-heading">{block.title}</span>
            </div>
          ))}
          {displayBlocks.length > 6 && <p className="px-3 py-2 text-xs text-muted">+{displayBlocks.length - 6} more</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-surface-secondary px-3 py-2">
          <Button size="sm" onClick={() => handleApply("accepted")} isLoading={applying}>Add to calendar</Button>
          <Button size="sm" variant="ghost" onClick={() => handleApply("rejected")} disabled={applying}>Skip today</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-2xl text-heading">{mode === "edit" ? "Adjust today's plan" : "Today's plan"}</h3>
        {mode === "edit" && (
          <Button variant="ghost" size="sm" onClick={() => setMode("preview")}>Cancel</Button>
        )}
      </div>

      <div className="mb-6 divide-y divide-border rounded-xl border border-border">
        {displayBlocks.map((block, i) => (
          <div key={block.id || i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-8 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: block.color }} />
            {mode === "edit" ? (
              <>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    aria-label="Block title"
                    value={block.title}
                    onChange={(e) => handleEditBlock(i, "title", e.target.value)}
                    className="w-full border-b border-border bg-transparent pb-0.5 text-sm font-medium text-heading outline-none focus:border-brand-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label="Start time"
                      value={block.start_time}
                      onChange={(e) => handleEditBlock(i, "start_time", e.target.value)}
                      className="input-base focus:input-focus min-h-7! w-auto py-1! font-mono text-xs!"
                    />
                    <span className="text-xs text-muted">to</span>
                    <input
                      type="time"
                      aria-label="End time"
                      value={block.end_time}
                      onChange={(e) => handleEditBlock(i, "end_time", e.target.value)}
                      className="input-base focus:input-focus min-h-7! w-auto py-1! font-mono text-xs!"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBlock(i)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-danger"
                  aria-label={`Remove ${block.title}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex-1">
                <p className="text-sm font-medium text-heading">{block.title}</p>
                <p className="font-mono text-2xs text-muted">
                  {formatTime(block.start_time)} – {formatTime(block.end_time)}
                </p>
              </div>
            )}
          </div>
        ))}
        {displayBlocks.length === 0 && <p className="py-8 text-center text-sm text-muted">No time blocks in your plan.</p>}
      </div>

      {displayBlocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {mode === "edit" ? (
            <Button onClick={() => handleApply("edited")} isLoading={applying} leftIcon={<CalendarPlus />}>
              Add {editBlocks.length} events to the calendar
            </Button>
          ) : (
            <>
              <Button onClick={() => handleApply("accepted")} isLoading={applying} leftIcon={<CalendarPlus />}>
                Add to calendar
              </Button>
              <Button variant="secondary" onClick={handleStartEdit} disabled={applying}>Adjust first</Button>
              <Button variant="ghost" onClick={() => handleApply("rejected")} disabled={applying}>Skip today</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
