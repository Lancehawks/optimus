const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const moduleURL = name => pathToFileURL(path.join(root, 'src/lib', name)).href;

test('month navigation, exclusive midnight, all-day dates and full-height midnight blocks', async () => {
  const c = await import(moduleURL('calendarUtils.js'));
  for (const year of [2024, 2025, 2026]) {
    assert.equal(c.navigateNext(new Date(year,0,31),'month').getMonth(),1);
    assert.equal(c.navigatePrev(new Date(year,2,31),'month').getMonth(),1);
  }
  const event = {start_time:'2026-10-15T22:00:00Z',end_time:'2026-10-16T00:00:00Z'};
  assert.equal(c.getEventsForDay([event],new Date(2026,9,16),'UTC').length,0);
  assert.equal(c.getEventPosition(event,new Date(2026,9,15),false,'UTC').height,120);
  const allDay = {all_day:true,start_date:'2026-10-15',end_date:'2026-10-16'};
  for (const zone of ['America/Los_Angeles','Asia/Kolkata','Pacific/Auckland']) {
    assert.equal(c.getEventsForDay([allDay],new Date(2026,9,15),zone).length,1);
    assert.equal(c.getEventsForDay([allDay],new Date(2026,9,14),zone).length,0);
    assert.equal(c.getEventsForDay([allDay],new Date(2026,9,16),zone).length,0);
  }
});

test('saved timezone input and DST boundaries do not depend on host timezone', async () => {
  const t = await import(moduleURL('calendarTime.js'));
  const c = await import(moduleURL('calendarUtils.js'));
  assert.equal(t.zonedInputToDate('2026-10-15T09:30','Asia/Kolkata').toISOString(),'2026-10-15T04:00:00.000Z');
  assert.equal(t.datetimeInput('2026-10-15T04:00Z','Asia/Kolkata'),'2026-10-15T09:30');
  assert.throws(()=>t.zonedInputToDate('2026-03-08T02:30','America/New_York'),/does not exist/);
  assert.equal(t.zonedInputToDate('2026-11-01T01:30','America/New_York').toISOString(),'2026-11-01T05:30:00.000Z');
  const range = c.getVisibleRange(new Date(2026,2,8),'day','America/New_York');
  assert.equal((range.end-range.start)/3600000,23);
  assert.throws(()=>t.zonedInputToDate('2026-02-30T10:00','UTC'),/Invalid/);
});

test('patches preserve unimported fields and only send intentional changes', async () => {
  const {buildGooglePatch} = await import(moduleURL('googleEventPayload.js'));
  const remote = {description:'Edited in Google',attendees:[{email:'guest@example.com'}],reminders:{useDefault:false},extendedProperties:{private:{other:'keep'},shared:{team:'keep'}}};
  const helpers = {withStatus:(d,s)=>`${d} [${s}]`,recurrence:()=>undefined};
  assert.deepEqual(buildGooglePatch({title:'New',google_dirty_fields:{title:true}},remote,helpers),{summary:'New'});
  const patch = buildGooglePatch({id:'id',status:'done',google_dirty_fields:{status:true}},remote,helpers);
  assert.equal(patch.description,'Edited in Google [done]');
  assert.equal(patch.extendedProperties.private.other,'keep');
  assert.equal(patch.extendedProperties.shared.team,'keep');
  assert.equal(patch.attendees,undefined);
  assert.deepEqual(buildGooglePatch({google_dirty_fields:{recurrence_rule:true}},remote,helpers),{recurrence:[]});
  assert.deepEqual(buildGooglePatch({description:'Local description',status:'scheduled',google_dirty_fields:{description:true}},remote,
    {...helpers,getStatus:()=> 'done'}), {description:'Local description [done]'});
});

test('editing a title preserves seconds and the later repeated DST hour', async () => {
  const {editedTimedInstant, changedEventFields} = await import(moduleURL('eventEdit.js'));
  const instant = '2026-11-01T06:30:42.123Z';
  assert.equal(editedTimedInstant('2026-11-01T01:30',instant,'America/New_York'),instant);
  assert.equal(editedTimedInstant('2026-11-01T02:30',instant,'America/New_York'),'2026-11-01T07:30:00.000Z');
  assert.deepEqual(changedEventFields({title:'Before',start_time:instant,recurrence_rule:'weekly'},
    {title:'After',start_time:instant,recurrence_rule:'weekly'}), {title:'After'});
});

test('legacy reconciliation only clears uncertainty when untracked fields match', async () => {
  const {legacyEventMatches} = await import(moduleURL('googleEventPayload.js'));
  const event = {title:'Meeting',start_time:'2026-10-15T10:00Z',end_time:'2026-10-15T11:00Z',google_dirty_fields:{legacy_review_required:true}};
  const remote = {summary:'Meeting',start:{dateTime:'2026-10-15T10:00Z'},end:{dateTime:'2026-10-15T11:00Z'}};
  const helpers = {stripStatus:value=>value,getStatus:()=>null,recurrence:()=>null};
  assert.equal(legacyEventMatches(event,remote,helpers),true);
  assert.equal(legacyEventMatches({...event,title:'Unsynced change'},remote,helpers),false);
  assert.equal(legacyEventMatches({...event,title:'Intentional new edit',google_dirty_fields:{legacy_review_required:true,title:true}},remote,helpers),true);
  assert.equal(legacyEventMatches(event,{...remote,status:'cancelled'},helpers),false);
});

test('recurring times keep their event timezone across DST and all-day instances keep their dates', async () => {
  const {expandRecurrences} = await import(moduleURL('recurrence.js'));
  const rows = expandRecurrences([{id:'weekly',recurrence_rule:'weekly',event_timezone:'America/New_York',start_time:'2026-03-01T14:00Z',end_time:'2026-03-01T15:00Z'}],new Date('2026-03-07T00:00Z'),new Date('2026-03-10T00:00Z'));
  assert.equal(rows[0].start_time,'2026-03-08T13:00:00.000Z');
  const days = expandRecurrences([{id:'daily',recurrence_rule:'daily',all_day:true,start_date:'2020-01-01',end_date:'2020-01-02',start_time:'2020-01-01T00:00Z',end_time:'2020-01-02T00:00Z'}],new Date('2026-10-15T00:00Z'),new Date('2026-10-17T00:00Z'));
  assert.equal(days.length,2);assert.equal(days[1].start_date,'2026-10-16');assert.equal(days[1].end_date,'2026-10-17');
});

test('database migration and real sync SQL preserve identities, retries, moves and deletion tombstones', async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const db = process.env.CALENDAR_TEST_PG_PORT
    ? await require('./helpers/calendar-postgres.cjs').connect(Number(process.env.CALENDAR_TEST_PG_PORT))
    : new PGlite({parsers: {1082: value => value}});
  try {
    await db.exec(`
      CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), timezone text);
      CREATE TABLE calendars(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users ON DELETE CASCADE,
        google_calendar_id text, sync_token text, last_synced_at timestamptz);
      CREATE TABLE events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users ON DELETE CASCADE,
        calendar_id uuid REFERENCES calendars ON DELETE CASCADE, title text, description text, location text,
        start_time timestamptz, end_time timestamptz, all_day boolean DEFAULT false,
        recurrence_rule text, google_event_id text, google_rrule text, status text DEFAULT 'scheduled',
        event_type text DEFAULT 'event', synced_at timestamptz, updated_at timestamptz DEFAULT now());
      CREATE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
      CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    await db.exec(fs.readFileSync(path.join(root,'migrations/20261015_calendar_sync_safety.sql'),'utf8'));
    const user = (await db.query("INSERT INTO users(timezone) VALUES('Asia/Kolkata') RETURNING id")).rows[0].id;
    const c1 = (await db.query("INSERT INTO calendars(user_id,google_calendar_id) VALUES($1,'one') RETURNING id",[user])).rows[0].id;
    const c2 = (await db.query("INSERT INTO calendars(user_id,google_calendar_id) VALUES($1,'two') RETURNING id",[user])).rows[0].id;
    const local = (await db.query('INSERT INTO calendars(user_id) VALUES($1) RETURNING id',[user])).rows[0].id;
    let chain = Promise.resolve();
    const transaction = fn => {
      if (process.env.CALENDAR_TEST_PG_PORT) return db.transaction(fn);
      const result = chain.then(()=>db.transaction(tx=>fn({query:(...args)=>tx.query(...args)})));
      chain = result.catch(()=>{}); return result;
    };
    const remote = new Map(); let inserts=0; let failAfterInsert=false; let failDelete=false; let failAfterMove=false; let conflict=false;
    const clone = value => globalThis.structuredClone(value);
    const error = code => Object.assign(new Error(String(code)),{code});
    const google = {events:{
      get:async ({calendarId,eventId})=>{const value=remote.get(calendarId+':'+eventId); if(!value)throw error(404);return {data:clone(value)};},
      insert:async ({calendarId,requestBody})=>{
        const key=calendarId+':'+requestBody.id;if(remote.has(key))throw error(409);
        inserts++;remote.set(key,{...clone(requestBody),etag:'"1"'});
        if(failAfterInsert){failAfterInsert=false;throw error(503);}return {data:clone(remote.get(key))};
      },
      patch:async ({calendarId,eventId,requestBody},options)=>{
        const key=calendarId+':'+eventId;const value=remote.get(key);if(!value)throw error(404);
        if(conflict){conflict=false;throw error(412);}
        if(options.headers?.['If-Match']!==value.etag)throw error(412);
        remote.set(key,{...value,...clone(requestBody),etag:'"2"'});return {data:clone(remote.get(key))};
      },
      move:async ({calendarId,eventId,destination})=>{
        const old=calendarId+':'+eventId;const value=remote.get(old);if(!value)throw error(404);
        remote.set(destination+':'+eventId,value);remote.delete(old);
        if(failAfterMove){failAfterMove=false;throw error(503);}return {data:clone(value)};
      },
      delete:async ({calendarId,eventId})=>{if(failDelete)throw error(503);if(!remote.delete(calendarId+':'+eventId))throw error(404);return {};},
      list:async ({calendarId})=>({data:{items:[...remote.entries()].filter(([key])=>key.startsWith(calendarId+':')).map(([,v])=>clone(v)),nextSyncToken:'token'}}),
    }};
    globalThis.__calendarSafety = {query:(...args)=>db.query(...args),transaction,getCalendarClient:async()=>google};
    let source=fs.readFileSync(path.join(root,'src/lib/googleSync.js'),'utf8');
    source=source.replace('import { query, transaction } from "@/lib/db";', 'const {query, transaction} = globalThis.__calendarSafety;');
    source=source.replace('import { getCalendarClient } from "@/lib/google";', 'const {getCalendarClient} = globalThis.__calendarSafety;');
    source=source.replace(/from (["'])@\/lib\/([^"']+)\1/g,(_,q,name)=>`from ${JSON.stringify(moduleURL(name+'.js'))}`);
    const sync=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const insertLocal=async(title='Local')=>(await db.query(`INSERT INTO events(user_id,calendar_id,title,start_time,end_time)
      VALUES($1,$2,$3,'2026-10-15T04:00Z','2026-10-15T05:00Z') RETURNING *`,[user,c1,title])).rows[0];
    const e=await insertLocal();
    await Promise.all([sync.pushEventToGoogle(user,e.id,google),sync.pushEventToGoogle(user,e.id,google)]);
    assert.equal(inserts,1);
    const e2=await insertLocal('Lost response');failAfterInsert=true;
    await assert.rejects(sync.pushEventToGoogle(user,e2.id,google));
    await sync.syncGoogleEvents(user,c1,google);
    assert.equal((await db.query("SELECT * FROM events WHERE title='Lost response'")).rows.length,1);
    await sync.pushEventToGoogle(user,e2.id,google);assert.equal(inserts,2);
    const row=(await db.query('SELECT * FROM events WHERE id=$1',[e.id])).rows[0];
    remote.get('one:'+row.google_event_id).attendees=[{email:'guest@example.com'}];
    await db.query('UPDATE events SET title=$1 WHERE id=$2',['Renamed',e.id]);
    conflict=true;await assert.rejects(sync.pushEventToGoogle(user,e.id,google));
    assert.equal((await db.query('SELECT google_dirty_fields FROM events WHERE id=$1',[e.id])).rows[0].google_dirty_fields.title,true);
    await sync.pushEventToGoogle(user,e.id,google);
    assert.equal(remote.get('one:'+row.google_event_id).summary,'Renamed');
    assert.equal(remote.get('one:'+row.google_event_id).attendees.length,1);
    const sameId={id:'shared-id',summary:'Calendar One',start:{date:'2026-10-15'},end:{date:'2026-10-16'},etag:'"1"'};
    remote.set('one:shared-id',clone(sameId));remote.set('two:shared-id',{...clone(sameId),summary:'Calendar Two'});
    await sync.syncGoogleEvents(user,c1,google);await sync.syncGoogleEvents(user,c2,google);
    const shared=(await db.query("SELECT * FROM events WHERE google_event_id='shared-id' ORDER BY title")).rows;
    assert.equal(shared.length,2);assert.notEqual(shared[0].calendar_id,shared[1].calendar_id);
    assert.equal(shared[0].start_date,'2026-10-15');assert.equal(shared[0].end_date,'2026-10-16');
    remote.set('one:shared-id',{id:'shared-id',status:'cancelled'});
    await sync.syncGoogleEvents(user,c1,google);
    assert.equal((await db.query("SELECT * FROM events WHERE google_event_id='shared-id'")).rows.length,1);
    await db.query('UPDATE events SET calendar_id=$1 WHERE id=$2',[c2,e.id]);
    failAfterMove=true;await assert.rejects(sync.pushEventToGoogle(user,e.id,google));
    await sync.pushEventToGoogle(user,e.id,google);
    assert.equal(remote.has('one:'+row.google_event_id),false);assert.equal(remote.has('two:'+row.google_event_id),true);
    assert.equal((await db.query('SELECT google_origin_calendar_id FROM events WHERE id=$1',[e.id])).rows[0].google_origin_calendar_id,'two');
    await db.query('DELETE FROM events WHERE id=$1',[e.id]);
    failDelete=true;assert.ok((await sync.drainGoogleEventDeletions(user,google)).failed > 0);
    await sync.syncGoogleEvents(user,c2,google);
    assert.equal((await db.query('SELECT * FROM events WHERE google_event_id=$1',[row.google_event_id])).rows.length,0);
    failDelete=false;await sync.drainGoogleEventDeletions(user,google);
    assert.equal(remote.has('two:'+row.google_event_id),false);
    await db.query('UPDATE events SET calendar_id=$1 WHERE id=$2',[local,e2.id]);
    const detached=(await db.query('SELECT * FROM events WHERE id=$1',[e2.id])).rows[0];
    assert.equal(detached.google_event_id,null);assert.equal(detached.google_origin_calendar_id,null);
    assert.ok((await db.query('SELECT * FROM google_event_deletions WHERE completed_at IS NULL')).rows.length);
    const lost=await insertLocal('Delete after lost create');failAfterInsert=true;
    await assert.rejects(sync.pushEventToGoogle(user,lost.id,google));
    const lostKey='one:'+lost.google_creation_key.replaceAll('-','');assert.equal(remote.has(lostKey),true);
    await db.query('DELETE FROM events WHERE id=$1',[lost.id]);
    await sync.drainGoogleEventDeletions(user,google);assert.equal(remote.has(lostKey),false);
    const allDay=(await db.query(`INSERT INTO events(user_id,calendar_id,title,start_time,end_time,all_day)
      VALUES($1,$2,'All day','2026-10-15T00:00Z','2026-10-16T00:00Z',true) RETURNING *`,[user,c1])).rows[0];
    await sync.pushEventToGoogle(user,allDay.id,google);
    assert.deepEqual(remote.get('one:'+allDay.google_creation_key.replaceAll('-','')).start,{date:'2026-10-15'});
    assert.deepEqual(remote.get('one:'+allDay.google_creation_key.replaceAll('-','')).end,{date:'2026-10-16'});
    await db.query(`UPDATE events SET google_dirty_fields = '{"legacy_review_required":true}' WHERE id=$1`,[allDay.id]);
    await sync.pushEventToGoogle(user,allDay.id,google);
    assert.deepEqual((await db.query('SELECT google_dirty_fields FROM events WHERE id=$1',[allDay.id])).rows[0].google_dirty_fields,{});
    await db.query(`UPDATE events SET google_dirty_fields = '{"legacy_review_required":true}' WHERE id=$1`,[allDay.id]);
    remote.get('one:'+allDay.google_creation_key.replaceAll('-','')).summary='Changed remotely';
    assert.equal((await sync.pushEventToGoogle(user,allDay.id,google)).skipped,'review_required');
    const another=await insertLocal('Must still sync');
    const batch=await sync.pushPendingEventsToGoogle(user,google);
    assert.ok(batch.reviewRequired > 0);
    assert.equal(remote.has('one:'+another.google_creation_key.replaceAll('-','')),true);
    await db.query('DELETE FROM users WHERE id=$1',[user]);
    assert.equal((await db.query('SELECT * FROM google_event_deletions')).rows.length,0);
  } finally {delete globalThis.__calendarSafety; await db.close();}
});
