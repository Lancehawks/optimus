"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSidebarIndicators } from "@/hooks/useDashboard";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Notes",
    href: "/notes",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
  {
    label: "Whiteboards",
    href: "/whiteboards",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    label: "Reading List",
    href: "/bookmarks",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
      </svg>
    ),
  },
  {
    label: "Resources",
    href: "/resources",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    label: "Habits",
    href: "/habits",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
  },
];

const bottomNavigation = [
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false); // desktop icon-only mode
  const [mobileOpen, setMobileOpen] = useState(false);   // mobile drawer
  const { indicators } = useSidebarIndicators();

  const badges = useMemo(() => {
    if (!indicators) return {};
    const b = {};

    if (indicators.overdueTaskCount > 0) {
      b["/tasks"] = { count: indicators.overdueTaskCount, color: "bg-red-500" };
    }

    const habitsPending = indicators.habitsTotal - indicators.habitsDoneToday;
    if (indicators.habitsTotal > 0) {
      if (habitsPending === 0) {
        b["/habits"] = { dot: true, color: "bg-emerald-500" };
      } else {
        b["/habits"] = { count: habitsPending, color: "bg-amber-500" };
      }
    }

    return b;
  }, [indicators]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // On mobile, always show labels regardless of isCollapsed (which is desktop-only)
  const navItemClass = (isActive) => cn(
    "flex items-center gap-3 px-3 rounded-md text-[0.8125rem] font-medium transition-colors",
    "min-h-[44px]", // minimum tap target
    isActive
      ? "bg-brand-500/15 text-brand-400"
      : "text-neutral-400 hover:bg-white/6 hover:text-neutral-100",
    isCollapsed && "lg:justify-center lg:px-0"
  );

  return (
    <>
      {/* ── Mobile top bar — visible only on small screens ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-neutral-950 border-b border-white/8 flex items-center justify-between px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">O</span>
          </div>
          <span className="text-[1rem] font-semibold text-white tracking-tight">Optimus</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2.5 -mr-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/8 transition-colors"
          aria-label="Open navigation menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* ── Mobile overlay ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-neutral-950 h-screen transition-all duration-200",
          // Desktop: collapsible width
          isCollapsed ? "lg:w-[68px]" : "lg:w-64",
          // Mobile: always full drawer width, slides in/out
          "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/8 shrink-0">
          {/* Logo — hidden on desktop when collapsed */}
          <Link
            href="/dashboard"
            className={cn("flex items-center gap-2.5", isCollapsed && "lg:hidden")}
          >
            <div className="h-8 w-8 rounded-md bg-brand-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-[1.1rem] font-semibold text-white tracking-tight">Optimus</span>
          </Link>

          {/* Icon-only logo on desktop when collapsed */}
          {isCollapsed && (
            <div className="hidden lg:flex h-8 w-8 rounded-md bg-brand-500 items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">O</span>
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "hidden lg:flex p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/8 cursor-pointer transition-colors",
              isCollapsed && "mx-auto"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2.5 -mr-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/8 transition-colors"
            aria-label="Close navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-3 space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge = badges[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navItemClass(isActive)}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="relative shrink-0">
                  {item.icon}
                  {/* Collapsed mode: dot on icon */}
                  {badge && isCollapsed && (
                    <span className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full hidden lg:block", badge.color)} />
                  )}
                </div>
                <span className={cn(isCollapsed && "lg:hidden")}>{item.label}</span>
                {/* Expanded mode: pill or dot badge */}
                {badge && (
                  <span className={cn(
                    "ml-auto shrink-0 rounded-full flex items-center justify-center",
                    badge.count
                      ? "h-5 min-w-5 px-1.5 text-[10px] font-bold text-white"
                      : "h-2 w-2",
                    badge.color,
                    isCollapsed && "lg:hidden"
                  )}>
                    {badge.count ? (badge.count > 9 ? "9+" : badge.count) : ""}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/8 px-3 py-3 space-y-0.5">
          {bottomNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navItemClass(isActive)}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                <span className={cn(isCollapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}

          {/* User row */}
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 mt-1",
            isCollapsed && "lg:justify-center lg:px-0"
          )}>
            <div className="h-8 w-8 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0">
              <span className="text-brand-400 text-xs font-semibold">
                {(user?.full_name || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className={cn("flex-1 min-w-0", isCollapsed && "lg:hidden")}>
              <p className="text-[0.8125rem] text-neutral-100 font-medium truncate">
                {user?.full_name || "User"}
              </p>
              <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className={cn(
                "p-2.5 rounded-md text-neutral-400 hover:text-red-400 hover:bg-white/8 cursor-pointer shrink-0 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
                isCollapsed && "lg:hidden"
              )}
              title="Sign out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
