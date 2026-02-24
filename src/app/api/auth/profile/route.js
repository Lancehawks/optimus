import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { fullName, timezone, preferences, currentPassword, newPassword } = body;
    const userId = request.user.id;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return apiError("Current password is required to set a new password");
      }

      const userResult = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
      const isValid = await verifyPassword(currentPassword, userResult.rows[0].password_hash);
      if (!isValid) {
        return apiError("Current password is incorrect");
      }

      if (newPassword.length < 8) {
        return apiError("New password must be at least 8 characters");
      }

      const passwordHash = await hashPassword(newPassword);
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    }

    // Update profile fields
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (fullName !== undefined) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(fullName);
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
