import { query } from "@/lib/db";
import { hashPassword, generateToken, setAuthCookie } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";

export async function POST(request) {
  try {
    const { email, password, fullName } = await request.json();

    if (!email || !password || !fullName) {
      return apiError("Email, password, and full name are required");
    }

    if (password.length < 8) {
      return apiError("Password must be at least 8 characters");
    }

    // Check if user already exists
    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return apiError("An account with this email already exists");
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, avatar_url, timezone, preferences`,
      [email.toLowerCase(), passwordHash, fullName]
    );

    const user = result.rows[0];

    // Generate token and create session
    const token = generateToken(user);
    await query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, token]
    );

    await setAuthCookie(token);

    return apiResponse({ user }, 201);
  } catch (error) {
    console.error("Signup error:", error);
    return apiError("Internal server error", 500);
  }
}
