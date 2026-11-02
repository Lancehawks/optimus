import { transaction } from "@/lib/db";
import { hashPassword, hashToken } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  try {
    const { token, password } = await request.json().catch(() => ({}));
    const resetToken = typeof token === "string" ? token.trim() : "";

    if (!resetToken || typeof password !== "string") {
      return apiError("Token and new password are required");
    }

    const rateLimit = await checkRateLimits(request, [
      { scope: "auth:reset-password:ip", limit: 10, windowMs: RATE_LIMIT_WINDOW_MS },
      {
        scope: "auth:reset-password:token",
        identifier: resetToken,
        limit: 5,
        windowMs: RATE_LIMIT_WINDOW_MS,
      },
    ]);

    if (!rateLimit.allowed) {
      return apiError("Too many reset attempts. Please try again later.", 429);
    }

    if (password.length < 8) {
      return apiError("Password must be at least 8 characters");
    }
    if (password.length > 128) return apiError("Password must be 128 characters or less");

    const resetApplied = await transaction(async (client) => {
      // Find and lock the valid reset token so it cannot be reused concurrently.
      const result = await client.query(
        `SELECT pr.id, pr.user_id FROM password_resets pr
         WHERE pr.token_hash = $1 AND pr.used = false AND pr.expires_at > NOW()
         FOR UPDATE`,
        [hashToken(resetToken)]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const { user_id } = result.rows[0];
      const passwordHash = await hashPassword(password);

      // Update password, mark token as used, and invalidate all sessions together.
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user_id]);
      await client.query("UPDATE password_resets SET used = true WHERE token_hash = $1", [hashToken(resetToken)]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [user_id]);

      return true;
    });

    if (!resetApplied) {
      return apiError("Invalid or expired reset token");
    }

    return apiResponse({ message: "Password reset successfully. Please sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return apiError("Internal server error", 500);
  }
}
