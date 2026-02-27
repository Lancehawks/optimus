"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui";
import { Modal } from "@/components/ui";
import { useWhiteboardMutations } from "@/hooks/useWhiteboards";
import WhiteboardCanvas from "@/components/whiteboards/WhiteboardCanvas";

const stats = [
  {
    label: "Tasks Due Today",
    value: "—",
    accent: "border-l-brand-500",
    iconBg: "bg-brand-500/10 text-brand-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Notes Updated",
    value: "—",
    accent: "border-l-green-500",
    iconBg: "bg-emerald-500/10 text-emerald-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    label: "Upcoming Events",
    value: "—",
    accent: "border-l-amber-500",
    iconBg: "bg-amber-500/10 text-amber-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [quickSketch, setQuickSketch] = useState(false);
  const [sketchData, setSketchData] = useState(null);

  const { createWhiteboard, updateWhiteboard } = useWhiteboardMutations();

  // Quick sketch: save as a new whiteboard and navigate to it
  const handleQuickSketchSave = useCallback(async (data) => {
    if (data.thumbnailUrl) {
      // Thumbnail update for existing sketch
      if (sketchData?.id) {
        await updateWhiteboard(sketchData.id, { thumbnailUrl: data.thumbnailUrl });
      }
      return;
    }

    if (!sketchData?.id) {
      // First save — create the whiteboard
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
      // Subsequent saves — update
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
      // Navigate to the saved board
      router.push("/whiteboards");
    }
    setSketchData(null);
  }, [sketchData, router]);

  // Quick sketch full-screen view
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-6 mb-8">
        <h1 className="text-2xl font-bold text-heading">
          Welcome back, {user?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-brand-400 mt-1 text-sm">
          Here&apos;s your overview for today
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`card card-hover p-5 border-l-4 ${stat.accent}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-caption mb-0.5">{stat.label}</p>
                <p className="text-2xl font-bold text-heading">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6">
          <h3 className="text-h4 mb-3">Recent Tasks</h3>
          <p className="text-body-sm text-muted!">
            Your recent tasks will appear here. Head to the Tasks page to get started.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-h4 mb-3">Recent Notes</h3>
          <p className="text-body-sm text-muted!">
            Your recent notes will appear here. Head to the Notes page to get started.
          </p>
        </div>
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
  );
}
