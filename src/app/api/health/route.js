import { query } from "@/lib/db";
import { apiResponse } from "@/lib/apiUtils";
import { isEmailDeliveryConfigured } from "@/lib/email";
import { validateEncryptionConfiguration } from "@/lib/secretEncryption";
import { validateMobileGoogleOAuthReturnUrl } from "@/lib/googleOAuthPrimitives";
import {
  validateAndroidAssetLinks,
  validateAppleAppSiteAssociation,
  validateMobileAppLinkOrigin,
} from "@/lib/mobileAppLinks";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
    email: isEmailDeliveryConfigured(),
    tokenEncryption: validateEncryptionConfiguration(),
    googleTokensEncrypted: false,
    googleOAuthFlowsSecure: false,
    publicUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    mobileGoogleOAuthReturn: validateMobileGoogleOAuthReturnUrl(),
    mobileAppLinkOrigin: validateMobileAppLinkOrigin(),
    appleAppSiteAssociation: validateAppleAppSiteAssociation(),
    androidAssetLinks: validateAndroidAssetLinks(),
  };

  try {
    const health = await query(`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(access_token NOT LIKE 'enc:v1:%', TRUE)
             OR COALESCE(refresh_token NOT LIKE 'enc:v1:%', TRUE)
        )::int AS plaintext_google_connections,
        (SELECT COUNT(*) FROM google_oauth_flows
          WHERE length(state_hash) <> 64
             OR code_verifier_ciphertext NOT LIKE 'enc:v1:%')::int AS invalid_google_oauth_flows
      FROM google_connections
    `);
    checks.database = true;
    checks.googleTokensEncrypted = health.rows[0].plaintext_google_connections === 0;
    checks.googleOAuthFlowsSecure = health.rows[0].invalid_google_oauth_flows === 0;
  } catch {
    // Do not expose connection errors or credentials in a public health route.
  }

  const productionReady = process.env.NODE_ENV !== "production"
    ? checks.database
    : Object.values(checks).every(Boolean);

  return apiResponse(
    {
      status: productionReady ? "ok" : "not_ready",
      checks,
      release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "unknown",
      timestamp: new Date().toISOString(),
    },
    productionReady ? 200 : 503
  );
}
