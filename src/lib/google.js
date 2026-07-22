import { google } from "googleapis";
import { query } from "@/lib/db";
import jwt from "jsonwebtoken";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secretEncryption";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(userId) {
  const oauth2Client = createOAuth2Client();
  const state = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function getTokensFromCode(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getCalendarClient(userId) {
  const result = await query(
    "SELECT * FROM google_connections WHERE user_id = $1",
    [userId]
  );
  if (result.rows.length === 0) return null;

  const conn = result.rows[0];
  if (!isEncryptedSecret(conn.access_token) || !isEncryptedSecret(conn.refresh_token)) {
    throw new Error("Google connection tokens require the encryption migration before use.");
  }
  const accessToken = decryptSecret(conn.access_token);
  const refreshToken = decryptSecret(conn.refresh_token);

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: new Date(conn.token_expiry).getTime(),
  });

  // Auto-refresh: persist new tokens when Google refreshes them
  oauth2Client.on("tokens", async (tokens) => {
    const updates = ["updated_at = NOW()"];
    const values = [];
    let idx = 1;

    if (tokens.access_token) {
      updates.push(`access_token = $${idx++}`);
      values.push(encryptSecret(tokens.access_token));
    }
    if (tokens.expiry_date) {
      updates.push(`token_expiry = $${idx++}`);
      values.push(new Date(tokens.expiry_date).toISOString());
    }
    if (tokens.refresh_token) {
      updates.push(`refresh_token = $${idx++}`);
      values.push(encryptSecret(tokens.refresh_token));
    }

    values.push(userId);
    await query(
      `UPDATE google_connections SET ${updates.join(", ")} WHERE user_id = $${idx}`,
      values
    );
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}
