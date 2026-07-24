export function normalizeDatabaseUrl(value, { forceTls = false } = {}) {
  if (!value) return value;
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get("sslmode");
    // node-postgres currently treats "require" as verify-full but will weaken
    // that behavior in its next major version. Make the secure intent explicit.
    if (forceTls || sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return value;
  }
}
