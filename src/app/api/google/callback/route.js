import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { query } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getTokensFromCode, createOAuth2Client } from "@/lib/google";
import { importGoogleCalendars, syncGoogleEvents } from "@/lib/googleSync";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denying access
  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?google=error&message=${encodeURIComponent(error)}`, request.url)
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
      new URL("/settings?google=error&message=invalid_state", request.url)
    );
  }

  if (statePayload.userId !== user.id) {
    return NextResponse.redirect(
      new URL("/settings?google=error&message=user_mismatch", request.url)
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

    // Upsert google_connections
    await query(
      `INSERT INTO google_connections (user_id, google_email, access_token, refresh_token, token_expiry, scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         google_email = $2, access_token = $3,
         refresh_token = COALESCE($4, google_connections.refresh_token),
         token_expiry = $5, scope = $6, updated_at = NOW()`,
      [
        user.id,
        userInfo.data.email,
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date).toISOString(),
        tokens.scope,
      ]
    );

    // Import calendars and do initial sync
    const calendarIds = await importGoogleCalendars(user.id);
    for (const calId of calendarIds) {
      await syncGoogleEvents(user.id, calId);
    }

    return NextResponse.redirect(
      new URL("/settings?google=connected", request.url)
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(
        `/settings?google=error&message=${encodeURIComponent(err.message)}`,
        request.url
      )
    );
  }
}
