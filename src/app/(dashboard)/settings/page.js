"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { authService } from "@/services/api";
import { Avatar, Badge, Button, Card, Input, Select, Spinner, useToast } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { AVATAR_PRESETS, normalizeAvatarValue } from "@/lib/avatarOptions";
import PageHeader from "@/components/layout/PageHeader";

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const { addToast } = useToast();

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

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    setFullName(user?.full_name || "");
    setAvatarUrl(normalizeAvatarValue(user?.avatar_url));
    setTimezone(user?.timezone || "UTC");
  }, [user]);

  const loadSessions = async () => {
    try {
      const data = await authService.getSessions();
      setSessions(data.sessions);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingSessions(false);
    }
  };

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

  const parseDeviceInfo = (deviceInfo) => {
    if (!deviceInfo) return "Unknown device";
    if (deviceInfo.includes("Chrome")) return "Chrome";
    if (deviceInfo.includes("Firefox")) return "Firefox";
    if (deviceInfo.includes("Safari")) return "Safari";
    if (deviceInfo.includes("Edge")) return "Edge";
    return deviceInfo.substring(0, 40);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        description="Account and preferences"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        }
      />

      {/* Profile Section */}
      <Card className="mb-6">
        <h2 className="text-h3 mb-6">Profile</h2>

        <div className="flex items-center gap-4 mb-6">
          <Avatar src={avatarUrl} name={fullName || user?.full_name || "User"} size="xl" />
          <div>
            <p className="text-body text-heading! font-medium">{user?.full_name}</p>
            <p className="text-body-sm text-muted!">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full name"
            id="settingsFullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <div>
            <p className="text-body-sm text-heading! font-medium block mb-2">
              Choose avatar
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarUrl(preset.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer",
                    avatarUrl === preset.value
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-border bg-surface-secondary hover:border-border-strong"
                  )}
                >
                  <Avatar src={preset.value} name={preset.label} size="sm" />
                  <span className="text-body-sm text-heading! font-medium truncate">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-caption mt-2">
              Used in shared projects, notifications, and activity.
            </p>
          </div>

          <div>
            <label htmlFor="timezone" className="text-body-sm text-heading! font-medium block mb-1.5">
              Timezone
            </label>
            <Select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={timezones}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={isSavingProfile}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Theme */}
      <Card className="mb-6">
        <h2 className="text-h3 mb-6">Theme</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                theme === t.id
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-border hover:border-border-strong"
              )}
            >
              <span
                className="w-8 h-8 rounded-full ring-2 ring-offset-2 ring-offset-surface"
                style={{
                  backgroundColor: t.swatch,
                  ringColor: theme === t.id ? t.swatch : "transparent",
                  boxShadow: theme === t.id ? `0 0 12px ${t.swatch}40` : "none",
                }}
              />
              <div className="text-center">
                <p className="text-body-sm text-heading! font-medium">{t.label}</p>
                <p className="text-caption">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Change Password */}
      <Card className="mb-6">
        <h2 className="text-h3 mb-6">Change password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label="Current password"
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label="New password"
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            hint="Must be at least 8 characters"
          />
          <Input
            label="Confirm new password"
            id="confirmNewPassword"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            error={confirmNewPassword && newPassword !== confirmNewPassword ? "Passwords do not match" : ""}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={isSavingPassword}>
              Update password
            </Button>
          </div>
        </form>
      </Card>

      {/* Active Sessions */}
      <Card>
        <h2 className="text-h3 mb-6">Active sessions</h2>

        {isLoadingSessions ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-body-sm text-muted!">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between py-3 border-b border-border-light last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-surface-tertiary rounded-lg">
                    <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body-sm text-heading! font-medium">
                        {parseDeviceInfo(session.device_info)}
                      </p>
                      {session.is_current && (
                        <Badge variant="success" size="sm">Current</Badge>
                      )}
                    </div>
                    <p className="text-caption">
                      {session.ip_address || "Unknown IP"} · {formatDate(session.created_at)}
                    </p>
                  </div>
                </div>

                {!session.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-danger! hover:text-danger-hover!"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
