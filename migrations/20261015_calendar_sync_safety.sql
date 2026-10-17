-- Fail rather than silently discard existing duplicate identities. Resolve any
-- duplicates reported by this index before retrying the migration.
CREATE UNIQUE INDEX IF NOT EXISTS events_google_calendar_identity
  ON events(user_id, calendar_id, google_event_id) WHERE google_event_id IS NOT NULL;

ALTER TABLE events ADD COLUMN IF NOT EXISTS google_creation_key UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_origin_calendar_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_dirty_fields JSONB NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_timezone TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS timezone TEXT;

UPDATE events e SET google_origin_calendar_id = c.google_calendar_id
FROM calendars c WHERE c.id = e.calendar_id AND e.google_event_id IS NOT NULL
  AND e.google_origin_calendar_id IS NULL;
-- Pre-migration pending edits have no field-level history. Preserve them for
-- review instead of guessing which stale fields may safely overwrite Google.
UPDATE events SET google_dirty_fields = '{"legacy_review_required":true}'::jsonb
WHERE google_event_id IS NOT NULL AND (synced_at IS NULL OR updated_at > synced_at);
UPDATE events e SET event_timezone = CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = u.timezone) THEN u.timezone ELSE 'UTC' END
FROM users u WHERE e.user_id = u.id AND e.event_timezone IS NULL;
-- Linked events use the UTC date previously parsed from Google's date string.
-- Local events were written at local midnight, using the saved user timezone.
UPDATE events SET
  start_date = (start_time AT TIME ZONE CASE WHEN google_event_id IS NULL THEN event_timezone ELSE 'UTC' END)::date,
  end_date = (end_time AT TIME ZONE CASE WHEN google_event_id IS NULL THEN event_timezone ELSE 'UTC' END)::date
    + CASE WHEN (end_time AT TIME ZONE CASE WHEN google_event_id IS NULL THEN event_timezone ELSE 'UTC' END)::time = '00:00:00' THEN 0 ELSE 1 END
WHERE all_day AND start_date IS NULL;

CREATE TABLE IF NOT EXISTS google_event_deletions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  expected_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, google_calendar_id, google_event_id)
);

CREATE OR REPLACE FUNCTION track_event_google_changes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination TEXT; source_calendar TEXT; remote_id TEXT; field TEXT;
BEGIN
  IF current_setting('optimus.google_import', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- Account deletion has already removed the parent user; do not recreate
    -- dependent work or violate the cascading user foreign key.
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN RETURN OLD; END IF;
    SELECT google_calendar_id INTO destination FROM calendars WHERE id = OLD.calendar_id;
    source_calendar := COALESCE(OLD.google_origin_calendar_id, destination);
    remote_id := COALESCE(OLD.google_event_id, replace(OLD.google_creation_key::text, '-', ''));
    IF source_calendar IS NOT NULL THEN
      INSERT INTO google_event_deletions(user_id, google_calendar_id, google_event_id)
      VALUES(OLD.user_id, source_calendar, remote_id)
      ON CONFLICT DO NOTHING;
    END IF;
    -- A move may have succeeded remotely before its local commit failed. Only
    -- delete a destination copy if it carries this local event's ownership tag.
    IF destination IS NOT NULL AND destination IS DISTINCT FROM source_calendar THEN
      INSERT INTO google_event_deletions(user_id, google_calendar_id, google_event_id, expected_event_id)
      VALUES(OLD.user_id, destination, remote_id, OLD.id) ON CONFLICT DO NOTHING;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.event_timezone IS NULL THEN
    SELECT COALESCE(timezone, 'UTC') INTO NEW.event_timezone FROM users WHERE id = NEW.user_id;
  END IF;
  IF NEW.all_day THEN
    IF TG_OP = 'INSERT' OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.all_day IS DISTINCT FROM OLD.all_day THEN
      NEW.start_date := (NEW.start_time AT TIME ZONE 'UTC')::date;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.all_day IS DISTINCT FROM OLD.all_day THEN
      NEW.end_date := (NEW.end_time AT TIME ZONE 'UTC')::date;
    END IF;
    IF NEW.end_date <= NEW.start_date THEN RAISE EXCEPTION 'All-day end date must be exclusive and after start date'; END IF;
  ELSE
    NEW.start_date := NULL; NEW.end_date := NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    FOREACH field IN ARRAY ARRAY['title','description','location','start_time','end_time','all_day','recurrence_rule','status','event_type'] LOOP
      IF to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field THEN
        NEW.google_dirty_fields := NEW.google_dirty_fields || jsonb_build_object(field, true);
      END IF;
    END LOOP;
    IF NEW.recurrence_rule IS DISTINCT FROM OLD.recurrence_rule THEN NEW.google_rrule := NULL; END IF;
    IF NEW.calendar_id IS DISTINCT FROM OLD.calendar_id THEN
      SELECT google_calendar_id INTO destination FROM calendars WHERE id = NEW.calendar_id;
      IF OLD.google_event_id IS NULL THEN
        SELECT google_calendar_id INTO source_calendar FROM calendars WHERE id = OLD.calendar_id;
        IF source_calendar IS NOT NULL THEN
          INSERT INTO google_event_deletions(user_id, google_calendar_id, google_event_id)
          VALUES(OLD.user_id, source_calendar, replace(OLD.google_creation_key::text, '-', '')) ON CONFLICT DO NOTHING;
          NEW.google_creation_key := gen_random_uuid();
        END IF;
      END IF;
      IF destination IS NULL AND OLD.google_event_id IS NOT NULL THEN
        INSERT INTO google_event_deletions(user_id, google_calendar_id, google_event_id)
        VALUES(OLD.user_id, OLD.google_origin_calendar_id, OLD.google_event_id) ON CONFLICT DO NOTHING;
        NEW.google_event_id := NULL; NEW.google_origin_calendar_id := NULL;
        NEW.google_creation_key := gen_random_uuid();
      END IF;
      NEW.synced_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_google_changes ON events;
CREATE TRIGGER events_google_changes BEFORE INSERT OR UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION track_event_google_changes();
