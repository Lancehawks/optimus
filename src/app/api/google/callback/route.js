import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { consumeGoogleOAuthFlow } from "@/lib/googleOAuthFlow";
import { completeGoogleOAuthConnection } from "@/lib/googleOAuthCompletion";
import {
  isMobileGoogleOAuthState,
  mobileGoogleOAuthResultUrl,
} from "@/lib/googleOAuthPrimitives";
import { logError } from "@/lib/logger";

function oauthRedirect(url, status) {
  const response = NextResponse.redirect(url, status);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function webCalendarRedirect(request, status, reason = null) {
  const url = new URL("/calendar", request.url);
  url.searchParams.set("google", status);
  if (reason) url.searchParams.set("message", reason);
  if (status === "connected") url.searchParams.set("sync", "queued");
  return oauthRedirect(url);
}

function mobileResultRedirect(status, reason = null) {
  try {
    return oauthRedirect(
      mobileGoogleOAuthResultUrl(status, reason),
      303
    );
  } catch (error) {
    logError("google_oauth.mobile_return_invalid", error);
    return NextResponse.json(
      { error: "Mobile Google OAuth return is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

function oauthErrorReason(error) {
  return error === "access_denied" ? "access_denied" : "oauth_error";
}

async function handleMobileCallback({ state, code, oauthError }) {
  let flow;
  try {
    flow = await consumeGoogleOAuthFlow({
      state,
      clientType: "mobile",
    });
  } catch (error) {
    logError("google_oauth.mobile_state_failed", error);
    return mobileResultRedirect("error", "connection_failed");
  }

  if (!flow) return mobileResultRedirect("error", "invalid_state");
  if (oauthError) return mobileResultRedirect("error", oauthErrorReason(oauthError));
  if (!code) return mobileResultRedirect("error", "oauth_error");

  try {
    await completeGoogleOAuthConnection({
      userId: flow.userId,
      code,
      codeVerifier: flow.codeVerifier,
    });
    return mobileResultRedirect("connected");
  } catch (error) {
    logError("google_oauth.mobile_completion_failed", error, {
      clientType: "mobile",
    });
    return mobileResultRedirect("error", "connection_failed");
  }
}

async function handleWebCallback(request, { state, code, oauthError }) {
  let user;
  try {
    user = await getAuthUser(request);
  } catch (error) {
    logError("google_oauth.web_auth_failed", error);
    return webCalendarRedirect(request, "error", "connection_failed");
  }
  if (!user) return oauthRedirect(new URL("/", request.url));

  let flow;
  try {
    flow = await consumeGoogleOAuthFlow({
      state,
      clientType: "web",
      expectedUserId: user.id,
    });
  } catch (error) {
    logError("google_oauth.web_state_failed", error, { userId: user.id });
    return webCalendarRedirect(request, "error", "connection_failed");
  }

  if (!flow) return webCalendarRedirect(request, "error", "invalid_state");
  if (oauthError) {
    return webCalendarRedirect(request, "error", oauthErrorReason(oauthError));
  }
  if (!code) return webCalendarRedirect(request, "error", "oauth_error");

  try {
    await completeGoogleOAuthConnection({
      userId: flow.userId,
      code,
      codeVerifier: flow.codeVerifier,
    });
    return webCalendarRedirect(request, "connected");
  } catch (error) {
    logError("google_oauth.web_completion_failed", error, {
      userId: user.id,
      clientType: "web",
    });
    return webCalendarRedirect(request, "error", "connection_failed");
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state") || "";
  const callback = {
    state,
    code: searchParams.get("code"),
    oauthError: searchParams.get("error"),
  };

  if (isMobileGoogleOAuthState(state)) {
    return handleMobileCallback(callback);
  }
  return handleWebCallback(request, callback);
}
