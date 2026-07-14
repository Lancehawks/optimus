import { query } from "@/lib/db";
import { verifyPassword, createSession, setAuthCookie } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || typeof password !== "string") {
      return apiError("Email and password are required");
    }

    const rateLimit = checkRateLimits(request, [
      { scope: "auth:login:ip", limit: 20, windowMs: RATE_LIMIT_WINDOW_MS },
      {
        scope: "auth:login:email",
        identifier: normalizedEmail,
        limit: 5,
        windowMs: RATE_LIMIT_WINDOW_MS,
      },
    ]);

    if (!rateLimit.allowed) {
      return apiError("Too many login attempts. Please try again later.", 429);
    }

    // Find user
    const result = await query(
      "SELECT id, email, password_hash, full_name, avatar_url, timezone, preferences, is_active FROM users WHERE email = $1",
      [normalizedEmail]
    );

    const user = result.rows[0];
    if (!user) {
      return apiError("Invalid email or password", 401);
    }

    if (!user.is_active) {
      return apiError("Account is deactivated", 403);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return apiError("Invalid email or password", 401);
    }

    // Generate token and create session
    const token = await createSession(user, request);
    await setAuthCookie(token);

    const { password_hash, is_active, ...safeUser } = user;
    return apiResponse({ user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Internal server error", 500);
  }
}
