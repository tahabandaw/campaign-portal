import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://pvwaujpkamfljnqwoihz.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2d2F1anBrYW1mbGpucXdvaWh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTQzNTgzOCwiZXhwIjoyMTA1MDExODM4fQ.87-9dKKYB_dGDlMLbOx3rkpDOLiVNnhnPp4dLSxuUvs';

// Admin client bypasses RLS — use ONLY for:
// - Data seeding scripts
// - Cron jobs (event polling)
// - Public share verification (unauthenticated external recipients)
// NEVER expose to client-side code
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
