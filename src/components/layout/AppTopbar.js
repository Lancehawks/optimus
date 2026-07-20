"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, Plus, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/ui/Avatar";

const routeNames = {
  dashboard: "Executive overview",
  tasks: "Tasks",
  notes: "Knowledge",
  calendar: "Calendar",
  projects: "Projects",
  whiteboards: "Whiteboards",
  bookmarks: "Reading list",
  resources: "Resources",
  habits: "Routines",
  settings: "Settings",
};

export default function AppTopbar({ onOpenSearch, onOpenQuickCapture }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const route = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const routeName = routeNames[route] || "Workspace";
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="app-topbar hidden h-16 shrink-0 items-center gap-5 px-6 lg:flex">
      <div className="min-w-[190px]">
        <p className="text-[9px] font-bold uppercase text-white/48">Company workspace</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{routeName}</p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="topbar-search mx-auto flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg px-3 text-left text-sm text-white/68 transition-colors"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" strokeWidth={1.8} />
        <span className="flex-1">Search across Optimus</span>
        <kbd className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-white/52">Ctrl K</kbd>
      </button>

      <div className="flex min-w-[350px] items-center justify-end gap-2">
        <span className="mr-1 hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.045] px-2.5 py-1.5 text-[10px] font-semibold text-white/62 2xl:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal-yellow)] shadow-[0_0_0_3px_rgb(240_200_75/0.12)]" />
          Workspace live
        </span>
        <div className="mr-2 hidden items-center gap-2 text-xs text-white/64 xl:flex">
          <CalendarDays className="h-4 w-4" strokeWidth={1.7} />
          <span>{date}</span>
        </div>
        <button
          type="button"
          onClick={onOpenQuickCapture}
          className="topbar-capture btn-base h-9 px-3 text-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Capture
        </button>
        <Avatar
          src={user?.avatar_url}
          name={user?.full_name || user?.email}
          size="sm"
          className="topbar-avatar ml-1 h-9! w-9! border-2 border-[var(--signal-yellow)]"
        />
      </div>
    </header>
  );
}
