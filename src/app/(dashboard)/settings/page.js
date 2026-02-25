"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/components/ui";
import { authService } from "@/services/api";
import { useGoogleConnection } from "@/hooks/useGoogleCalendar";
import { Button, Input, Select, Card, Avatar, Badge, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

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
  const searchParams = useSearchParams();

  // Google Calendar connection
  const {
    status: googleStatus,
    isLoading: googleLoading,
    isSyncing,
    connect: connectGoogle,
    disconnect: disconnectGoogle,
    sync: syncGoogle,
  } = useGoogleConnection();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState(user?.full_name || "");
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

  // Handle Google OAuth redirect
  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") {
      addToast({ message: "Google Calendar connected successfully!", type: "success" });
      window.history.replaceState({}, "", "/settings");
    } else if (googleParam === "error") {
      const message = searchParams.get("message") || "Failed to connect Google";
      addToast({ message: `Google error: ${message}`, type: "error" });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

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
      const data = await authService.updateProfile({ fullName, timezone });
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
      <div className="mb-8">
        <h1 className="text-h1">Settings</h1>
        <p className="text-body text-muted! mt-2">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <h2 className="text-h3 mb-6">Profile</h2>

        <div className="flex items-center gap-4 mb-6">
          <Avatar name={user?.full_name || "User"} size="xl" />
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
        <div className="grid grid-cols-3 gap-3">
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

      {/* Google Calendar */}
      <Card className="mb-6">
        <h2 className="text-h3 mb-6">Google Calendar</h2>

        {googleLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : googleStatus.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-tertiary rounded-lg">
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-body-sm text-heading! font-medium">Connected</p>
                <p className="text-caption">{googleStatus.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await syncGoogle();
                    addToast({
                      message: `Synced ${result.eventsSynced} events from ${result.calendarsImported} calendars`,
                      type: "success",
                    });
                  } catch (err) {
                    addToast({ message: err.message, type: "error" });
                  }
                }}
                isLoading={isSyncing}
                leftIcon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                  </svg>
                }
              >
                Sync Now
              </Button>

              {showDisconnectConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-muted">Are you sure?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      try {
                        await disconnectGoogle();
                        setShowDisconnectConfirm(false);
                        addToast({ message: "Google Calendar disconnected", type: "success" });
                      } catch (err) {
                        addToast({ message: err.message, type: "error" });
                      }
                    }}
                  >
                    Yes, disconnect
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="text-danger! hover:text-danger-hover!"
                >
                  Disconnect
                </Button>
              )}
            </div>

            {googleStatus.connectedAt && (
              <p className="text-caption">
                Connected since {formatDate(googleStatus.connectedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-body-sm text-muted!">
              Connect your Google account to sync calendars and events.
            </p>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await connectGoogle();
                } catch (err) {
                  addToast({ message: err.message, type: "error" });
                }
              }}
              leftIcon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              }
            >
              Connect Google Calendar
            </Button>
          </div>
        )}
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
