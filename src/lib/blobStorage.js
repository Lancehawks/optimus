import { del } from "@vercel/blob";
import { logError } from "@/lib/logger";

// Vercel Blob holds uploaded files. Every blob is private: the SDK reads
// BLOB_READ_WRITE_TOKEN, and files reach the browser only through
// /api/files/<id>, which checks access first.

export const BLOB_NOT_CONFIGURED = "File uploads aren't set up yet. Add BLOB_READ_WRITE_TOKEN to the environment.";

export function isBlobConfigured(env = process.env) {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

// Best effort: a blob left behind costs storage but is unreachable without
// its database row.
export async function deleteBlobs(pathnames) {
  const targets = [...new Set(pathnames.filter(Boolean))];
  if (targets.length === 0 || !isBlobConfigured()) return;
  try {
    await del(targets);
  } catch (error) {
    logError("blob.delete_failed", error, { count: targets.length });
  }
}
