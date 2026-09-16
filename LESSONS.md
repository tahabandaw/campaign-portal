# Engineering Lessons & Operational Guidelines

## 1. Monolithic Root Server Component Awaits vs React Suspense Streaming
- **What broke:** Dashboard initial page load was experiencing high TTFB (several seconds), especially when aggregating customer and campaign telemetry for large tenants.
- **Why it broke (Root Cause):** The root page component `DashboardPage` awaited all 4 large queries (`totalCustomers`, `contactableCustomers`, `campaigns`, `signups`) in a single blocking `Promise.all` block before rendering any JSX. Next.js App Router could not flush chunk 0 (the HTML shell) until the slowest query finished.
- **Pattern to avoid:** Never block the root Server Component render on all child sub-tree queries. Do not fetch data needed only by child sections at the top-level page component.
- **Rule that prevents it:** Split data fetching into independent async server subcomponents and wrap each in `<Suspense fallback={<Skeleton />}>`. Next.js flushes the static shell immediately (TTFB < 50ms) and streams data-heavy sections in parallel as they resolve.

## 2. Nav Link & Route Parity
- **What broke:** Navigating to "Import Log" triggered a 404 error (`/import-log` not found).
- **Why it broke (Root Cause):** The sidebar navigation array had `href: "/import-log"`, whereas the route was implemented at `src/app/(portal)/imports/page.tsx` (`/imports`).
- **Pattern to avoid:** Hardcoding route URLs without asserting against App Router directory structure.
- **Rule that prevents it:** Keep a route dictionary or verify route filepaths against navigation links during integration testing.

## 3. Contactable Calculation Consistency
- **Rule:** A contact is contactable if and only if `status = 'active'`, `consent_marketing = true`, `deleted_at IS NULL`, and `(suppressed_until IS NULL OR suppressed_until < now())`.
