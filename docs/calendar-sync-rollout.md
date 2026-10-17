# Calendar sync safety rollout

This change requires `20261015_calendar_sync_safety.sql` before the new application serves calendar requests. It was applied to the configured database during this task. The subsequent full database backup was restored and verified in isolated PostgreSQL; it is a post-migration backup. Do not edit this applied migration or its tracked checksum.

## Release sequence

1. Back up the database. Test the migration against a restored staging copy.
2. Check duplicate identities before migration:

   ```sql
   SELECT user_id, calendar_id, google_event_id, count(*)
   FROM events WHERE google_event_id IS NOT NULL
   GROUP BY user_id, calendar_id, google_event_id HAVING count(*) > 1;
   ```

   Reconcile duplicates and their task/project links individually. The unique index deliberately fails instead of deleting user data.
3. Stop/drain old application calendar writers during the deployment. Do not run old full-update Google writers alongside the new version.
4. Run `npm run db:migrate` against the intended staging database, then production during the coordinated release. Deploy the matching application version. No Google credentials or database URLs belong in source control.
5. Run `npm run db:verify`, `npm test`, `npm run lint`, and `npm run build`. Exercise Google integration using dedicated test calendars before opening production traffic.

## Required smoke checks against Google

- Edit only a title on an imported meeting with guests, reminders, Meet information and attachments. Verify all unrelated details survive.
- Trigger two saves/syncs together; simulate a lost create response. Verify only one remote event exists.
- Import identical event IDs from two calendars; cancel one copy and verify the other survives.
- Move an event between writable Google calendars. Verify the source disappears and the destination retains metadata. A failed move retains its original remote binding; another move is refused until the first is reconciled. Google may reject moves for unsupported event types or insufficient permissions; these remain pending rather than being copied destructively.
- Replace a synchronized day plan while deletion requests fail. Retry Calendar sync and confirm obsolete events are deleted and never reimported.
- Use a browser in a timezone different from the saved preference. Check timed input, quick capture, day plans, dashboard, all-day multi-day events, midnight endings, January 31 navigation, and DST transitions.

## Data model and recovery

- Google identity is `(user_id, calendar_id, google_event_id)`. `google_origin_calendar_id` records the actual remote source while a move is pending.
- `google_creation_key` supplies a stable Google-compatible insert ID. The database trigger can queue deletion even when an insert succeeded remotely but its response/local transaction was lost.
- `google_dirty_fields` records fields changed by every database writer. Existing Google events receive only those fields, with a fresh ETag. A 412 conflict leaves the edits pending for the next sync.
- Legacy linked events may be marked `legacy_review_required`. The migration's identity backfill also fired the existing timestamp trigger, so the marker includes previously synchronized rows. The old timestamps cannot reliably identify which changes were pending. During a push, compare all imported fields without an explicit newer dirty-field entry with current Google data. Exact matches clear the marker safely; differing rows remain protected and are reported as needing review. They rotate behind other pending events so they do not starve subsequent batches. For a differing row, review both versions, then replace the marker with a JSON object containing **only the reviewed local fields to push**, for example `{"title":true}`. If Google should win entirely, clear the marker and mark the row synchronized, then reset that calendar's sync token and import. Perform this reconciliation per event, not as a blanket reset.
- Sync failures are isolated per event/calendar. Responses report `googleSync: "partial"` and counts when work remains; local saves remain valid. Failed remote deletions retain their tombstones and do not prevent imports of other events. Batches remain bounded; use Sync again to continue a backlog.
- All-day boundaries use DATE columns and an **exclusive** `end_date`. API clients should send date-only values or UTC midnight timestamps for these boundaries. A single day on October 15 is `[2026-10-15, 2026-10-16)`. Timed events remain UTC instants with an explicit event timezone for recurrence.
- The migration recovers linked all-day dates from the previously stored UTC date; local rows use the saved timezone. A fresh Google import refreshes linked dates from the authoritative date strings. Historically incorrect timestamps, lost metadata, and events already deleted locally by old code may require separate reconciliation; this patch cannot reconstruct unavailable history.
- `google_event_deletions` survives local event deletion. Completed tombstones are retained to reject stale imports. Pending deletions retry during Calendar sync, linked event saves, deletion, and day-plan application. There is no new cron/worker. Each drain is bounded to 100 records; additional syncs drain a larger backlog.
- On a failed move followed by deletion, the potential destination copy is deleted only if its Optimus ownership tag matches. An unrelated destination event with the same Google ID is preserved.

Monitor outstanding work with:

```sql
SELECT count(*) FROM google_event_deletions WHERE completed_at IS NULL;
SELECT id, user_id FROM events WHERE google_dirty_fields ? 'legacy_review_required';
SELECT e.id, e.google_origin_calendar_id, c.google_calendar_id
FROM events e JOIN calendars c ON c.id = e.calendar_id
WHERE e.google_event_id IS NOT NULL
  AND e.google_origin_calendar_id IS DISTINCT FROM c.google_calendar_id;
```

Do not roll back to the old Google full-update writer while sync is enabled. Preserve the additive columns and deletion records during any rollback.

## Validation boundary

`tests/calendar-safety.test.cjs` executes the migration and sync SQL in embedded PostgreSQL (PGlite), with a simulated Google API and the baseline timestamp trigger. It covers identity scope, stable retries, lost create/move responses, ETag conflicts, preservation of unrelated fields, deletion suppression, date boundaries, timezone conversion, untouched DST instants, legacy reconciliation, and recurrence across DST. The suite was also run against isolated PostgreSQL 17 with independent concurrent connections, including simultaneous pushes. Set `CALENDAR_TEST_PG_PORT` to an isolated local test server using the `backup_verifier` role to repeat that mode; the helper creates and removes its own test schema and never uses `DATABASE_URL`. A live Google OAuth smoke test remains a release check. Production data and real Google calendars are not modified by these tests.

`node --env-file=.env.local scripts/verify-calendar-reads.mjs` exercises the actual range queries and presenters in a read-only transaction against the configured database. It prints counts only.
