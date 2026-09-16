# Campaign Portal

A multi-tenant campaign management and marketing analytics service designed to host multiple client brands within a single database while guaranteeing strict, policy-enforced data isolation.

---

## 📌 Architecture & Features

- **Multi-Tenant Isolation**: Complete database-level tenant isolation using PostgreSQL Row Level Security (RLS) policies and compound unique constraints `(brand_id, external_id)`.
- **Role-Based Access Control**:
  - **Owner**: Full access to view telemetry, dispatch campaigns, and generate secure public share links.
  - **Analyst**: View-only access to campaign analytics, contacts, and import history.
- **Data Ingestion Pipeline**: Ingestion and cleaning engine handling CSV delimiter detection (`;` vs `,`), European decimal parsing, dirty status values, and boolean variations.
- **Campaign Dispatching & Idempotency**: Atomic send queueing with unique idempotency keys preventing duplicate dispatches and race conditions.
- **Public Campaign Results Sharing**: Granular, password-protected public share links hashed with salted bcrypt (10 rounds) exposing aggregate telemetry without brand or contact leakage.
- **Responsive Client Experience**: Mobile-first design featuring touch targets, adaptive card views for small viewports, and full desktop data tables.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Components & Streaming)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Auth)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/) via `@opennextjs/cloudflare`
- **Testing**: [Vitest](https://vitest.dev/)

---

## 📋 Prerequisites

- **Node.js**: `v20+` or `v22+`
- **npm**: `v10+`
- A configured **Supabase** project

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/tahabandaw/campaign-portal.git
cd campaign-portal
npm install
```

### 2. Configure Environment Variables

Create `.env.local` using the template from `.env.example`:

```bash
cp .env.example .env.local
```

Configure your environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Messaging Provider API Configuration
DISPATCHER_API_KEY=your_dispatcher_api_key

# Cron / Automation Secret
CRON_SECRET=your_cron_secret_token
```

### 3. Database Migration & Data Seeding

1. Execute [`schema.sql`](./schema.sql) in your Supabase SQL Editor to provision tables, indexes, and Row Level Security policies.
2. Ingest seed data and provision user roles:

```bash
# Seed brands, contacts, campaigns, events, and send logs
npx tsx scripts/seed.ts

# Create application users and brand assignments
npx tsx scripts/create-users.ts
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

The automated test suite verifies tenant isolation, dispatch idempotency, password hashing security, and data cleaning utilities:

```bash
npm test
# or
npx vitest run
```

---

## 📦 Production Build & Deployment

### Local Production Build

```bash
npm run build:next
npm run start
```

### Deploy to Cloudflare Workers

```bash
npm run deploy:cloudflare
```

*(Configure runtime secrets such as `SUPABASE_SERVICE_ROLE_KEY` and `DISPATCHER_API_KEY` in your Cloudflare dashboard under Workers & Pages Settings).*

---

## 🔒 Security & Data Isolation Architecture

- **Row Level Security**: All database tables (`contacts`, `campaigns`, `events`, `send_batches`, `campaign_shares`, `import_logs`) enforce RLS through `auth.user_brand_ids()`.
- **Compound Keys**: Constraints like `UNIQUE(brand_id, external_id)` ensure external identifiers across tenants never collide or overwrite each other.
- **Client Security**: The front-end operates strictly with the Supabase anon key and session tokens; service role capabilities are restricted to administrative scripts and cron tasks.
