-- ============================================================
-- schema.sql — Complete Database Schema for Velocity Growth Campaign Portal
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,   -- 'KILELE', 'KAROO', 'MARRAKECH'
  name        TEXT NOT NULL,          -- 'Kilele Rides', 'Karoo Coaches', 'Marrakech Express'
  country     TEXT,                   -- 'KE', 'ZA', 'MA'
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. BRAND_USERS — Maps auth.users to brands with roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_users (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id  UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'analyst')),
  UNIQUE(user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_users_user_id ON public.brand_users(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_users_brand_id ON public.brand_users(brand_id);

-- ============================================================
-- 3. CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  external_id         TEXT NOT NULL,
  full_name           TEXT,
  email               TEXT,
  phone               TEXT,
  country             TEXT,
  city                TEXT,
  signup_at           TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active',
  consent_marketing   BOOLEAN,
  deleted_at          TIMESTAMPTZ,
  suppressed_until    TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DATA ISOLATION: compound unique key prevents cross-brand ID collisions
  UNIQUE(brand_id, external_id)
);

-- ============================================================
-- 4. CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  external_id         TEXT NOT NULL,
  campaign_name       TEXT NOT NULL,
  channel             TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  target_country      TEXT,
  reported_sent       INTEGER DEFAULT 0,
  reported_delivered  INTEGER DEFAULT 0,
  reported_bounced    INTEGER DEFAULT 0,
  reported_opens      INTEGER DEFAULT 0,
  reported_clicks     INTEGER DEFAULT 0,
  spend               NUMERIC(12,2) DEFAULT 0,
  sent_at_utc         TIMESTAMPTZ,
  send_local_time     TEXT,
  parent_campaign_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DATA ISOLATION: compound unique key
  UNIQUE(brand_id, external_id)
);

-- ============================================================
-- 5. EVENTS — Engagement/delivery telemetry
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  event_id              TEXT NOT NULL,
  contact_external_id   TEXT NOT NULL,
  campaign_external_id  TEXT NOT NULL,
  event_type            TEXT NOT NULL,  -- open, click, bounce, complaint, unsubscribe, delivered, opened, etc.
  channel               TEXT,
  occurred_at_utc       TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DATA ISOLATION: compound unique key
  UNIQUE(brand_id, event_id)
);

-- ============================================================
-- 6. SEND_BATCHES — Tracks sends through the messaging provider
-- ============================================================
CREATE TABLE IF NOT EXISTS public.send_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  campaign_id         UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  batch_key           TEXT,                    -- batch_id from provider response
  idempotency_key     TEXT UNIQUE NOT NULL,    -- prevents double-sends
  recipient_count     INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'partial')),
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at             TIMESTAMPTZ,
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  error_message       TEXT,
  last_event_cursor   TEXT,
  last_event_poll_at  TIMESTAMPTZ,
  provider_accepted   INTEGER DEFAULT 0,
  provider_rejected   INTEGER DEFAULT 0,
  delivered_count     INTEGER DEFAULT 0,
  bounced_count       INTEGER DEFAULT 0,
  opened_count        INTEGER DEFAULT 0,
  unsubscribed_count  INTEGER DEFAULT 0
);

-- ============================================================
-- 7. CAMPAIGN_SHARES — Password-protected public share links
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_shares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  brand_id      UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  token         TEXT UNIQUE NOT NULL,        -- random URL-safe token
  password_hash TEXT NOT NULL,               -- bcrypt hash
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

-- ============================================================
-- 8. IMPORT_LOGS — Tracks data loading results
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_rows      INTEGER DEFAULT 0,
  rows_imported   INTEGER DEFAULT 0,
  rows_skipped    INTEGER DEFAULT 0,
  rows_updated    INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]'::jsonb,
  warnings        JSONB DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_brand_signup ON public.contacts(brand_id, signup_at);
CREATE INDEX IF NOT EXISTS idx_contacts_brand_status_consent ON public.contacts(brand_id, status, consent_marketing) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_brand_email ON public.contacts(brand_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_brand_name ON public.contacts(brand_id, full_name);
CREATE INDEX IF NOT EXISTS idx_events_brand_campaign ON public.events(brand_id, campaign_external_id);
CREATE INDEX IF NOT EXISTS idx_events_brand_contact ON public.events(brand_id, contact_external_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON public.campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_send_batches_status ON public.send_batches(status) WHERE status IN ('sent', 'sending');
CREATE INDEX IF NOT EXISTS idx_send_batches_campaign ON public.send_batches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_shares_token ON public.campaign_shares(token);
CREATE INDEX IF NOT EXISTS idx_import_logs_brand ON public.import_logs(brand_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES (THE DATA ISOLATION GUARANTEE)
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_brand_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id FROM public.brand_users WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_owner(check_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.brand_users
    WHERE user_id = auth.uid()
      AND brand_id = check_brand_id
      AND role = 'owner'
  )
$$;

ALTER TABLE public.brands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs   ENABLE ROW LEVEL SECURITY;

-- BRANDS
DROP POLICY IF EXISTS brands_select ON public.brands;
CREATE POLICY brands_select ON public.brands
  FOR SELECT USING (id IN (SELECT public.user_brand_ids()));

-- BRAND_USERS
DROP POLICY IF EXISTS brand_users_select ON public.brand_users;
CREATE POLICY brand_users_select ON public.brand_users
  FOR SELECT USING (user_id = auth.uid());

-- CONTACTS
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts
  FOR SELECT USING (brand_id IN (SELECT public.user_brand_ids()));

DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT WITH CHECK (public.is_owner(brand_id));

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE USING (public.is_owner(brand_id));

-- CAMPAIGNS
DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT USING (brand_id IN (SELECT public.user_brand_ids()));

DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
CREATE POLICY campaigns_insert ON public.campaigns
  FOR INSERT WITH CHECK (public.is_owner(brand_id));

DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
CREATE POLICY campaigns_update ON public.campaigns
  FOR UPDATE USING (public.is_owner(brand_id));

-- EVENTS
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events
  FOR SELECT USING (brand_id IN (SELECT public.user_brand_ids()));

DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT WITH CHECK (public.is_owner(brand_id));

-- SEND_BATCHES
DROP POLICY IF EXISTS send_batches_select ON public.send_batches;
CREATE POLICY send_batches_select ON public.send_batches
  FOR SELECT USING (brand_id IN (SELECT public.user_brand_ids()));

DROP POLICY IF EXISTS send_batches_insert ON public.send_batches;
CREATE POLICY send_batches_insert ON public.send_batches
  FOR INSERT WITH CHECK (public.is_owner(brand_id));

DROP POLICY IF EXISTS send_batches_update ON public.send_batches;
CREATE POLICY send_batches_update ON public.send_batches
  FOR UPDATE USING (public.is_owner(brand_id));

-- CAMPAIGN_SHARES
DROP POLICY IF EXISTS campaign_shares_select ON public.campaign_shares;
CREATE POLICY campaign_shares_select ON public.campaign_shares
  FOR SELECT USING (brand_id IN (SELECT public.user_brand_ids()));

DROP POLICY IF EXISTS campaign_shares_insert ON public.campaign_shares;
CREATE POLICY campaign_shares_insert ON public.campaign_shares
  FOR INSERT WITH CHECK (public.is_owner(brand_id));

-- IMPORT_LOGS
DROP POLICY IF EXISTS import_logs_select ON public.import_logs;
CREATE POLICY import_logs_select ON public.import_logs
  FOR SELECT USING (brand_id IN (SELECT public.user_brand_ids()));
