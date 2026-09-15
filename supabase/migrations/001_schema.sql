-- ============================================================
-- 001_schema.sql — Core tables for the campaign portal
-- ============================================================
-- KEY DESIGN: Every tenant-scoped table has `brand_id`.
-- Data isolation is enforced at two layers:
--   1. Compound unique keys: (brand_id, external_id) — prevents cross-brand collisions
--   2. RLS policies (see 002_rls_policies.sql) — prevents cross-brand access
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

-- Index for fast RLS lookups
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
  -- CT-000050 can exist in KILELE, KAROO, and MARRAKECH simultaneously
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
  parent_campaign_id  TEXT,  -- stored as text, may reference cross-brand campaign
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
  event_type            TEXT NOT NULL,  -- open, click, bounce, complaint, unsubscribe, delivered, bounced, opened, unsubscribed
  channel               TEXT,
  occurred_at_utc       TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DATA ISOLATION: compound unique key prevents cross-brand event collisions
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
  last_event_cursor   TEXT,                    -- last event_id from provider polling
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
  expires_at    TIMESTAMPTZ                  -- optional expiry
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
  errors          JSONB DEFAULT '[]'::jsonb,   -- [{row, field, value, reason}]
  warnings        JSONB DEFAULT '[]'::jsonb,   -- [{row, field, value, reason}]
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);
