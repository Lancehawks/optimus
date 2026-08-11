"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  ListTodo,
  LogOut,
  Menu,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  Repeat2,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSidebarIndicators } from "@/hooks/useDashboard";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import Avatar from "@/components/ui/Avatar";

const planNavigation = [
  { label: "Today", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Routines", href: "/habits", icon: Repeat2 },
];

const organizeNavigation = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Knowledge", href: "/notes", icon: NotebookPen },
  { label: "Whiteboards", href: "/whiteboards", icon: Presentation },
];

const libraryNavigation = [
  { label: "Reading list", href: "/bookmarks", icon: Bookmark },
  { label: "Resources", href: "/resources", icon: LibraryBig },
];

function BrandMark({ compact = false }) {
  return (
    <span className={cn("donezo-brand", compact && "donezo-brand-compact")}>
      <span className="donezo-logo-glyph" aria-hidden="true">
        <CircleCheckBig strokeWidth={2.35} />
      </span>
      <span className="donezo-brand-name">Optimus</span>
    </span>
  );
}

function isRouteActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({
  collapsed = true,
  onToggleCollapsed = () => {},
  onOpenSearch = () => {},
  showDashboardAlerts = false,
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { indicators, error: indicatorsError, refetch: refetchIndicators } = useSidebarIndicators();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  const badges = useMemo(() => {
    if (!indicators) return {};
    const next = {};
    if (indicators.overdueTaskCount > 0) {
      next["/tasks"] = { count: indicators.overdueTaskCount, tone: "danger" };
    }
    const routinesPending = indicators.habitsTotal - indicators.habitsDoneToday;
    if (indicators.habitsTotal > 0) {
      next["/habits"] = routinesPending === 0
        ? { dot: true, tone: "success" }
        : { count: routinesPending, tone: "brand" };
    }
    return next;
  }, [indicators]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const handleOutsideClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
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
    if (!badge) return null;
    return (
      <span className={cn("donezo-nav-badge", `donezo-nav-badge-${badge.tone}`)}>
        {badge.dot ? "" : Math.min(badge.count, 99)}
      </span>
    );
  };

  const renderNav = (items) => items.map((item) => {
    const Icon = item.icon;
    const active = isRouteActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn("donezo-nav-link", active && "donezo-nav-link-active")}
        aria-label={item.label}
        data-label={item.label}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="donezo-nav-icon" strokeWidth={1.75} />
        <span>{item.label}</span>
        {renderBadge(item.href)}
      </Link>
    );
  });

  return (
    <>
      <aside
        id="optimus-sidebar-navigation"
        className={cn("donezo-sidebar", collapsed && "donezo-sidebar-collapsed", mobileOpen && "donezo-sidebar-open")}
      >
        <div className="donezo-sidebar-head">
          <Link href="/dashboard" aria-label="Optimus dashboard">
            <BrandMark compact={collapsed} />
          </Link>
          <button
            type="button"
            className="donezo-sidebar-collapse-button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Minimize navigation"}
            aria-expanded={!collapsed}
            aria-controls="optimus-sidebar-navigation"
            title={collapsed ? "Expand navigation" : "Minimize navigation"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <button
            type="button"
            className="donezo-sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="donezo-sidebar-scroll">
          <nav className="donezo-nav" aria-label="Planning navigation">
            <p className="donezo-nav-label">Plan</p>
            {renderNav(planNavigation)}
          </nav>

          <nav className="donezo-nav donezo-nav-secondary" aria-label="Organization navigation">
            <p className="donezo-nav-label">Organize</p>
            {renderNav(organizeNavigation)}
          </nav>

          <nav className="donezo-nav donezo-nav-secondary" aria-label="Library navigation">
            <p className="donezo-nav-label">Library</p>
            {renderNav(libraryNavigation)}
          </nav>

        </div>

        <nav className="donezo-sidebar-footer" aria-label="General navigation">
          {indicatorsError && (
            <button
              type="button"
              className="donezo-nav-link text-danger"
              onClick={refetchIndicators}
              aria-label="Dashboard indicators failed to load. Retry"
              title="Dashboard indicators unavailable — click to retry"
            >
              <CircleHelp className="donezo-nav-icon" strokeWidth={1.75} />
              <span>Retry indicators</span>
            </button>
          )}
          <Link
            href="/settings"
            className={cn("donezo-nav-link", isRouteActive(pathname, "/settings") && "donezo-nav-link-active")}
            aria-label="Settings"
            data-label="Settings"
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="donezo-nav-icon" strokeWidth={1.75} />
            <span>Settings</span>
          </Link>
          <NotificationCenter
            variant="sidebar"
            isCollapsed={collapsed}
            showAlerts={showDashboardAlerts}
            onNavigate={() => setMobileOpen(false)}
          />

          <div ref={accountRef} className="donezo-sidebar-account-wrap">
            <button
              type="button"
              className="donezo-sidebar-profile"
              onClick={() => setAccountOpen((open) => !open)}
              aria-label="Open profile menu"
              aria-expanded={accountOpen}
              title={collapsed ? user?.full_name || "Profile" : undefined}
            >
              <Avatar
                src={user?.avatar_url}
                name={user?.full_name || user?.email}
                size="sm"
                className="donezo-sidebar-profile-avatar"
              />
              <span className="donezo-sidebar-profile-copy">
                <strong>{user?.full_name || "Optimus member"}</strong>
                <small>{user?.email}</small>
              </span>
              <ChevronDown className="donezo-sidebar-profile-chevron" strokeWidth={1.7} />
            </button>

            {accountOpen && (
              <div className="donezo-account-menu donezo-sidebar-account-menu">
                <div className="donezo-account-menu-head">
                  <Avatar src={user?.avatar_url} name={user?.full_name || user?.email} size="md" />
                  <span>
                    <strong>{user?.full_name || "Optimus member"}</strong>
                    <small>{user?.email}</small>
                  </span>
                </div>
                <Link href="/settings">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <Link href="/contact">
                  <CircleHelp className="h-4 w-4" /> Help
                </Link>
                <button type="button" onClick={logout}>
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </nav>
      </aside>

      <header className="donezo-topbar">
        <div className="donezo-topbar-left">
          <button
            type="button"
            className="donezo-menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="optimus-sidebar-navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="donezo-topbar-mobile-brand" aria-label="Optimus dashboard">
            <BrandMark compact />
          </Link>
          <button type="button" className="donezo-search" onClick={onOpenSearch} aria-label="Search workspace">
            <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span>Search task, project or note</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>

      </header>

      <button
        type="button"
        className={cn("donezo-sidebar-scrim", mobileOpen && "donezo-sidebar-scrim-visible")}
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
      />
    </>
  );
}
