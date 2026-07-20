import { query } from "@/lib/db";
import { verifyPassword, createSession, isMobileApiRequest, setAuthCookie } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export async function POST(request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || normalizedEmail.length > 254 || typeof password !== "string" || password.length > 128) {
      return apiError("Email and password are required");
    }

    const rateLimit = await checkRateLimits(request, [
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
    // Always run bcrypt, including for unknown accounts, to reduce account
    // enumeration through response timing.
    const isValid = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !isValid) {
      return apiError("Invalid email or password", 401);
    }

    if (!user.is_active) return apiError("Account is deactivated", 403);

    // Generate token and create session
    const token = await createSession(user, request);
    await setAuthCookie(token);

    const { password_hash, is_active, ...safeUser } = user;
    return apiResponse({
      user: safeUser,
      ...(isMobileApiRequest(request) ? { token } : {}),
    });
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Internal server error", 500);
  }
}
