-- ============================================================
-- 002_rls_policies.sql — Row Level Security for brand isolation
-- ============================================================
-- THIS IS THE DATA ISOLATION GUARANTEE.
-- File: supabase/migrations/002_rls_policies.sql
-- Lines: ALL
--
-- If these policies are removed, the data-isolation test in
-- __tests__/data-isolation.test.ts WILL FAIL.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the set of brand IDs the current user belongs to.
-- Used by every RLS policy to scope data access.
CREATE OR REPLACE FUNCTION auth.user_brand_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id FROM public.brand_users WHERE user_id = auth.uid()
$$;

-- Returns TRUE if the current user is an 'owner' for the given brand.
-- Used to restrict write operations to owners only.
CREATE OR REPLACE FUNCTION auth.is_owner(check_brand_id UUID)
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

-- ============================================================
-- ENABLE RLS ON ALL TENANT-SCOPED TABLES
-- ============================================================
ALTER TABLE public.brands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BRANDS — users can only see brands they belong to
-- ============================================================
CREATE POLICY brands_select ON public.brands
  FOR SELECT USING (
    id IN (SELECT auth.user_brand_ids())
  );

-- ============================================================
-- BRAND_USERS — users can only see their own memberships
-- ============================================================
CREATE POLICY brand_users_select ON public.brand_users
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- ============================================================
-- CONTACTS — scoped to user's brand(s)
-- ============================================================
CREATE POLICY contacts_select ON public.contacts
  FOR SELECT USING (
    brand_id IN (SELECT auth.user_brand_ids())
  );

CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT WITH CHECK (
    auth.is_owner(brand_id)
  );

CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE USING (
    auth.is_owner(brand_id)
  );

-- ============================================================
-- CAMPAIGNS — scoped to user's brand(s)
-- ============================================================
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT USING (
    brand_id IN (SELECT auth.user_brand_ids())
  );

CREATE POLICY campaigns_insert ON public.campaigns
  FOR INSERT WITH CHECK (
    auth.is_owner(brand_id)
  );

CREATE POLICY campaigns_update ON public.campaigns
  FOR UPDATE USING (
    auth.is_owner(brand_id)
  );

-- ============================================================
-- EVENTS — scoped to user's brand(s)
-- ============================================================
CREATE POLICY events_select ON public.events
  FOR SELECT USING (
    brand_id IN (SELECT auth.user_brand_ids())
  );

CREATE POLICY events_insert ON public.events
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT auth.user_brand_ids())
  );

-- ============================================================
-- SEND_BATCHES — select for own brand, write for owners only
-- ============================================================
CREATE POLICY send_batches_select ON public.send_batches
  FOR SELECT USING (
    brand_id IN (SELECT auth.user_brand_ids())
  );

CREATE POLICY send_batches_insert ON public.send_batches
  FOR INSERT WITH CHECK (
    auth.is_owner(brand_id)
  );

CREATE POLICY send_batches_update ON public.send_batches
  FOR UPDATE USING (
    auth.is_owner(brand_id)
  );

-- ============================================================
-- CAMPAIGN_SHARES — select for own brand, create for owners only
-- ============================================================
CREATE POLICY campaign_shares_select ON public.campaign_shares
  FOR SELECT USING (
    brand_id IN (SELECT auth.user_brand_ids())
  );

CREATE POLICY campaign_shares_insert ON public.campaign_shares
  FOR INSERT WITH CHECK (
    auth.is_owner(brand_id)
  );

-- ============================================================
-- IMPORT_LOGS — scoped to user's brand(s)
-- ============================================================
CREATE POLICY import_logs_select ON public.import_logs
  FOR SELECT USING (
    brand_id IN (SELECT auth.user_brand_ids())
  );
