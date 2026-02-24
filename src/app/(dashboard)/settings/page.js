"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui";
import { authService } from "@/services/api";
import { Button, Input, Select, Card, Avatar, Badge, Spinner } from "@/components/ui";
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
  const { addToast } = useToast();

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
