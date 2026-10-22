"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/api";
import { Check, Monitor } from "lucide-react";
import { Avatar, Badge, Button, Input, Select, Spinner, useToast } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { AVATAR_PRESETS, normalizeAvatarValue } from "@/lib/avatarOptions";
import PageHeader from "@/components/layout/PageHeader";
import { useTheme } from "@/context/ThemeContext";
import InvitationsPanel from "@/components/settings/InvitationsPanel";
import AssistantSettings from "@/components/settings/AssistantSettings";
import MemorySettings from "@/components/settings/MemorySettings";
import ApiKeysSettings from "@/components/settings/ApiKeysSettings";
import { TIMEZONE_OPTIONS } from "@/constants";

function SettingsSection({ id, title, description, children }) {
  return (
    <section id={id} className="grid scroll-mt-8 gap-5 border-t border-border py-10 md:grid-cols-[13rem_1fr] md:gap-10">
      <div>
        <h2 className="text-[0.9375rem] font-semibold text-heading">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ThemePreview({ mode, selected }) {
  const pane = (dark) => (
    <span className={cn("flex h-full flex-1 gap-1 p-1.5", dark ? "bg-[#0e0e0d]" : "bg-[#f4f3f0]")}>
      <span className="flex w-1/4 flex-col gap-1 pt-1">
        <span className={cn("h-1 w-3/4 rounded-full", dark ? "bg-white/25" : "bg-black/20")} />
        <span className={cn("h-1 w-1/2 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
      </span>
      <span className={cn("flex flex-1 flex-col gap-1 rounded-[3px] p-1.5", dark ? "bg-[#171716]" : "bg-white")}>
        <span className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-white/50" : "bg-black/60")} />
        <span className={cn("h-1 w-3/4 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
        <span className="mt-auto h-1.5 w-1/3 rounded-full bg-[#3346d3]" />
      </span>
    </span>
  );
  return (
    <span
      className={cn(
        "flex h-20 overflow-hidden rounded-lg ring-1 transition-shadow",
        selected ? "ring-2 ring-brand-500" : "ring-border group-hover:ring-border-strong"
      )}
      aria-hidden="true"
    >
      {mode === "system" ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === "dark")
      )}
    </span>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const { theme: activeTheme, themes, setTheme } = useTheme();
  const [savingThemeId, setSavingThemeId] = useState(null);

  // Profile form
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(normalizeAvatarValue(user?.avatar_url));
  const [timezone, setTimezone] = useState(user?.timezone || "UTC");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const data = await authService.getSessions();
      setSessions(data.sessions);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setFullName(user?.full_name || "");
    setAvatarUrl(normalizeAvatarValue(user?.avatar_url));
    setTimezone(user?.timezone || "UTC");
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const data = await authService.updateProfile({ fullName, avatarUrl, timezone });
      updateUser(data.user);
      addToast({ message: "Profile updated", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      addToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      addToast({ message: "Password must be at least 8 characters", type: "error" });
      return;
    }
    setIsSavingPassword(true);
    try {
      await authService.updateProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      addToast({ message: "Password updated", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await authService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      addToast({ message: "Session revoked", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleThemeChange = async (themeId) => {
    if (themeId === activeTheme || savingThemeId) return;
    setSavingThemeId(themeId);
    const result = await setTheme(themeId);
    if (!result.persisted) {
      addToast({ message: "Applied on this device only", type: "info" });
    }
    setSavingThemeId(null);
  };

  const parseDeviceInfo = (deviceInfo) => {
    if (!deviceInfo) return "Unknown device";
    if (deviceInfo.includes("Edg")) return "Edge";
    if (deviceInfo.includes("Chrome")) return "Chrome";
    if (deviceInfo.includes("Firefox")) return "Firefox";
    if (deviceInfo.includes("Safari")) return "Safari";
    return deviceInfo.substring(0, 40);
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Settings" description="Your profile, appearance, assistant and account security." />

      <SettingsSection title="Appearance" description="Follow your device, or keep Optimus light or dark.">
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Appearance">
          {themes.map((themeOption) => {
            const isSelected = activeTheme === themeOption.id;
            const isSaving = savingThemeId === themeOption.id;
            return (
              <button
                key={themeOption.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleThemeChange(themeOption.id)}
                disabled={Boolean(savingThemeId)}
                className="group flex cursor-pointer flex-col self-start text-left"
              >
                <ThemePreview mode={themeOption.id} selected={isSelected} />
                <span className="mt-2 flex items-center gap-1.5 text-sm font-medium text-heading">
                  {isSaving ? <Spinner size="sm" /> : isSelected && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  {themeOption.label}
                </span>
                <span className="block text-xs text-muted">{themeOption.description}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Profile" description="How you appear to teammates in shared projects and activity.">
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar src={avatarUrl} name={fullName || user?.full_name || "User"} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-heading">{user?.full_name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>

          <Input label="Full name" id="settingsFullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <div>
            <p className="mb-1.5 text-xs font-medium text-heading">Avatar</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
              {AVATAR_PRESETS.map((preset) => {
                const active = avatarUrl === preset.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={preset.label}
                    title={preset.label}
                    onClick={() => setAvatarUrl(preset.value)}
                    className={cn(
                      "cursor-pointer rounded-full transition-transform hover:scale-105",
                      active && "ring-2 ring-heading ring-offset-2 ring-offset-surface"
                    )}
                  >
                    <Avatar src={preset.value} name={preset.label} size="md" />
                  </button>
                );
              })}
            </div>
          </div>

          <Select label="Timezone" id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={TIMEZONE_OPTIONS} />

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSavingProfile}>Save profile</Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        id="assistant"
        title="Assistant"
        description="Ask questions about your workspace, using the workspace AI key or your own."
      >
        <AssistantSettings />
      </SettingsSection>

      <SettingsSection
        id="api-keys"
        title="API keys"
        description="Bring your own key to use the assistant and choose its models."
      >
        <ApiKeysSettings />
      </SettingsSection>

      <SettingsSection
        id="memory"
        title="Memory"
        description="What the assistant should know about you. It reads these at the start of each new conversation."
      >
        <MemorySettings />
      </SettingsSection>

      <SettingsSection
        id="invitations"
        title="Invitations"
        description="Optimus is invite-only. Each link works once and expires in seven days."
      >
        <InvitationsPanel />
      </SettingsSection>

      <SettingsSection title="Password" description="You'll stay signed in here; other sessions are signed out.">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input label="Current password" id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="New password" id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required hint="At least 8 characters" />
            <Input
              label="Confirm new password"
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              error={confirmNewPassword && newPassword !== confirmNewPassword ? "Passwords don't match" : ""}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" isLoading={isSavingPassword}>Update password</Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Sessions" description="Devices currently signed in to your account.">
        {isLoadingSessions ? (
          <div className="space-y-3">
            {[0, 1].map((row) => <div key={row} className="skeleton h-10" />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted">No active sessions found.</p>
        ) : (
          <div className="card divide-y divide-border overflow-hidden">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 px-4 py-3">
                <Monitor className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-heading">
                    {parseDeviceInfo(session.device_info)}
                    {session.is_current && <Badge variant="success" size="sm">This device</Badge>}
                  </p>
                  <p className="font-mono text-[0.6875rem] text-muted">
                    {session.ip_address || "Unknown IP"} · {formatDate(session.created_at)}
                  </p>
                </div>
                {!session.is_current && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(session.id)} className="text-danger! hover:bg-danger-light!">
                    Sign out
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Delete account" description="Permanently remove your private data and credentials.">
        <div className="rounded-xl border border-danger/25 p-4">
          <p className="text-sm text-body">
            Shared project work transfers to remaining members, as described in the deletion policy.
          </p>
          <Link href="/account-deletion" className="btn-base btn-danger mt-4">
            Review account deletion
          </Link>
        </div>
      </SettingsSection>
    </div>
  );
}
