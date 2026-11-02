-- Support deterministic notification keyset pagination without a sort of the
-- complete per-user history. The partial unread index keeps the hot badge/feed
-- query compact while the full index serves all/read history.

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_id_desc
    ON notifications(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created_id_desc
    ON notifications(user_id, created_at DESC, id DESC)
    WHERE read_at IS NULL;
