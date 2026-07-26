import { google } from "googleapis";
import { transaction } from "@/lib/db";
import { calendarSyncJob } from "@/lib/integrationJobs";
import { createOAuth2Client, getTokensFromCode } from "@/lib/google";
import { encryptSecret } from "@/lib/secretEncryption";

export async function completeGoogleOAuthConnection({
  userId,
  code,
  codeVerifier,
}) {
  const tokens = await getTokensFromCode(code, codeVerifier);
  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error("Google OAuth did not return a usable access token");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const googleEmail = userInfo.data.email;
  if (!googleEmail) throw new Error("Google OAuth did not return an account email");

  await transaction(async (client) => {
    const existing = await client.query(
      "SELECT refresh_token FROM google_connections WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing.rows[0]?.refresh_token;
    if (!encryptedRefreshToken) {
      throw new Error("Google OAuth did not return a refresh token");
    }

    await client.query(
      `INSERT INTO google_connections
         (user_id, google_email, access_token, refresh_token, token_expiry, scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         google_email = EXCLUDED.google_email,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry = EXCLUDED.token_expiry,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [
        userId,
        googleEmail,
        encryptSecret(tokens.access_token),
        encryptedRefreshToken,
        new Date(tokens.expiry_date).toISOString(),
        tokens.scope || null,
      ]
    );
    await calendarSyncJob({ userId, source: "oauth_callback", db: client });
  });
}
