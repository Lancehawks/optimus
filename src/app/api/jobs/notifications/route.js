import { transaction } from "@/lib/db";
import { apiError, apiResponse } from "@/lib/apiUtils";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) return apiError("Unauthorized", 401);

  try {
    const batchSize = Math.min(Math.max(Number(process.env.NOTIFICATION_SEED_BATCH) || 80, 10), 2000);
    const bucket = Math.floor(Date.now() / (5 * 60_000));
    const seeded = await transaction(async (client) => {
      const locked = await client.query(
        "SELECT pg_try_advisory_xact_lock(hashtext('optimus_notification_job_seed')) AS acquired"
      );
      if (!locked.rows[0]?.acquired) return { busy: true, count: 0 };

      await client.query("DELETE FROM rate_limit_buckets WHERE reset_at < NOW() - INTERVAL '1 day'");
      await client.query(
        `INSERT INTO job_checkpoints (job_name, cursor_value)
         VALUES ('notification_seed', NULL)
         ON CONFLICT (job_name) DO NOTHING`
      );
      const checkpoint = await client.query(
        "SELECT cursor_value FROM job_checkpoints WHERE job_name = 'notification_seed' FOR UPDATE"
      );
      let users = await client.query(
        `SELECT id FROM users
         WHERE is_active = TRUE AND ($1::uuid IS NULL OR id > $1::uuid)
         ORDER BY id LIMIT $2`,
        [checkpoint.rows[0]?.cursor_value || null, batchSize]
      );
      if (users.rows.length === 0) {
        users = await client.query(
          "SELECT id FROM users WHERE is_active = TRUE ORDER BY id LIMIT $1",
          [batchSize]
        );
      }
      if (users.rows.length === 0) return { busy: false, count: 0 };

      const ids = users.rows.map((row) => row.id);
      await client.query(
        `INSERT INTO integration_jobs
           (type, user_id, payload, idempotency_key, max_attempts)
         SELECT 'notification_sync', user_id, jsonb_build_object('bucket', $2::bigint),
                'notification-sync:' || user_id::text || ':' || $2::text, 5
         FROM unnest($1::uuid[]) AS seeded_user(user_id)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [ids, bucket]
      );
      await client.query(
        `UPDATE job_checkpoints SET cursor_value = $2, updated_at = NOW()
         WHERE job_name = $1`,
        ["notification_seed", ids.at(-1)]
      );
      return { busy: false, count: ids.length };
    });

    return apiResponse({ seeded: seeded.count, busy: seeded.busy });
  } catch (error) {
    console.error("Scheduled notification sync error:", error);
    return apiError("Notification sync failed", 500);
  }
}
