import crypto from "node:crypto";

export function isAuthorizedCronRequest(request) {
  const expected = Buffer.from(process.env.CRON_SECRET || "");
  const supplied = Buffer.from(
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
  );
  return expected.length > 0
    && expected.length === supplied.length
    && crypto.timingSafeEqual(supplied, expected);
}
