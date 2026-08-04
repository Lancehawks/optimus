-- Google synchronization now runs directly on page open and event writes.
-- Retire the unused background integration queue and lock tables.

BEGIN;

DROP TABLE IF EXISTS integration_job_locks;
DROP TABLE IF EXISTS job_checkpoints;
DROP TABLE IF EXISTS integration_jobs;

COMMIT;
