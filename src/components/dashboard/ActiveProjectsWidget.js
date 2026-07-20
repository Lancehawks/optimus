"use client";

import { useRouter } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";

const STATUS_COLORS = {
  active: "text-emerald-400",
  paused: "text-amber-400",
  completed: "text-brand-400",
};

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-40 rounded bg-neutral-700/50 animate-pulse" />
          <div className="h-2 w-full rounded-full bg-neutral-700/50 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function ActiveProjectsWidget() {
  const router = useRouter();
  const { projects, isLoading } = useProjects({ status: "active" });

  const displayProjects = projects.slice(0, 4);

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-info-light">
            <svg className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h3 className="text-h4">Active Projects</h3>
        </div>
        {!isLoading && projects.length > 0 && (
          <span className="text-caption text-muted">{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonRows />
      ) : displayProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-body-sm text-heading font-medium">No active projects</p>
          <p className="text-caption text-muted mt-1">Start something new</p>
          <button
            onClick={() => router.push("/projects")}
            className="mt-3 text-caption text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
          >
            Create a project →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayProjects.map((project) => {
            const taskPct = project.task_count > 0
              ? Math.round((project.task_done_count / project.task_count) * 100)
              : 0;
            const milestonePct = project.milestone_count > 0
              ? Math.round((project.milestone_done_count / project.milestone_count) * 100)
              : null;
            const pct = milestonePct !== null ? milestonePct : taskPct;

            return (
              <button
                key={project.id}
                onClick={() => router.push("/projects")}
                className="group text-left rounded-xl p-3.5 bg-neutral-800/60 border border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800 transition-all cursor-pointer"
              >
                {/* Top row */}
                <div className="flex items-start gap-2.5 mb-3">
                  {/* Color swatch */}
                  <span
                    className="mt-0.5 shrink-0 h-3 w-3 rounded-sm"
                    style={{ backgroundColor: project.color || "#0d6b88" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-heading truncate leading-tight">
                      {project.name}
                    </p>
                    {project.task_count > 0 && (
                      <p className="text-caption text-muted mt-0.5">
                        {project.task_done_count}/{project.task_count} tasks
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-caption font-bold text-heading">
                    {pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-neutral-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: project.color || "#0d6b88",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <button
        onClick={() => router.push("/projects")}
        className="text-caption text-brand-400 hover:text-brand-300 transition-colors text-left mt-auto cursor-pointer"
      >
        View all projects →
      </button>
    </div>
  );
}
