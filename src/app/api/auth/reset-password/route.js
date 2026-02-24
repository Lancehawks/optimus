import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return apiError("Token and new password are required");
    }

    if (password.length < 8) {
      return apiError("Password must be at least 8 characters");
    }

    // Find valid reset token
    const result = await query(
      `SELECT pr.id, pr.user_id FROM password_resets pr
       WHERE pr.token = $1 AND pr.used = false AND pr.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return apiError("Invalid or expired reset token");
    }

    const { user_id } = result.rows[0];
    const passwordHash = await hashPassword(password);

    // Update password and mark token as used
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user_id]);
    await query("UPDATE password_resets SET used = true WHERE token = $1", [token]);

    // Invalidate all sessions for security
    await query("DELETE FROM sessions WHERE user_id = $1", [user_id]);

    return apiResponse({ message: "Password reset successfully. Please sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return apiError("Internal server error", 500);
  }
}
