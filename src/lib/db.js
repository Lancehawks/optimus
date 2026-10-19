import pg from "pg";
import { resolveDatabaseUrl } from "./databaseUrl";
import {
  isReadOnlySql,
  isTransientDatabaseConnectionError,
} from "./databaseRetry";

// Override DATE type parser (OID 1082) to return raw "YYYY-MM-DD" strings
// instead of JavaScript Date objects. This prevents timezone shift when
// Date objects are serialized to JSON via .toISOString() (local midnight
// becomes previous-day UTC for eastern timezones).
pg.types.setTypeParser(1082, (val) => val);

const POOL_KEY = Symbol.for("optimus.database.pool");
const POOL_ERROR_HANDLER_KEY = Symbol.for("optimus.database.poolErrorHandler");
const RETRY_DELAY_MS = Number.parseInt(process.env.DB_RETRY_DELAY_MS || "200", 10);

function createPool() {
  return new pg.Pool({
    // Never let node-postgres silently fall back to localhost in a serverless
    // deployment. Vercel-managed Postgres integrations conventionally expose
    // POSTGRES_URL, while DATABASE_URL remains the application's primary name.
    connectionString: resolveDatabaseUrl(),
    max: Number.parseInt(process.env.DB_POOL_MAX || "5", 10),
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Serverless databases such as Neon may need several seconds to wake an
    // idle compute. Five seconds was short enough to make the first login fail.
    connectionTimeoutMillis: Number.parseInt(
      process.env.DB_CONNECTION_TIMEOUT_MS || "15000",
      10
    ),
  });
}

// Next.js can reevaluate server modules during development hot reload. Reusing
// one pool prevents abandoned pools and excess database connections.
const pool = process.env.NODE_ENV === "production"
  ? createPool()
  : (globalThis[POOL_KEY] ||= createPool());

// node-postgres emits errors from idle clients on the pool. A listener keeps a
// terminated idle socket from becoming an unhandled process-level error; the
// pool removes that client and creates a fresh one for the next request.
if (!pool[POOL_ERROR_HANDLER_KEY]) {
  pool.on("error", (error) => {
    console.error("Idle database connection error:", {
      code: error?.code,
      message: error?.message,
    });
  });
  pool[POOL_ERROR_HANDLER_KEY] = true;
}

function waitForRetry() {
  return new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
}

async function runWithConnectionRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDatabaseConnectionError(error)) throw error;

    await waitForRetry();
    return operation();
  }
}

export async function query(text, params) {
  const operation = () => pool.query(text, params);
  return isReadOnlySql(text) ? runWithConnectionRetry(operation) : operation();
}

// Use only for statements that are safe to repeat after a connection failure.
// Most writes must not opt in because a lost response does not prove that the
// database failed to commit the first attempt.
export async function queryWithConnectionRetry(text, params) {
  return runWithConnectionRetry(() => pool.query(text, params));
}

export async function transaction(callback) {
  // Retrying pool acquisition is safe because no transaction has begun yet.
  const client = await runWithConnectionRetry(() => pool.connect());

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
