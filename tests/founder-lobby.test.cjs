const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The lobby UI is split across src/components/founder; assertions about what
// the UI references apply to the whole folder.
function readFounderComponentSource() {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".js") ? [fs.readFileSync(full, "utf8")] : [];
  });
  return walk(path.join(__dirname, "..", "src", "components", "founder")).join("\n");
}

test("Founder PIN comparison accepts only the configured PIN", async () => {
  const { verifyFounderPin } = await import("../src/lib/founderAccessToken.js");

  assert.equal(verifyFounderPin("4286", "4286"), true);
  assert.equal(verifyFounderPin("4287", "4286"), false);
  assert.equal(verifyFounderPin(4286, "4286"), false);
  assert.equal(verifyFounderPin("", "4286"), false);
});

test("Founder access grants are signed, expiring, and bound to the current session", async () => {
  const {
    createFounderAccessToken,
    verifyFounderAccessToken,
  } = await import("../src/lib/founderAccessToken.js");

  const options = {
    userId: "user-1",
    sessionToken: "session-one",
    secret: "a-test-secret-that-is-longer-than-thirty-two-characters",
    now: 1_000_000,
    ttlSeconds: 60,
  };
  const token = createFounderAccessToken(options);

  assert.equal(verifyFounderAccessToken(token, options), true);
  assert.equal(verifyFounderAccessToken(token, { ...options, userId: "user-2" }), false);
  assert.equal(verifyFounderAccessToken(token, { ...options, sessionToken: "session-two" }), false);
  assert.equal(verifyFounderAccessToken(token, { ...options, now: 1_061_000 }), false);

  const [payload, signature] = token.split(".");
  const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  assert.equal(
    verifyFounderAccessToken(`${payload}.${tamperedSignature}`, options),
    false
  );
});

test("Founder Lobby stays isolated from existing Optimus feature data", () => {
  const root = path.join(__dirname, "..", "src");
  const page = fs.readFileSync(path.join(root, "app", "(founder)", "founder", "page.js"), "utf8");
  const client = readFounderComponentSource();
  const sidebar = fs.readFileSync(path.join(root, "components", "layout", "Sidebar.js"), "utf8");
  const proxy = fs.readFileSync(path.join(root, "proxy.js"), "utf8");

  assert.match(page, /getAuthUser/);
  assert.match(page, /hasFounderAccess/);
  assert.match(client, /\/api\/founder\/unlock/);
  assert.doesNotMatch(client, /projectService|taskService|dashboardService|useProjects|useTasks/);
  assert.match(sidebar, /href="\/founder"/);
  assert.match(proxy, /"\/founder"/);
});

test("Founder countdown is shared, protected, and independent from project data", () => {
  const repoRoot = path.join(__dirname, "..");
  const api = fs.readFileSync(
    path.join(repoRoot, "src", "app", "api", "founder", "countdown", "route.js"),
    "utf8"
  );
  const client = readFounderComponentSource();
  const migration = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260903_founder_lobby_countdown.sql"),
    "utf8"
  );

  const guard = fs.readFileSync(path.join(repoRoot, "src", "lib", "founderApi.js"), "utf8");

  assert.match(api, /withFounderRoomAccess/);
  assert.match(guard, /withAuth/);
  assert.match(guard, /hasFounderAccess/);
  assert.match(api, /founder_lobby_settings/);
  assert.doesNotMatch(api, /projects|tasks|project_id/);
  assert.match(migration, /id SMALLINT PRIMARY KEY DEFAULT 1 CHECK \(id = 1\)/);
  assert.match(client, /\/api\/founder\/countdown/);
  assert.match(client, /Set timer/);
  assert.match(client, /Main goal/);
  assert.match(client, /Building day/);
  assert.match(client, /Milestones/);
  assert.match(client, /Targets/);
  assert.match(client, /Sales/);
  assert.match(client, /Leads/);
  assert.match(client, /Notes/);
});

test("Founder room stations use protected, shared data without Optimus project coupling", () => {
  const repoRoot = path.join(__dirname, "..");
  const stationSource = readFounderComponentSource();
  const migration = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260909_founder_lobby_room.sql"),
    "utf8"
  );
  const collectionFactory = fs.readFileSync(
    path.join(repoRoot, "src", "lib", "founderCollectionRoutes.js"),
    "utf8"
  );
  const endpoints = ["settings", "milestones", "targets", "leads", "notes"];

  // Every generated collection handler (GET, POST, PUT, DELETE) is guarded.
  assert.equal(collectionFactory.match(/withFounderRoomAccess\(/g)?.length, 4);
  assert.doesNotMatch(collectionFactory, /project_id|FROM projects|FROM tasks/);

  for (const endpoint of endpoints) {
    const route = fs.readFileSync(
      path.join(repoRoot, "src", "app", "api", "founder", endpoint, "route.js"),
      "utf8"
    );
    assert.match(route, /withFounderRoomAccess|createFounderCollectionRoutes/);
    assert.doesNotMatch(route, /project_id|FROM projects|FROM tasks/);
    assert.match(stationSource, new RegExp(`/api/founder/${endpoint}`));
  }

  assert.match(migration, /founder_milestones/);
  assert.match(migration, /founder_targets/);
  assert.match(migration, /founder_leads/);
  assert.match(migration, /founder_notes/);
  assert.doesNotMatch(migration, /project_id/);
});


test("Founder values use INR, escape CSV formulas, and reject malformed input", async () => {
  const v = await import("../src/lib/founderValues.js");
  assert.equal(v.formatFounderMoney(123456.5), "\u20b91,23,456.50");
  for (const value of [null, [], true, "text", 1]) assert.deepEqual(v.founderBody(value), {});
  for (const value of [true, [], {}, "Infinity", "bad"]) assert.equal(v.numericValue(value), null);
  assert.equal(v.numericValue("123.50"), 123.5);
  assert.equal(v.founderCsvCell("=1+1"), `"'=1+1"`);
  assert.equal(v.founderCsvCell('a"b'), '"a""b"');
});

test("Founder lobby time helpers and client ordering mirror the API", async () => {
  const time = await import("../src/components/founder/utils/time.js");
  const sort = await import("../src/components/founder/utils/sort.js");

  const today = new Date(2026, 9, 20, 23, 30);
  assert.equal(time.getBuildingDay("2026-10-20", today), 1);
  assert.equal(time.getBuildingDay("2026-10-01", today), 20);
  assert.equal(time.getBuildingDay("2026-10-25", today), -4);
  assert.equal(time.getBuildingDay(null, today), null);

  const remaining = time.getRemainingTime("2026-01-02T01:02:03.000Z", Date.parse("2026-01-01T00:00:00.000Z"));
  assert.deepEqual(remaining, { days: 1, hours: 1, minutes: 2, seconds: 3, complete: false });
  assert.equal(time.getRemainingTime("2020-01-01T00:00:00.000Z", Date.now()).complete, true);
  assert.equal(time.getRemainingTime("not a date", Date.now()), null);

  // Same order as the leads route: stage rank, follow-up (nulls last), newest.
  const leads = [
    { id: "won", stage: "won", followUpOn: null, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "neg-late", stage: "negotiation", followUpOn: "2026-12-01", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "neg-none", stage: "negotiation", followUpOn: null, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "neg-early", stage: "negotiation", followUpOn: "2026-11-01", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "lost", stage: "lost", followUpOn: null, updatedAt: "2026-01-01T00:00:00Z" },
  ];
  assert.deepEqual([...leads].sort(sort.sortLeads).map((lead) => lead.id), ["neg-early", "neg-late", "neg-none", "won", "lost"]);
  assert.deepEqual(
    [{ id: "b", milestoneOn: "2027-06-01" }, { id: "a", milestoneOn: "2026-03-01" }].sort(sort.sortMilestones).map((m) => m.id),
    ["a", "b"]
  );
  assert.deepEqual(
    [{ id: "done", status: "achieved", deadline: "2026-01-01" }, { id: "open", status: "active", deadline: null }, { id: "soon", status: "active", deadline: "2026-02-01" }]
      .sort(sort.sortTargets).map((t) => t.id),
    ["soon", "open", "done"]
  );
});

test("Founder routes reject stale shared edits and malformed bodies using PostgreSQL", async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const values = await import('../src/lib/founderValues.js');
  const db = new PGlite({parsers: {1082: value => value}});
  const root = path.join(__dirname, '..');
  try {
    await db.exec('CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid()); CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;');
    for (const migration of ['20260903_founder_lobby_countdown.sql','20260909_founder_lobby_room.sql','20261017_founder_inr.sql']) await db.exec(fs.readFileSync(path.join(root,'migrations',migration),'utf8'));
    const user = (await db.query('INSERT INTO users DEFAULT VALUES RETURNING id')).rows[0];
    let helper = fs.readFileSync(path.join(root,'src/lib/founderApi.js'),'utf8').replace(/^import .*;$/gm,'').replace(/export \{ numericValue \} from .*;/,'');
    const helpers = await import('data:text/javascript;base64,' + Buffer.from(helper).toString('base64'));
    globalThis.__founderTest = { ...helpers, ...values, query:(...args)=>db.query(...args), withFounderRoomAccess: fn=>fn,
      apiNoStoreResponse:(body,status=200)=>({body,status}), apiError:(error,status=400)=>({body:{error},status}), apiUnavailable:error=>({body:{error},status:503}) };
    const injectGlobals=source=>source.replace(/import \{([\s\S]*?)\} from [^;]+;/g,(_,names)=>'const {'+names+'} = globalThis.__founderTest;');
    const factorySource=injectGlobals(fs.readFileSync(path.join(root,'src/lib/founderCollectionRoutes.js'),'utf8'));
    const factory=await import('data:text/javascript;base64,'+Buffer.from(factorySource).toString('base64'));
    globalThis.__founderTest.createFounderCollectionRoutes=factory.createFounderCollectionRoutes;
    for (const [endpoint,key,draft] of [
      ['notes','note',{title:'Original',body:'Keep this'}],
      ['leads','lead',{clientName:'Original',value:120000,stage:'won'}],
      ['targets','target',{title:'Original',targetValue:100,currentValue:1,status:'active'}],
      ['milestones','milestone',{title:'Original',milestoneOn:'2026-12-01',status:'planned'}],
    ]) {
      const source=injectGlobals(fs.readFileSync(path.join(root,'src/app/api/founder',endpoint,'route.js'),'utf8'));
      const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
      const request=body=>({json:async()=>body,user});
      assert.equal((await api.POST(request(null))).status,400);
      const created=await api.POST(request(draft)); assert.equal(created.status,201,JSON.stringify(created));
      const item=created.body[key];assert.ok(item.version);
      const saved=await api.PUT(request({...item,title:'Updated',clientName:'Updated'}));assert.equal(saved.status,200,JSON.stringify(saved));
      assert.equal((await api.PUT(request({...item,title:'Stale',clientName:'Stale'}))).status,409);
      assert.equal((await api.DELETE({url:`http://localhost/?id=${item.id}&version=${item.version}`,user})).status,409);
      const listed=await api.GET();assert.equal(listed.status,200);
      const updated=saved.body[key];
      assert.ok(listed.body[`${key}s`].some(entry=>entry.id===updated.id&&entry.version===updated.version));
      assert.equal((await api.DELETE({url:`http://localhost/?id=not-a-uuid&version=${updated.version}`,user})).status,400);
      assert.equal((await api.DELETE({url:`http://localhost/?id=${updated.id}&version=${updated.version}`,user})).status,200);
      assert.equal((await api.GET()).body[`${key}s`].length,0);
      if(endpoint==='notes') assert.equal((await api.POST(request({title:'Too long',body:'x'.repeat(12001)}))).status,400);
    }
    assert.equal((await db.query('SELECT sales_currency FROM founder_lobby_settings')).rows[0].sales_currency,'INR');
  } finally { delete globalThis.__founderTest; await db.close(); }
});
