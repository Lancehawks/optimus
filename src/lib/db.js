import pg from "pg";
import { normalizeDatabaseUrl } from "./databaseUrl";

// Override DATE type parser (OID 1082) to return raw "YYYY-MM-DD" strings
// instead of JavaScript Date objects. This prevents timezone shift when
// Date objects are serialized to JSON via .toISOString() (local midnight
// becomes previous-day UTC for eastern timezones).
pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL, {
    forceTls: process.env.DATABASE_SSL === "require",
  }),
  max: Number.parseInt(process.env.DB_POOL_MAX || "5", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

export async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
