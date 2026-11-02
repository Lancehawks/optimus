-- Calendar time blocking and event status colors.
--
-- Adds event-level identity color, status, and type. Red/green remain
-- reserved in the UI for missed/done states; normal event colors are stored
-- in event_color.

BEGIN;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_color VARCHAR(7),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) NOT NULL DEFAULT 'event';

DO $$
BEGIN
  ALTER TABLE events
  ADD CONSTRAINT chk_events_status
  CHECK (status IN ('scheduled', 'in_progress', 'done', 'missed', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events
  ADD CONSTRAINT chk_events_event_type
  CHECK (event_type IN ('event', 'focus', 'time_block'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_status
  ON events(status);

CREATE INDEX IF NOT EXISTS idx_events_event_type
  ON events(event_type);

COMMIT;
