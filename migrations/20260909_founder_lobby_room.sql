-- Shared Founder Lobby stations. These tables are deliberately independent
-- from projects, tasks, notes, and every normal Optimus workspace feature.

BEGIN;

ALTER TABLE founder_lobby_settings
    ADD COLUMN IF NOT EXISTS company_started_on DATE,
    ADD COLUMN IF NOT EXISTS sales_target NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sales_currency VARCHAR(8) NOT NULL DEFAULT 'USD';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'founder_lobby_settings_sales_target_check'
    ) THEN
        ALTER TABLE founder_lobby_settings
            ADD CONSTRAINT founder_lobby_settings_sales_target_check CHECK (sales_target >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS founder_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(160) NOT NULL,
    details TEXT,
    milestone_on DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'achieved')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS founder_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(160) NOT NULL,
    current_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
    target_value NUMERIC(14, 2) NOT NULL CHECK (target_value > 0),
    unit VARCHAR(24) NOT NULL DEFAULT '',
    deadline DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS founder_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name VARCHAR(160) NOT NULL,
    company VARCHAR(160),
    email VARCHAR(255),
    owner VARCHAR(120),
    stage VARCHAR(24) NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
    value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
    follow_up_on DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS founder_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_milestones_date ON founder_milestones(milestone_on, created_at);
CREATE INDEX IF NOT EXISTS idx_founder_targets_status ON founder_targets(status, deadline);
CREATE INDEX IF NOT EXISTS idx_founder_leads_stage ON founder_leads(stage, follow_up_on);
CREATE INDEX IF NOT EXISTS idx_founder_notes_updated ON founder_notes(updated_at DESC);

COMMIT;
