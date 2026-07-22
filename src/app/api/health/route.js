import { query } from "@/lib/db";
import { apiResponse } from "@/lib/apiUtils";
import { isEmailDeliveryConfigured } from "@/lib/email";
import { validateEncryptionConfiguration } from "@/lib/secretEncryption";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
    email: isEmailDeliveryConfigured(),
    tokenEncryption: validateEncryptionConfiguration(),
    googleTokensEncrypted: false,
    integrationWorker: false,
    publicUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };

  try {
    const health = await query(`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(access_token NOT LIKE 'enc:v1:%', TRUE)
             OR COALESCE(refresh_token NOT LIKE 'enc:v1:%', TRUE)
        )::int AS plaintext_google_connections,
        (SELECT COUNT(*) FROM integration_jobs
          WHERE status = 'queued' AND available_at < NOW() - INTERVAL '15 minutes')::int AS stale_jobs,
        (SELECT COUNT(*) FROM integration_jobs WHERE status = 'failed')::int AS failed_jobs
      FROM google_connections
    `);
    checks.database = true;
    checks.googleTokensEncrypted = health.rows[0].plaintext_google_connections === 0;
    checks.integrationWorker = health.rows[0].stale_jobs === 0 && health.rows[0].failed_jobs === 0;
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
