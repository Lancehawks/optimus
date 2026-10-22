"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronsUpDown,
  CircleAlert,
  FolderKanban,
  KeyRound,
  Library,
  ListChecks,
  LogOut,
  Menu,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Plus,
  Repeat2,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSidebarIndicators } from "@/hooks/useDashboard";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import Avatar from "@/components/ui/Avatar";
import OptimusLogo from "@/components/brand/OptimusLogo";
import { navItemClass } from "@/components/layout/navStyles";

const navigation = [
  { label: "Today", href: "/dashboard", icon: Sun, children: [{ label: "Routines", href: "/routines", icon: Repeat2 }] },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Notes", href: "/notes", icon: NotebookPen, children: [{ label: "Whiteboards", href: "/whiteboards", icon: PenTool }] },
  { label: "Library", href: "/library", icon: Library },
];

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function isRouteActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Shortcut({ keys }) {
  return (
    <span className="ml-auto flex items-center gap-0.5">
      {keys.map((key) => (
        <kbd
          key={key}
          className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded border border-border bg-surface px-1 text-[0.625rem] leading-none text-muted"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapsed = () => {},
  onOpenSearch = () => {},
  onOpenCapture = () => {},
  onOpenAssistant = () => {},
  showDashboardAlerts = false,
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { indicators, error: indicatorsError, refetch: refetchIndicators } = useSidebarIndicators();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mod, setMod] = useState("Ctrl");
  const accountRef = useRef(null);

  useEffect(() => {
    if (isMac()) setMod("⌘");
  }, []);

  const badges = useMemo(() => {
    if (!indicators) return {};
    const next = {};
    if (indicators.overdueTaskCount > 0) {
      next["/tasks"] = { count: indicators.overdueTaskCount, tone: "danger", label: "overdue" };
    }
    const routinesPending = indicators.habitsTotal - indicators.habitsDoneToday;
    if (indicators.habitsTotal > 0 && routinesPending > 0) {
      next["/routines"] = { count: routinesPending, tone: "muted", label: "left today" };
    }
    return next;
  }, [indicators]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  const renderBadge = (href) => {
    const badge = badges[href];
    if (!badge || collapsed) return null;
    return (
      <span
        className={cn(
          "ml-auto font-mono text-[0.6875rem] tabular-nums",
          badge.tone === "danger" ? "text-danger" : "text-muted"
        )}
        title={`${badge.count} ${badge.label}`}
      >
        {Math.min(badge.count, 99)}
      </span>
    );
  };

  const renderLink = (item, { nested = false } = {}) => {
    const Icon = item.icon;
    const active = isRouteActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={navItemClass({ active, collapsed, nested })}
        title={collapsed ? item.label : undefined}
      >
        {nested && !collapsed && (
          <span className="absolute bottom-0 left-[1.0625rem] top-0 w-px bg-border" aria-hidden="true" />
        )}
        <Icon strokeWidth={1.75} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {renderBadge(item.href)}
      </Link>
    );
  };

  const firstName = user?.full_name?.split(/\s+/)[0] || "Member";

  return (
    <>
      <aside
        id="optimus-sidebar-navigation"
        className="app-sidebar"
        data-open={mobileOpen ? "true" : "false"}
        aria-label="Workspace navigation"
      >
        <div className={cn("flex h-14 shrink-0 items-center gap-2", collapsed ? "lg:justify-center lg:px-0 px-4" : "px-4")}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 text-heading" aria-label="Optimus, Today">
            <OptimusLogo size={22} />
            {!collapsed && <span className="font-serif text-[1.375rem] leading-none tracking-[-0.01em]">Optimus</span>}
          </Link>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "ml-auto hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-black/[0.04] hover:text-heading lg:flex dark:hover:bg-white/[0.06]",
              collapsed && "lg:hidden"
            )}
            aria-label="Collapse sidebar"
            aria-controls="optimus-sidebar-navigation"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:text-heading lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("flex shrink-0 flex-col gap-0.5 pb-3", collapsed ? "px-2 lg:px-0" : "px-2")}>
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className={cn(navItemClass({ collapsed }), "hidden lg:flex")}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenSearch();
            }}
            className={navItemClass({ collapsed })}
            aria-label="Search workspace"
            title={collapsed ? `Search (${mod} K)` : undefined}
          >
            <Search strokeWidth={1.75} />
            {!collapsed && (
              <>
                <span>Search</span>
                <Shortcut keys={[mod, "K"]} />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenCapture();
            }}
            className={navItemClass({ collapsed })}
            aria-label="Quick capture"
            title={collapsed ? "Quick capture" : undefined}
          >
            <Plus strokeWidth={1.75} />
            {!collapsed && (
              <>
                <span>New</span>
                <Shortcut keys={[mod, "⇧", "K"]} />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenAssistant();
            }}
            className={navItemClass({ collapsed })}
            aria-label="Ask the assistant"
            title={collapsed ? `Ask (${mod} J)` : undefined}
          >
            <Sparkles strokeWidth={1.75} />
            {!collapsed && (
              <>
                <span>Ask</span>
                <Shortcut keys={[mod, "J"]} />
              </>
            )}
          </button>
        </div>

        <nav
          className={cn("min-h-0 flex-1 overflow-y-auto pb-4 scrollbar-none", collapsed ? "px-2 lg:px-0" : "px-2")}
          aria-label="Primary"
        >
          {!collapsed && <p className="px-2 pb-1.5 pt-2 text-overline">Workspace</p>}
          {collapsed && <div className="mx-auto my-2 hidden h-px w-6 bg-border lg:block" />}
          <div className="flex flex-col gap-0.5">
            {navigation.map((item) => (
              <div key={item.href} className="flex flex-col gap-0.5">
                {renderLink(item)}
                {!collapsed && item.children?.map((child) => renderLink(child, { nested: true }))}
              </div>
            ))}
          </div>
        </nav>

        <div className={cn("flex shrink-0 flex-col gap-0.5 pb-3 pt-2", collapsed ? "px-2 lg:px-0" : "px-2")}>
          {indicatorsError && (
            <button
              type="button"
              className={cn(navItemClass({ collapsed }), "text-danger!")}
              onClick={refetchIndicators}
              title="Counts unavailable. Retry"
            >
              <CircleAlert strokeWidth={1.75} className="text-danger!" />
              {!collapsed && <span>Retry counts</span>}
            </button>
          )}
          <Link
            href="/founder"
            className={navItemClass({ active: isRouteActive(pathname, "/founder"), collapsed })}
            title={collapsed ? "Founder Lobby" : undefined}
          >
            <KeyRound strokeWidth={1.75} />
            {!collapsed && <span>Founder Lobby</span>}
          </Link>
          <NotificationCenter
            isCollapsed={collapsed}
            showAlerts={showDashboardAlerts}
            onNavigate={() => setMobileOpen(false)}
          />
          <Link
            href="/settings"
            className={navItemClass({ active: isRouteActive(pathname, "/settings"), collapsed })}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings strokeWidth={1.75} />
            {!collapsed && <span>Settings</span>}
          </Link>

          <div ref={accountRef} className="relative mt-2">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-black/[0.035] dark:hover:bg-white/[0.05]",
                collapsed && "lg:justify-center lg:p-1",
                accountOpen && "bg-black/[0.035] dark:bg-white/[0.05]"
              )}
              aria-label="Account menu"
              aria-expanded={accountOpen}
              title={collapsed ? user?.full_name || "Account" : undefined}
            >
              <Avatar src={user?.avatar_url} name={user?.full_name || user?.email} size="sm" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium leading-4 text-heading">
                      {user?.full_name || firstName}
                    </span>
                    <span className="block truncate text-[0.6875rem] leading-4 text-muted">{user?.email}</span>
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                </>
              )}
            </button>

            {accountOpen && (
              <div
                role="menu"
                className={cn(
                  "absolute bottom-full z-50 mb-2 w-60 animate-slide-down rounded-xl border border-border bg-surface p-1 shadow-md",
                  collapsed ? "left-0 lg:left-full lg:bottom-0 lg:mb-0 lg:ml-2" : "left-0 right-0 w-auto"
                )}
              >
                <div className="px-2 pb-2 pt-1.5">
                  <p className="truncate text-sm font-medium text-heading">{user?.full_name || firstName}</p>
                  <p className="truncate text-xs text-muted">{user?.email}</p>
                </div>
                <div className="mx-1 mb-1 h-px bg-border" />
                <Link
                  href="/settings"
                  role="menuitem"
                  className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-body hover:bg-surface-tertiary hover:text-heading"
                >
                  <Settings className="h-4 w-4 text-muted" strokeWidth={1.75} /> Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm text-body hover:bg-surface-tertiary hover:text-heading"
                >
                  <LogOut className="h-4 w-4 text-muted" strokeWidth={1.75} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <header className="app-topbar">
        <button
          type="button"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-body hover:bg-surface-tertiary"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="optimus-sidebar-navigation"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 text-heading" aria-label="Optimus, Today">
          <OptimusLogo size={20} />
          <span className="font-serif text-xl leading-none">Optimus</span>
        </Link>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-body hover:bg-surface-tertiary"
            aria-label="Search workspace"
          >
            <Search className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onOpenAssistant}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-body hover:bg-surface-tertiary"
            aria-label="Ask the assistant"
          >
            <Sparkles className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onOpenCapture}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-body hover:bg-surface-tertiary"
            aria-label="Quick capture"
          >
            <Plus className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <button
        type="button"
        className="app-scrim"
        data-open={mobileOpen ? "true" : "false"}
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
      />
    </>
  );
}
