-- Per-occurrence status for recurring calendar events.
--
-- Master events still hold the series definition. This table stores status
-- overrides for one generated occurrence, such as marking only today's class
-- done or missed.

BEGIN;

CREATE TABLE IF NOT EXISTS event_occurrence_statuses (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'done', 'missed', 'cancelled')),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_event_occurrence_statuses_status
    ON event_occurrence_statuses(status);

CREATE INDEX IF NOT EXISTS idx_event_occurrence_statuses_updated_by
    ON event_occurrence_statuses(updated_by);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_occurrence_statuses_updated_at ON event_occurrence_statuses;
CREATE TRIGGER trg_event_occurrence_statuses_updated_at
    BEFORE UPDATE ON event_occurrence_statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMIT;
