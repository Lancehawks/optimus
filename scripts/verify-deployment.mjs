import process from "node:process";

const baseUrl = (process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!baseUrl) throw new Error("PRODUCTION_URL or NEXT_PUBLIC_SITE_URL is required.");

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "optimus-deployment-verifier/1.0" },
  });
  return response;
}

const healthResponse = await get("/api/health");
if (healthResponse.status !== 200) {
  throw new Error(`Health check failed with ${healthResponse.status}.`);
}
const health = await healthResponse.json();
if (health.status !== "ok") throw new Error(`Deployment is not ready: ${JSON.stringify(health.checks)}`);
if (process.env.EXPECTED_RELEASE && health.release !== process.env.EXPECTED_RELEASE) {
  throw new Error(`Expected release ${process.env.EXPECTED_RELEASE}, received ${health.release}.`);
}

for (const path of ["/api/dashboard/overview", "/api/jobs/integrations", "/api/jobs/notifications"]) {
  const response = await get(path);
  if (response.status === 404) throw new Error(`${path} is missing from the deployed build.`);
  if (![401, 403].includes(response.status)) {
    throw new Error(`${path} should reject an unauthenticated smoke request; received ${response.status}.`);
  }
}

for (const header of ["x-content-type-options", "x-frame-options", "content-security-policy"]) {
  if (!healthResponse.headers.get(header)) throw new Error(`Missing production security header: ${header}`);
}

process.stdout.write(`${JSON.stringify({ status: "ok", baseUrl, release: health.release, checks: health.checks })}\n`);
