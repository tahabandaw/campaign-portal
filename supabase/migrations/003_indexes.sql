-- ============================================================
-- 003_indexes.sql — Performance indexes
-- ============================================================
-- Critical for Kilele (84K contacts, 312K events) to perform
-- as well as Marrakech (961 contacts).
-- ============================================================

-- Contacts: signups per day chart
CREATE INDEX idx_contacts_brand_signup ON public.contacts(brand_id, signup_at);

-- Contacts: contactable count computation
CREATE INDEX idx_contacts_brand_status_consent ON public.contacts(brand_id, status, consent_marketing)
  WHERE deleted_at IS NULL;

-- Contacts: search by email
CREATE INDEX idx_contacts_brand_email ON public.contacts(brand_id, email);

-- Contacts: search by name (trigram would be better but this is sufficient)
CREATE INDEX idx_contacts_brand_name ON public.contacts(brand_id, full_name);

-- Events: aggregate by campaign
CREATE INDEX idx_events_brand_campaign ON public.events(brand_id, campaign_external_id);

-- Events: lookup by contact
CREATE INDEX idx_events_brand_contact ON public.events(brand_id, contact_external_id);

-- Events: event type for filtering
CREATE INDEX idx_events_type ON public.events(event_type);

-- Campaigns: brand listing
CREATE INDEX idx_campaigns_brand ON public.campaigns(brand_id);

-- Send batches: find active batches for polling
CREATE INDEX idx_send_batches_status ON public.send_batches(status)
  WHERE status IN ('sent', 'sending');

-- Send batches: by campaign for history
CREATE INDEX idx_send_batches_campaign ON public.send_batches(campaign_id);

-- Campaign shares: token lookup (already has UNIQUE but explicit)
CREATE INDEX idx_campaign_shares_token ON public.campaign_shares(token);

-- Import logs: brand listing
CREATE INDEX idx_import_logs_brand ON public.import_logs(brand_id);
