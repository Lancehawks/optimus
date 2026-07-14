import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import { apiResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  try {
    const { email } = await request.json().catch(() => ({}));
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return apiError("Email is required");
    }

    const rateLimit = checkRateLimits(request, [
      { scope: "auth:forgot-password:ip", limit: 10, windowMs: RATE_LIMIT_WINDOW_MS },
      {
        scope: "auth:forgot-password:email",
        identifier: normalizedEmail,
        limit: 3,
        windowMs: RATE_LIMIT_WINDOW_MS,
      },
    ]);

    if (!rateLimit.allowed) {
      return apiError("Too many reset requests. Please try again later.", 429);
    }

    // Always return success to prevent email enumeration
    const result = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    let devResetToken = null;

    if (result.rows.length > 0) {
      const userId = result.rows[0].id;
      const token = crypto.randomBytes(32).toString("hex");

      await transaction(async (client) => {
        // Invalidate any existing reset tokens for this user
        await client.query(
          "UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false",
          [userId]
        );

        await client.query(
          `INSERT INTO password_resets (user_id, token, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
          [userId, token]
        );
      });

      if (process.env.NODE_ENV !== "production") {
        devResetToken = token;
      }
    }

    const response = {
      message: "If an account exists with that email, a password reset link has been sent.",
    };

    if (devResetToken) {
      response.devResetToken = devResetToken;
    }

    return apiResponse(response);
  } catch (error) {
    console.error("Forgot password error:", error);
    return apiError("Internal server error", 500);
  }
}
