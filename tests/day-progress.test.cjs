const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));

test("day progress runs midnight to midnight in the member's time zone", async () => {
  const { dayProgress } = await load("src/lib/dayProgress.js");

  // 14:20 in India is 08:50 UTC.
  const india = dayProgress(new Date("2026-10-26T08:50:00Z"), "Asia/Kolkata");
  assert.equal(india.elapsedMinutes, 14 * 60 + 20);
  assert.equal(india.remainingMinutes, 9 * 60 + 40);
  assert.equal(Math.round(india.fraction * 100), 60);

  const midnight = dayProgress(new Date("2026-10-26T18:30:00Z"), "Asia/Kolkata");
  assert.equal(midnight.elapsedMinutes, 0);
  assert.equal(midnight.remainingMinutes, 24 * 60);
});

test("day progress counts the real length of days when clocks change", async () => {
  const { dayProgress } = await load("src/lib/dayProgress.js");

  // New York springs forward on 8 March 2026: a 23-hour day. Noon is 11 hours in.
  const short = dayProgress(new Date("2026-03-08T16:00:00Z"), "America/New_York");
  assert.equal(short.elapsedMinutes, 11 * 60);
  assert.equal(short.elapsedMinutes + short.remainingMinutes, 23 * 60);

  // And falls back on 1 November 2026: a 25-hour day. Noon is 13 hours in.
  const long = dayProgress(new Date("2026-11-01T17:00:00Z"), "America/New_York");
  assert.equal(long.elapsedMinutes, 13 * 60);
  assert.equal(long.elapsedMinutes + long.remainingMinutes, 25 * 60);
});

test("durations read as hours and minutes", async () => {
  const { formatDuration } = await load("src/lib/dayProgress.js");
  assert.equal(formatDuration(0), "0m");
  assert.equal(formatDuration(45), "45m");
  assert.equal(formatDuration(120), "2h");
  assert.equal(formatDuration(580), "9h 40m");
});
