"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWhiteboardMutations } from "@/hooks/useWhiteboards";
import WhiteboardCanvas from "@/components/whiteboards/WhiteboardCanvas";

import GreetingHeader from "@/components/dashboard/GreetingHeader";
import TodaysTasksWidget from "@/components/dashboard/TodaysTasksWidget";
import HabitsWidget from "@/components/dashboard/HabitsWidget";
import UpcomingEventsWidget from "@/components/dashboard/UpcomingEventsWidget";
import ActiveProjectsWidget from "@/components/dashboard/ActiveProjectsWidget";
import RecentNotesWidget from "@/components/dashboard/RecentNotesWidget";
import QuickCaptureWidget from "@/components/dashboard/QuickCaptureWidget";
import WeeklyPulseWidget from "@/components/dashboard/WeeklyPulseWidget";
import MorningReviewModal from "@/components/dashboard/MorningReviewModal";

export default function DashboardPage() {
  const router = useRouter();
  const [quickSketch, setQuickSketch] = useState(false);
  const [sketchData, setSketchData] = useState(null);

  const { createWhiteboard, updateWhiteboard } = useWhiteboardMutations();

  const handleQuickSketchSave = useCallback(async (data) => {
    if (data.thumbnailUrl) {
      if (sketchData?.id) {
        await updateWhiteboard(sketchData.id, { thumbnailUrl: data.thumbnailUrl });
      }
      return;
    }

    if (!sketchData?.id) {
      try {
        const wb = await createWhiteboard({
          title: `Quick Sketch — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          excalidrawData: data,
        });
        setSketchData(wb);
      } catch (error) {
        console.error("Quick sketch save failed:", error);
      }
    } else {
      try {
        await updateWhiteboard(sketchData.id, { excalidrawData: data });
      } catch (error) {
        console.error("Quick sketch save failed:", error);
      }
    }
  }, [createWhiteboard, updateWhiteboard, sketchData]);

  const handleCloseSketch = useCallback(() => {
    setQuickSketch(false);
    if (sketchData?.id) {
      router.push("/whiteboards");
    }
    setSketchData(null);
  }, [sketchData, router]);

  if (quickSketch) {
    return (
      <div className="h-screen flex flex-col">
        <WhiteboardCanvas
          initialData={null}
          onSave={handleQuickSketchSave}
          onBack={handleCloseSketch}
          title="Quick Sketch"
        />
      </div>
    );
  }

  return (
    <>
    <MorningReviewModal />
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24">
      {/* Greeting */}
      <GreetingHeader />

      {/* Bento Grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Row 1: Tasks | Habits | Events */}
        <TodaysTasksWidget />
        <HabitsWidget />
        <UpcomingEventsWidget />

        {/* Row 2: Active Projects (2 cols) | Recent Notes (1 col) */}
        <div className="md:col-span-2">
          <ActiveProjectsWidget />
        </div>
        <RecentNotesWidget />

        {/* Row 3: Weekly Pulse | Quick Capture */}
        <WeeklyPulseWidget />
        <QuickCaptureWidget />
      </div>

      {/* Quick Sketch FAB */}
      <button
        onClick={() => setQuickSketch(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 h-14 w-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95"
        title="Quick Sketch"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
        </svg>
      </button>
    </div>
    </>
  );
}
