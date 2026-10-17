const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  const client = fs.readFileSync(path.join(root, "components", "founder", "FounderLobbyClient.js"), "utf8");
  const shell = fs.readFileSync(path.join(root, "components", "layout", "DashboardShell.js"), "utf8");
  const proxy = fs.readFileSync(path.join(root, "proxy.js"), "utf8");

  assert.match(page, /getAuthUser/);
  assert.match(page, /hasFounderAccess/);
  assert.match(client, /\/api\/founder\/unlock/);
  assert.doesNotMatch(client, /projectService|taskService|dashboardService|useProjects|useTasks/);
  assert.match(shell, /FounderLobbyLauncher/);
  assert.match(proxy, /"\/founder"/);
});

test("Founder countdown is shared, protected, and independent from project data", () => {
  const repoRoot = path.join(__dirname, "..");
  const api = fs.readFileSync(
    path.join(repoRoot, "src", "app", "api", "founder", "countdown", "route.js"),
    "utf8"
  );
  const client = fs.readFileSync(
    path.join(repoRoot, "src", "components", "founder", "FounderLobbyClient.js"),
    "utf8"
  );
  const migration = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260903_founder_lobby_countdown.sql"),
    "utf8"
  );

  assert.match(api, /withAuth/);
  assert.match(api, /hasFounderAccess/);
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
  const stationSource = fs.readFileSync(
    path.join(repoRoot, "src", "components", "founder", "FounderStations.js"),
    "utf8"
  );
  const migration = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260909_founder_lobby_room.sql"),
    "utf8"
  );
  const endpoints = ["settings", "milestones", "targets", "leads", "notes"];

  for (const endpoint of endpoints) {
    const route = fs.readFileSync(
      path.join(repoRoot, "src", "app", "api", "founder", endpoint, "route.js"),
      "utf8"
    );
    assert.match(route, /withFounderRoomAccess/);
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
  assert.equal(v.founderTheme("invalid"), "burgundy");
  for (const theme of v.FOUNDER_THEMES) assert.equal(v.founderTheme(theme), theme);
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
    for (const [endpoint,key,draft] of [
      ['notes','note',{title:'Original',body:'Keep this'}],
      ['leads','lead',{clientName:'Original',value:120000,stage:'won'}],
      ['targets','target',{title:'Original',targetValue:100,currentValue:1,status:'active'}],
      ['milestones','milestone',{title:'Original',milestoneOn:'2026-12-01',status:'planned'}],
    ]) {
      let source=fs.readFileSync(path.join(root,'src/app/api/founder',endpoint,'route.js'),'utf8');
      source=source.replace(/import \{([\s\S]*?)\} from [^;]+;/g,(_,names)=>'const {'+names+'} = globalThis.__founderTest;');
      const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
      const request=body=>({json:async()=>body,user});
      assert.equal((await api.POST(request(null))).status,400);
      const created=await api.POST(request(draft)); assert.equal(created.status,201,JSON.stringify(created));
      const item=created.body[key];assert.ok(item.version);
      const saved=await api.PUT(request({...item,title:'Updated',clientName:'Updated'}));assert.equal(saved.status,200,JSON.stringify(saved));
      assert.equal((await api.PUT(request({...item,title:'Stale',clientName:'Stale'}))).status,409);
      assert.equal((await api.DELETE({url:`http://localhost/?id=${item.id}&version=${item.version}`,user})).status,409);
      const listed=await api.GET();assert.equal(listed.status,200);
      if(endpoint==='notes') assert.equal((await api.POST(request({title:'Too long',body:'x'.repeat(12001)}))).status,400);
    }
    assert.equal((await db.query('SELECT sales_currency FROM founder_lobby_settings')).rows[0].sales_currency,'INR');
  } finally { delete globalThis.__founderTest; await db.close(); }
});
