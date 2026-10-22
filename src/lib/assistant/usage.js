import { monthStartUtc } from "./store.js";

// Assistant spend for the admin page. Figures come from ai_usage, which holds
// token counts and estimated cost per model call and never message content.

const DAILY_WINDOW_DAYS = 30;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

export async function usageSummary(db, { now = new Date(), budgetUsd }) {
  const monthStart = monthStartUtc(now).toISOString();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - (DAILY_WINDOW_DAYS - 1));

  const [totals, members, daily, models] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS calls,
              COALESCE(SUM(input_tokens + cache_read_tokens + cache_write_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
              COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE created_at >= $1`,
      [monthStart]
    ),
    db.query(
      `SELECT a.user_id, u.full_name, u.email,
              COUNT(*)::int AS calls,
              COALESCE(SUM(a.input_tokens + a.cache_read_tokens + a.cache_write_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(a.output_tokens), 0)::bigint AS output_tokens,
              COALESCE(SUM(a.cost_usd), 0) AS cost,
              MAX(a.created_at) AS last_used_at
       FROM ai_usage a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.created_at >= $1
       GROUP BY a.user_id, u.full_name, u.email
       ORDER BY cost DESC, calls DESC`,
      [monthStart]
    ),
    db.query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS calls,
              COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE created_at >= $1
       GROUP BY 1 ORDER BY 1`,
      [windowStart.toISOString()]
    ),
    db.query(
      `SELECT provider, model, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE created_at >= $1
       GROUP BY provider, model ORDER BY cost DESC`,
      [monthStart]
    ),
  ]);

  const byDay = new Map(daily.rows.map((row) => [row.day, row]));
  const days = [];
  for (let date = new Date(windowStart); date <= today; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = dayKey(date);
    const row = byDay.get(key);
    days.push({ day: key, calls: row?.calls || 0, cost: Number(row?.cost || 0) });
  }

  const month = totals.rows[0];
  return {
    month: dayKey(monthStartUtc(now)).slice(0, 7),
    budgetUsd,
    spentUsd: Number(month.cost),
    calls: month.calls,
    inputTokens: Number(month.input_tokens),
    outputTokens: Number(month.output_tokens),
    members: members.rows.map((row) => ({
      id: row.user_id,
      name: row.full_name || "Former member",
      email: row.email || null,
      calls: row.calls,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      costUsd: Number(row.cost),
      lastUsedAt: row.last_used_at,
    })),
    daily: days,
    models: models.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: row.calls,
      costUsd: Number(row.cost),
    })),
  };
}
