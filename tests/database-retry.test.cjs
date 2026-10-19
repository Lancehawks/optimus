const { test } = require("node:test");
const assert = require("node:assert/strict");

test("database retry classification recognizes connection failures and their causes", async () => {
  const {
    isReadOnlySql,
    isTransientDatabaseConnectionError,
  } = await import("../src/lib/databaseRetry.js");

  assert.equal(
    isTransientDatabaseConnectionError(new Error("Connection terminated due to connection timeout", {
      cause: Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" }),
    })),
    true
  );
  assert.equal(isTransientDatabaseConnectionError({ code: "57P01" }), true);
  assert.equal(
    isTransientDatabaseConnectionError(Object.assign(new Error("syntax error"), { code: "42601" })),
    false
  );
  assert.equal(
    isTransientDatabaseConnectionError(new Error("canceling statement due to statement timeout")),
    false
  );

  assert.equal(isTransientDatabaseConnectionError({ code: "40001" }), false);

  assert.equal(isReadOnlySql("  SELECT id FROM users"), true);
  assert.equal(isReadOnlySql("SHOW timezone"), true);
  assert.equal(isReadOnlySql("UPDATE users SET full_name = $1"), false);
});

test("serialization failures and deadlocks are classified as safe to rerun", async () => {
  const { isSerializationFailure } = await import("../src/lib/databaseRetry.js");

  assert.equal(isSerializationFailure({ code: "40001" }), true);
  assert.equal(isSerializationFailure({ code: "40P01" }), true);
  assert.equal(
    isSerializationFailure(new Error("sync failed", { cause: Object.assign(new Error("serialize"), { code: "40001" }) })),
    true
  );
  assert.equal(isSerializationFailure({ code: "23505" }), false);
  assert.equal(isSerializationFailure({ code: "ECONNRESET" }), false);
  assert.equal(isSerializationFailure(null), false);
});
