-- The workspace runs on India time. New members start on IST, and accounts
-- still on the old UTC default move to it. Members can pick another zone in
-- Settings afterwards.

ALTER TABLE users ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';

UPDATE users SET timezone = 'Asia/Kolkata' WHERE timezone IS NULL OR timezone = 'UTC';
