import { query } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { normalizeAvatarValue } from "@/lib/avatarOptions";
import { changePasswordAndRevokeOtherSessions } from "@/lib/passwordChange";
import { checkRateLimits } from "@/lib/rateLimit";

const PASSWORD_CHANGE_WINDOW_MS = 60 * 60 * 1000;

export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { fullName, avatarUrl, timezone, preferences, currentPassword, newPassword } = body;
    const userId = request.user.id;

    // Handle password change
    if (newPassword) {
      if (
        fullName !== undefined
        || avatarUrl !== undefined
        || timezone !== undefined
        || preferences !== undefined
      ) {
        return apiError("Change the password separately from profile updates");
      }
      if (typeof currentPassword !== "string" || !currentPassword) {
        return apiError("Current password is required to set a new password");
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return apiError("New password must be at least 8 characters");
      }
      if (newPassword.length > 128) {
        return apiError("New password must be 128 characters or less");
      }
      const currentSessionToken = getTokenFromRequest(request);
      if (!currentSessionToken) return apiError("Unauthorized", 401);

      const rateLimit = await checkRateLimits(request, [
        {
          scope: "auth:password-change:user",
          identifier: userId,
          limit: 5,
          windowMs: PASSWORD_CHANGE_WINDOW_MS,
        },
      ]);
      if (!rateLimit.allowed) {
        return apiError(
          "Too many password change attempts. Please try again later.",
          429
        );
      }

      const changed = await changePasswordAndRevokeOtherSessions({
        userId,
        currentSessionToken,
        currentPassword,
        newPassword,
      });
      if (!changed.changed) {
        return apiError(
          changed.reason === "password"
            ? "Current password is incorrect"
            : "Unauthorized",
          changed.reason === "password" ? 403 : 401
        );
      }
    }

    // Update profile fields
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (fullName !== undefined) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(fullName);
    }
    if (avatarUrl !== undefined) {
      const normalizedAvatarUrl = normalizeAvatarValue(avatarUrl);
      if (avatarUrl && !normalizedAvatarUrl) {
        return apiError("Choose one of the available avatars");
      }
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(normalizedAvatarUrl || null);
    }
    if (timezone !== undefined) {
      fields.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
    }
    if (preferences !== undefined) {
      fields.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(preferences));
    }

    if (fields.length > 0) {
      values.push(userId);
      const result = await query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex}
         RETURNING id, email, full_name, avatar_url, timezone, preferences`,
        values
      );
      return apiResponse({ user: result.rows[0] });
    }

    return apiResponse({ user: request.user });
  } catch (error) {
    console.error("Profile update error:", error);
    return apiError("Internal server error", 500);
  }
});
