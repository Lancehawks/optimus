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

export function resolveDatabaseUrl(environment = process.env) {
  const value = environment.DATABASE_URL?.trim() || environment.POSTGRES_URL?.trim();

  if (!value) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL (or POSTGRES_URL) in the deployment environment."
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The configured database URL is not a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("The configured database URL is not a valid PostgreSQL URL.");
  }

  return normalizeDatabaseUrl(value, {
    forceTls: environment.DATABASE_SSL === "require",
  });
}
