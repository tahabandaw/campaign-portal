// Database types matching supabase/migrations/001_schema.sql

export type BrandCode = 'KILELE' | 'KAROO' | 'MARRAKECH';
export type UserRole = 'owner' | 'analyst';
export type ContactStatus = 'active' | 'bounced' | 'unsubscribed' | 'pending' | 'unknown';
export type CampaignChannel = 'email' | 'sms';
export type SendBatchStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'partial';
export type EventType = 'open' | 'click' | 'bounce' | 'complaint' | 'unsubscribe' | 'delivered' | 'bounced' | 'opened' | 'unsubscribed';

export interface Brand {
  id: string;
  code: BrandCode;
  name: string;
  country: string | null;
  timezone: string;
  created_at: string;
}

export interface BrandUser {
  id: string;
  user_id: string;
  brand_id: string;
  role: UserRole;
  brand?: Brand;
}

export interface Contact {
  id: string;
  brand_id: string;
  external_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  signup_at: string | null;
  status: string;
  consent_marketing: boolean | null;
  deleted_at: string | null;
  suppressed_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  brand_id: string;
  external_id: string;
  campaign_name: string;
  channel: CampaignChannel;
  target_country: string | null;
  reported_sent: number;
  reported_delivered: number;
  reported_bounced: number;
  reported_opens: number;
  reported_clicks: number;
  spend: number;
  sent_at_utc: string | null;
  send_local_time: string | null;
  parent_campaign_id: string | null;
  created_at: string;
}

export interface CampaignEvent {
  id: string;
  brand_id: string;
  event_id: string;
  contact_external_id: string;
  campaign_external_id: string;
  event_type: EventType;
  channel: string | null;
  occurred_at_utc: string;
  created_at: string;
}

export interface SendBatch {
  id: string;
  brand_id: string;
  campaign_id: string;
  batch_key: string | null;
  idempotency_key: string;
  recipient_count: number;
  status: SendBatchStatus;
  queued_at: string;
  sent_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  error_message: string | null;
  last_event_cursor: string | null;
  last_event_poll_at: string | null;
  provider_accepted: number;
  provider_rejected: number;
  delivered_count: number;
  bounced_count: number;
  opened_count: number;
  unsubscribed_count: number;
  campaign?: Campaign;
}

export interface CampaignShare {
  id: string;
  campaign_id: string;
  brand_id: string;
  token: string;
  password_hash: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
}

export interface ImportLog {
  id: string;
  brand_id: string | null;
  file_name: string;
  imported_at: string;
  total_rows: number;
  rows_imported: number;
  rows_skipped: number;
  rows_updated: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  status: string;
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  reason: string;
}

export interface ImportWarning {
  row: number;
  field?: string;
  value?: string;
  reason: string;
}

// Dashboard types
export interface DashboardStats {
  totalCustomers: number;
  contactableCustomers: number;
  contactableMethodology: string;
}

export interface SignupsByDay {
  date: string;
  count: number;
}

export interface CampaignPerformance {
  id: string;
  external_id: string;
  campaign_name: string;
  channel: CampaignChannel;
  reported_sent: number;
  reported_delivered: number;
  reported_bounced: number;
  reported_opens: number;
  reported_clicks: number;
  spend: number;
  sent_at_utc: string | null;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

// Messaging provider types
export interface DispatcherSendRequest {
  campaign?: string;
  brand?: string;
  recipients: DispatcherRecipient[];
}

export interface DispatcherRecipient {
  id: string;
  email?: string;
  phone?: string;
}

export interface DispatcherSendResponse {
  batch_id: string;
  accepted: DispatcherRecipient[];
  rejected: DispatcherRecipient[];
}

export interface DispatcherEvent {
  event_id: string;
  recipient_id: string;
  event_type: 'delivered' | 'bounced' | 'opened' | 'unsubscribed';
  occurred_at: string;
}

export interface DispatcherEventsResponse {
  events: DispatcherEvent[];
  next_cursor: string | null;
  has_more: boolean;
}
