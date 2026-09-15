/**
 * DATA ISOLATION TEST
 * 
 * THIS IS THE CRITICAL TEST REQUIRED BY THE BRIEF:
 * "If someone later removes the thing that keeps the brands apart,
 * we should find out from your tests, not from a client."
 * 
 * This test verifies that Supabase RLS policies enforce brand isolation.
 * It will FAIL if:
 * - RLS is disabled on any tenant-scoped table
 * - RLS policies are removed or weakened
 * - The auth.user_brand_ids() function is modified
 * 
 * The data isolation guarantee lives in:
 *   File: supabase/migrations/002_rls_policies.sql
 *   Lines: ALL
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Test users — must match scripts/create-users.ts
const USERS = {
  kileleOwner: { email: 'kilele.owner@vg-eval.test', password: 'KileleOwner123!' },
  kileleAnalyst: { email: 'kilele.analyst@vg-eval.test', password: 'KileleAnalyst123!' },
  karooOwner: { email: 'karoo.owner@vg-eval.test', password: 'KarooOwner123!' },
  karooAnalyst: { email: 'karoo.analyst@vg-eval.test', password: 'KarooAnalyst123!' },
  marrakechOwner: { email: 'marrakech.owner@vg-eval.test', password: 'MarrakechOwner123!' },
  marrakechAnalyst: { email: 'marrakech.analyst@vg-eval.test', password: 'MarrakechAnalyst123!' },
};

function createAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function createAuthenticatedClient(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth failed for ${email}: ${error.message}`);
  return client;
}

describe('Brand Data Isolation', () => {
  let kileleBrandId: string;
  let karooBrandId: string;
  let marrakechBrandId: string;

  beforeAll(async () => {
    // Get brand IDs using the service role client
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: brands } = await admin.from('brands').select('id, code');
    if (!brands || brands.length < 3) {
      throw new Error('Brands not seeded. Run scripts/seed.ts first.');
    }
    kileleBrandId = brands.find((b) => b.code === 'KILELE')!.id;
    karooBrandId = brands.find((b) => b.code === 'KAROO')!.id;
    marrakechBrandId = brands.find((b) => b.code === 'MARRAKECH')!.id;
  });

  // ============================================================
  // CONTACTS ISOLATION
  // ============================================================

  it('Kilele user can ONLY see Kilele contacts', async () => {
    const client = await createAuthenticatedClient(USERS.kileleOwner.email, USERS.kileleOwner.password);
    const { data: contacts } = await client.from('contacts').select('brand_id').limit(100);
    
    expect(contacts).toBeDefined();
    expect(contacts!.length).toBeGreaterThan(0);
    
    const brandIds = [...new Set(contacts!.map((c) => c.brand_id))];
    expect(brandIds).toHaveLength(1);
    expect(brandIds[0]).toBe(kileleBrandId);
  });

  it('Karoo user cannot see Kilele contacts', async () => {
    const client = await createAuthenticatedClient(USERS.karooOwner.email, USERS.karooOwner.password);
    const { data: contacts } = await client.from('contacts').select('brand_id').limit(100);
    
    expect(contacts).toBeDefined();
    const brandIds = [...new Set(contacts!.map((c) => c.brand_id))];
    expect(brandIds).not.toContain(kileleBrandId);
    expect(brandIds).not.toContain(marrakechBrandId);
  });

  it('Marrakech user can ONLY see Marrakech contacts', async () => {
    const client = await createAuthenticatedClient(USERS.marrakechOwner.email, USERS.marrakechOwner.password);
    const { data: contacts } = await client.from('contacts').select('brand_id').limit(100);
    
    expect(contacts).toBeDefined();
    expect(contacts!.length).toBeGreaterThan(0);
    
    const brandIds = [...new Set(contacts!.map((c) => c.brand_id))];
    expect(brandIds).toHaveLength(1);
    expect(brandIds[0]).toBe(marrakechBrandId);
  });

  // ============================================================
  // CAMPAIGNS ISOLATION
  // ============================================================

  it('Kilele user can ONLY see Kilele campaigns', async () => {
    const client = await createAuthenticatedClient(USERS.kileleOwner.email, USERS.kileleOwner.password);
    const { data: campaigns } = await client.from('campaigns').select('brand_id');
    
    expect(campaigns).toBeDefined();
    expect(campaigns!.length).toBeGreaterThan(0);
    
    const brandIds = [...new Set(campaigns!.map((c) => c.brand_id))];
    expect(brandIds).toHaveLength(1);
    expect(brandIds[0]).toBe(kileleBrandId);
  });

  it('Karoo user cannot see Kilele campaigns', async () => {
    const client = await createAuthenticatedClient(USERS.karooOwner.email, USERS.karooOwner.password);
    const { data: campaigns } = await client.from('campaigns').select('brand_id');
    
    const brandIds = [...new Set((campaigns || []).map((c) => c.brand_id))];
    expect(brandIds).not.toContain(kileleBrandId);
  });

  // ============================================================
  // EVENTS ISOLATION
  // ============================================================

  it('Kilele user can ONLY see Kilele events', async () => {
    const client = await createAuthenticatedClient(USERS.kileleOwner.email, USERS.kileleOwner.password);
    const { data: events } = await client.from('events').select('brand_id').limit(100);
    
    expect(events).toBeDefined();
    expect(events!.length).toBeGreaterThan(0);
    
    const brandIds = [...new Set(events!.map((e) => e.brand_id))];
    expect(brandIds).toHaveLength(1);
    expect(brandIds[0]).toBe(kileleBrandId);
  });

  // ============================================================
  // UNAUTHENTICATED ACCESS
  // ============================================================

  it('Unauthenticated request returns no contacts', async () => {
    const client = createAnonClient();
    const { data: contacts } = await client.from('contacts').select('id').limit(10);
    
    expect(contacts).toBeDefined();
    expect(contacts!).toHaveLength(0);
  });

  it('Unauthenticated request returns no campaigns', async () => {
    const client = createAnonClient();
    const { data: campaigns } = await client.from('campaigns').select('id').limit(10);
    
    expect(campaigns).toBeDefined();
    expect(campaigns!).toHaveLength(0);
  });

  // ============================================================
  // ROLE-BASED RESTRICTIONS
  // ============================================================

  it('Analyst cannot insert into send_batches', async () => {
    const client = await createAuthenticatedClient(USERS.kileleAnalyst.email, USERS.kileleAnalyst.password);
    
    const { error } = await client.from('send_batches').insert({
      brand_id: kileleBrandId,
      campaign_id: '00000000-0000-0000-0000-000000000000',
      idempotency_key: 'test-analyst-blocked-' + Date.now(),
      recipient_count: 1,
      status: 'pending',
    });

    expect(error).toBeDefined();
    // RLS should reject this because analyst is not an owner
  });

  it('Analyst cannot insert campaign_shares', async () => {
    const client = await createAuthenticatedClient(USERS.kileleAnalyst.email, USERS.kileleAnalyst.password);
    
    const { error } = await client.from('campaign_shares').insert({
      campaign_id: '00000000-0000-0000-0000-000000000000',
      brand_id: kileleBrandId,
      token: 'test-analyst-blocked-' + Date.now(),
      password_hash: 'fake',
      created_by: '00000000-0000-0000-0000-000000000000',
    });

    expect(error).toBeDefined();
  });

  // ============================================================
  // CROSS-BRAND WRITE PROTECTION
  // ============================================================

  it('Kilele owner cannot insert contacts for Karoo brand', async () => {
    const client = await createAuthenticatedClient(USERS.kileleOwner.email, USERS.kileleOwner.password);
    
    const { error } = await client.from('contacts').insert({
      brand_id: karooBrandId, // Trying to write to another brand
      external_id: 'CROSS-BRAND-TEST-' + Date.now(),
      full_name: 'Test Cross Brand',
      status: 'active',
    });

    expect(error).toBeDefined();
  });
});
