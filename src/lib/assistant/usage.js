import { modelLabel, monthStartUtc } from "./store.js";

// Assistant spend for the admin page. Figures come from ai_usage, which holds
// token counts and cost per model call and never message content. Spend on
// the workspace key is what the monthly budget covers; calls paid with
// members' own keys are reported separately.

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
      `SELECT key_source,
              COUNT(*)::int AS calls,
              COALESCE(SUM(input_tokens + cache_read_tokens + cache_write_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
              COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE created_at >= $1
       GROUP BY key_source`,
      [monthStart]
    ),
    db.query(
      `SELECT a.user_id, u.full_name, u.email,
              COUNT(*)::int AS calls,
              COALESCE(SUM(a.input_tokens + a.cache_read_tokens + a.cache_write_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(a.output_tokens), 0)::bigint AS output_tokens,
              COALESCE(SUM(a.cost_usd) FILTER (WHERE a.key_source = 'workspace'), 0) AS workspace_cost,
              COALESCE(SUM(a.cost_usd) FILTER (WHERE a.key_source = 'member'), 0) AS own_key_cost,
              MAX(a.created_at) AS last_used_at
       FROM ai_usage a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.created_at >= $1
       GROUP BY a.user_id, u.full_name, u.email
       ORDER BY workspace_cost DESC, calls DESC`,
      [monthStart]
    ),
    db.query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS calls,
              COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE created_at >= $1 AND key_source = 'workspace'
       GROUP BY 1 ORDER BY 1`,
      [windowStart.toISOString()]
    ),
    db.query(
      `SELECT provider, model, key_source, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE created_at >= $1
       GROUP BY provider, model, key_source ORDER BY cost DESC, calls DESC`,
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

  const source = (name) => totals.rows.find((row) => row.key_source === name) || {};
  const workspace = source("workspace");
  const ownKeys = source("member");
  return {
    month: dayKey(monthStartUtc(now)).slice(0, 7),
    budgetUsd,
    spentUsd: Number(workspace.cost || 0),
    calls: workspace.calls || 0,
    inputTokens: Number(workspace.input_tokens || 0),
    outputTokens: Number(workspace.output_tokens || 0),
    ownKeys: { calls: ownKeys.calls || 0, costUsd: Number(ownKeys.cost || 0) },
    members: members.rows.map((row) => ({
      id: row.user_id,
      name: row.full_name || "Former member",
      email: row.email || null,
      calls: row.calls,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      costUsd: Number(row.workspace_cost),
      ownKeyCostUsd: Number(row.own_key_cost),
      lastUsedAt: row.last_used_at,
    })),
    daily: days,
    models: models.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      label: modelLabel(row.provider, row.model),
      keySource: row.key_source,
      calls: row.calls,
      costUsd: Number(row.cost),
    })),
  };
}
