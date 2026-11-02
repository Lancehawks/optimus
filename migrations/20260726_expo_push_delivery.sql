-- Durable Expo push devices and per-notification delivery state.
--
-- Notification writes remain database-only. The existing integration worker
-- seeds and dispatches these delivery rows asynchronously.

BEGIN;

CREATE TABLE IF NOT EXISTS push_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_ciphertext TEXT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    device_id VARCHAR(128) NOT NULL,
    device_name VARCHAR(120),
    app_version VARCHAR(50),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT push_devices_token_encrypted
        CHECK (token_ciphertext LIKE 'enc:v1:%'),
    CONSTRAINT push_devices_token_hash_length
        CHECK (char_length(token_hash) = 64),
    CONSTRAINT push_devices_device_id_length
        CHECK (char_length(device_id) BETWEEN 8 AND 128),
    CONSTRAINT push_devices_user_device_unique UNIQUE (user_id, device_id),
    CONSTRAINT push_devices_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_seen
    ON push_devices(user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_device_id UUID REFERENCES push_devices(id) ON DELETE SET NULL,
    device_id VARCHAR(128) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'processing', 'retry', 'accepted',
            'delivered', 'failed', 'cancelled'
        )),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(120),
    expo_ticket_id TEXT,
    receipt_attempts INTEGER NOT NULL DEFAULT 0 CHECK (receipt_attempts >= 0),
    receipt_available_at TIMESTAMPTZ,
    last_error TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT push_deliveries_notification_device_unique
        UNIQUE (notification_id, user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_claim
    ON push_notification_deliveries(status, available_at, created_at)
    WHERE status IN ('pending', 'retry', 'processing');

CREATE INDEX IF NOT EXISTS idx_push_deliveries_receipts
    ON push_notification_deliveries(receipt_available_at, created_at)
    WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_push_deliveries_user_created
    ON push_notification_deliveries(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_deliveries_ticket_unique
    ON push_notification_deliveries(expo_ticket_id)
    WHERE expo_ticket_id IS NOT NULL;

COMMIT;
