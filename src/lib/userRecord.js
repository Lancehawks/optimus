// Every signed-in request reads the user's row. Reading it as JSON means a
// deploy that runs ahead of its migration sees a new column as absent (no
// admin role, assistant off) instead of failing every request with "column
// does not exist". The password hash never leaves the database.
export function userRecordSql(alias) {
  return `to_jsonb(${alias}) - 'password_hash' AS account`;
}

export function toSessionUser(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    full_name: account.full_name,
    avatar_url: account.avatar_url ?? null,
    timezone: account.timezone ?? "UTC",
    preferences: account.preferences ?? {},
    is_active: account.is_active !== false,
    role: account.role === "admin" ? "admin" : "member",
    ai_assistant_enabled_at: account.ai_assistant_enabled_at ?? null,
  };
}

export function isAdmin(user) {
  return user?.role === "admin";
}
