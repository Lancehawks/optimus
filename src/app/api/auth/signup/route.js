import { query, transaction } from "@/lib/db";
import { hashPassword, createSession, isMobileApiRequest, setAuthCookie } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  try {
    const { email, password, fullName } = await request.json().catch(() => ({}));
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedFullName = typeof fullName === "string" ? fullName.trim() : "";

    if (!normalizedEmail || normalizedEmail.length > 254 || typeof password !== "string" || !normalizedFullName) {
      return apiError("Email, password, and full name are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return apiError("Enter a valid email address");
    if (normalizedFullName.length > 150) return apiError("Full name must be 150 characters or less");

    const rateLimit = await checkRateLimits(request, [
      { scope: "auth:signup:ip", limit: 10, windowMs: RATE_LIMIT_WINDOW_MS },
      {
        scope: "auth:signup:email",
        identifier: normalizedEmail,
        limit: 3,
        windowMs: RATE_LIMIT_WINDOW_MS,
      },
    ]);

    if (!rateLimit.allowed) {
      return apiError("Too many signup attempts. Please try again later.", 429);
    }

    if (password.length < 8) {
      return apiError("Password must be at least 8 characters");
    }
    if (password.length > 128) return apiError("Password must be 128 characters or less");

    // Check if user already exists
    const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return apiError("An account with this email already exists");
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const { user, token } = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, avatar_url, timezone, preferences`,
        [normalizedEmail, passwordHash, normalizedFullName]
      );
      const createdUser = result.rows[0];
      const sessionToken = await createSession(createdUser, request, client);

      return { user: createdUser, token: sessionToken };
    });
    await setAuthCookie(token);

    return apiResponse({
      user,
      ...(isMobileApiRequest(request) ? { token } : {}),
    }, 201);
  } catch (error) {
    if (error.code === "23505") {
      return apiError("An account with this email already exists");
    }

    console.error("Signup error:", error);
    return apiError("Internal server error", 500);
  }
}
