import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { transaction } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getTokensFromCode, createOAuth2Client } from "@/lib/google";
import { calendarSyncJob } from "@/lib/integrationJobs";
import { encryptSecret } from "@/lib/secretEncryption";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denying access
  if (error) {
    return NextResponse.redirect(
      new URL(`/calendar?google=error&message=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Verify user is authenticated
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verify state token (CSRF protection)
  let statePayload;
  try {
    statePayload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return NextResponse.redirect(
      new URL("/calendar?google=error&message=invalid_state", request.url)
    );
  }

  if (!code || statePayload.userId !== user.id) {
    return NextResponse.redirect(
      new URL("/calendar?google=error&message=user_mismatch", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Get Google email
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store credentials and the durable initial-sync job atomically. The OAuth
    // callback stays fast; a retryable worker performs remote I/O afterwards.
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO google_connections (user_id, google_email, access_token, refresh_token, token_expiry, scope)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           google_email = $2, access_token = $3,
           refresh_token = COALESCE($4, google_connections.refresh_token),
           token_expiry = $5, scope = $6, updated_at = NOW()`,
        [
          user.id,
          userInfo.data.email,
          encryptSecret(tokens.access_token),
          tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
          new Date(tokens.expiry_date).toISOString(),
          tokens.scope,
        ]
      );
      await calendarSyncJob({ userId: user.id, source: "oauth_callback", db: client });
    });

    return NextResponse.redirect(
      new URL("/calendar?google=connected&sync=queued", request.url)
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(
        "/calendar?google=error&message=connection_failed",
        request.url
      )
    );
  }
}
