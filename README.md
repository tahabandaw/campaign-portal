# Velocity Growth — Client Campaign Portal

A multi-tenant campaign and marketing growth management portal built for Velocity Growth. Supports three distinct brands (**Kilele Rides**, **Karoo Coaches**, and **Marrakech Express**) running in one database under complete, cryptographically and policy-guaranteed data isolation.

---

## 📋 Submission Details

### 1. The Six Test Logins

| Brand | Market | Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Kilele Rides** | Kenya (UTC+3) | Owner | `kilele.owner@vg-eval.test` | `KileleOwner123!` | View data, dispatch sends, create shares |
| **Kilele Rides** | Kenya (UTC+3) | Analyst | `kilele.analyst@vg-eval.test` | `KileleAnalyst123!` | View-only (Send & Share disabled) |
| **Karoo Coaches** | South Africa (UTC+2) | Owner | `karoo.owner@vg-eval.test` | `KarooOwner123!` | View data, dispatch sends, create shares |
| **Karoo Coaches** | South Africa (UTC+2) | Analyst | `karoo.analyst@vg-eval.test` | `KarooAnalyst123!` | View-only (Send & Share disabled) |
| **Marrakech Express**| Morocco (UTC+1) | Owner | `marrakech.owner@vg-eval.test` | `MarrakechOwner123!` | View data, dispatch sends, create shares |
| **Marrakech Express**| Morocco (UTC+1) | Analyst | `marrakech.analyst@vg-eval.test` | `MarrakechAnalyst123!` | View-only (Send & Share disabled) |

*Google OAuth sign-in is supported via Supabase Auth using the same authenticated domains/accounts.*

### 2. Provider API Key
`vgk_59a3fe7d3d70067c0b677570fbdefb1a333c66a7e981c0a0`

### 3. Campaign Send Tracking
- **Where Recorded**: Outgoing campaign dispatches are tracked in `send_batches` table with unique `idempotency_key`, `batch_key` (the provider's batch ID), `recipient_count`, `approved_by`, `approved_at`, `provider_accepted`, and `provider_rejected`.
- **Event Telemetry**: Delivered, bounced, opened, and unsubscribed events returned by the dispatcher are ingested into the `events` table.
- **Contact State Sync**: Bounced or unsubscribed events immediately update the contact's `status` column in `contacts` (`'bounced'` / `'unsubscribed'`), ensuring contactable counts reflect reality.

---

## 🔒 The Data Isolation Guarantee

### Where It Lives
- **Database Schema**: [`schema.sql`](./schema.sql) and [`supabase/migrations/002_rls_policies.sql`](./supabase/migrations/002_rls_policies.sql) (Lines 23–140).
- **Core Mechanism**: 
  1. **Row Level Security (RLS)** is enabled on all tables (`contacts`, `campaigns`, `events`, `send_batches`, `campaign_shares`, `import_logs`, `brand_users`, `brands`).
  2. The security-definer helper function `auth.user_brand_ids()` dynamically resolves the authenticated user's tenant membership:
     ```sql
     CREATE OR REPLACE FUNCTION auth.user_brand_ids()
     RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
       SELECT brand_id FROM public.brand_users WHERE user_id = auth.uid()
     $$;
     ```
  3. Every tenant table checks `brand_id IN (SELECT auth.user_brand_ids())`.
  4. Write operations enforce `auth.is_owner(brand_id)`.
  5. Compound Unique Keys (`brand_id, external_id`) prevent cross-brand ID collisions (`CT-000050` can exist simultaneously in all three brands without overwriting or leaking).

### The Test That Fails If Isolation Is Removed
- **Test File**: [`__tests__/data-isolation.test.ts`](./__tests__/data-isolation.test.ts)
- Verifies that:
  - Kilele users receive zero rows when requesting Karoo or Marrakech data.
  - Direct unauthenticated Supabase queries with anon keys return zero rows.
  - Analysts cannot insert into `send_batches` or create `campaign_shares`.
  - An owner of Brand A cannot insert or update records tagged with Brand B.

---

## 🛠️ Data Quality Handling & Seed Pipeline

During data ingestion, the automated pipeline in [`scripts/normalize.ts`](./scripts/normalize.ts) and [`scripts/seed.ts`](./scripts/seed.ts) resolved 15+ deliberate edge cases:

1. **Delimiter Variations**: Auto-detected `;` vs `,` (Marrakech files use semicolons).
2. **European Decimals**: Parsed `221,09` and `1.420,00` spend values to standard floats without corrupting standard decimal points.
3. **Column Mapping**: Normalized Karoo Title Case headers (`Full Name`, `External Id`, `Signup At`) and Marrakech French headers (`pays` $\rightarrow$ `country`, `e_mail` $\rightarrow$ `email`, `mobile` $\rightarrow$ `phone`).
4. **Boolean Pollution**: Normalized 10+ variations in `consent_marketing` (`true`, `TRUE`, `1`, `Y`, `yes`, `active`, `false`, `FALSE`, `0`, `no`, `f`, `n`, `""`).
5. **Data Misalignment**: Detected ~20 records where dates leaked into the `status` column and safely flagged them as `'unknown'` while preserving row integrity.
6. **Compound Key Deduplication**: Prevented collisions for duplicate campaign rows (`KIL-0044`, `CMP-014`) and identical contact IDs across brands (`CT-000050`).
7. **CDC Delta File**: Ingested `kilele-contacts-delta-2026-09-01.csv` as an UPSERT pass (2,500 updates to existing contacts and 1,681 newly acquired contacts).
8. **Auditable Import Log**: The `/imports` page in the portal shows total rows, imported, skipped, and detailed error/warning lists for complete transparency.

---

## 📊 Dashboard Methodology & Number Explanation

### Contactable Customers Definition
> **Contactable** = `status = 'active'` AND `consent_marketing = true` AND `deleted_at IS NULL` AND (`suppressed_until IS NULL` OR `suppressed_until < now()`).  
> *Contacts who registered an 'unsubscribe' event have their status transitioned to 'unsubscribed' and are excluded.*

### Number We Are Least Sure About
- **Reported Opens on Historical Campaigns**: In `kilele-campaigns.csv`, several campaigns (e.g. `KIL-0016`) show `reported_opens` (12,679) exceeding `reported_delivered` (10,108). This is explicitly noted in the UI: *"Open counts represent gross engagement events and may exceed delivered counts when individual recipients open a message multiple times."*

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DISPATCHER_API_KEY=vgk_59a3fe7d3d70067c0b677570fbdefb1a333c66a7e981c0a0
CRON_SECRET=your_cron_secret_token
```

### 3. Database Migration & Seed
Run `schema.sql` inside your Supabase SQL Editor, then execute:
```bash
npx tsx scripts/seed.ts
npx tsx scripts/create-users.ts
```

### 4. Run Tests
```bash
npx vitest run
```

### 5. Start Application
```bash
npm run dev
```

---

## 🤖 Engineering & Tooling Note
- **AI Tools Used**: Antigravity (Google DeepMind) pairing assistant.
- **Architecture**: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL with RLS, Vitest.
