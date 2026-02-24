import crypto from "crypto";
import { query } from "@/lib/db";
import { apiResponse, apiError } from "@/lib/apiUtils";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return apiError("Email is required");
    }

    // Always return success to prevent email enumeration
    const result = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);

    if (result.rows.length > 0) {
      const userId = result.rows[0].id;
      const token = crypto.randomBytes(32).toString("hex");

      // Invalidate any existing reset tokens for this user
      await query("UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false", [userId]);

      await query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [userId, token]
      );

      // In production, send an email with the reset link
      // For now, log it (the token can be used via /reset-password?token=...)
      console.log(`Password reset token for ${email}: ${token}`);
    }

    return apiResponse({
      message: "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return apiError("Internal server error", 500);
  }
}
