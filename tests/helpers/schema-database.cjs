// An in-memory PGlite database built from the real baseline and every active
// migration, so queries are tested against the production schema.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

function withoutOuterTransaction(sql) {
  return sql.replace(/^\s*BEGIN;\s*$/gim, "").replace(/^\s*COMMIT;\s*$/gim, "");
}

// `before` stops ahead of the named migration, for testing that migration.
exports.createSchemaDatabase = async ({ before } = {}) => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { uuid_ossp } = await import("@electric-sql/pglite/contrib/uuid_ossp");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  // Match the application's pg.Pool: DATE columns stay "YYYY-MM-DD" strings.
  const db = new PGlite({ extensions: { pg_trgm, uuid_ossp, pgcrypto }, parsers: { 1082: (value) => value } });

  await db.exec(fs.readFileSync(path.join(root, "database.sql"), "utf8"));
  const migrationsDirectory = path.join(root, "migrations");
  const retired = new Set(
    JSON.parse(fs.readFileSync(path.join(migrationsDirectory, "retired.json"), "utf8")).map((entry) => entry.name)
  );
  const migrations = fs.readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql") && !retired.has(name) && (!before || name < before))
    .sort();
  for (const name of migrations) {
    await db.exec(withoutOuterTransaction(fs.readFileSync(path.join(migrationsDirectory, name), "utf8")));
  }

  return db;
};
