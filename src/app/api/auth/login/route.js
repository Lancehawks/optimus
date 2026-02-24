import { query } from "@/lib/db";
import { verifyPassword, generateToken, setAuthCookie } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return apiError("Email and password are required");
    }

    // Find user
    const result = await query(
      "SELECT id, email, password_hash, full_name, avatar_url, timezone, preferences, is_active FROM users WHERE email = $1",
      [email.toLowerCase()]
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
    const token = generateToken(user);
    const headers = request.headers;
    const deviceInfo = headers.get("user-agent")?.substring(0, 255) || null;
    const ipAddress = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    await query(
      `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.id, token, deviceInfo, ipAddress]
    );

    await setAuthCookie(token);

    const { password_hash, is_active, ...safeUser } = user;
    return apiResponse({ user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Internal server error", 500);
  }
}
