# Subscriber Dashboard

Internal, admin-only dashboard for tracking subscriber/subscription
activity in your bookkeeping app. Reads from the **same Supabase
project** as your main app but never surfaces personal data (no emails,
names, or company names) - only counts, plans, statuses, and masked IDs.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy the example file and fill in your real values:

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` -
     from Supabase Dashboard → Project Settings → API Keys. The
     publishable key is the modern, safe-for-the-browser replacement for
     the old "anon" key.
   - `SUPABASE_SECRET_KEY` - same page, under "Secret keys". The modern
     replacement for the old "service_role" key. **Never** prefix this
     with `NEXT_PUBLIC_` and never commit it. Used server-side only, to
     read subscription metrics regardless of the main app's RLS policies.
   - `ALLOWED_ADMIN_EMAILS` - comma-separated list of emails allowed to
     use this dashboard. Must match an existing account in this
     Supabase project's `auth.users` (e.g. your own account from signing
     up on the main app).

3. **Run locally**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, sign in with an allow-listed email.

## How auth works here (and why)

This dashboard uses **client-side Supabase Auth only** - no cookies, no
middleware, no SSR session syncing:

- Login happens in the browser; Supabase stores the session in
  `localStorage`, the library's default.
- The dashboard page checks for a session on load and redirects to
  `/login` if there isn't one.
- Data requests to `/api/metrics` send the user's access token as a
  `Bearer` header. The API route validates that token with Supabase,
  confirms the email is on `ALLOWED_ADMIN_EMAILS`, and only then queries
  the database with the secret key.

This is a deliberate simplification for a single-admin, locally-run
tool: cookie-based SSR auth (the original approach) is more robust for
multi-page public sites, but it's also the thing that caused the `431
Request Header Fields Too Large` error during setup - cookie chunking
and redirect loops are a known sharp edge with that pattern. Token-based
auth sidesteps it entirely. If you later add teammates or move to a
setup where server-rendered pages need to know who's logged in without
a client round-trip, cookie-based auth (via `@supabase/ssr`) is the
right tool then - just budget time to get the cookie handling exactly
right.

## Deploying to Vercel later

- Add the same four environment variables in Vercel's project settings.
- Double-check `SUPABASE_SECRET_KEY` is added as a regular (non-public)
  environment variable - Vercel keeps these server-side only, same as
  locally.
- Nothing else changes; this is a standard Next.js App Router project.

## Known limitations / things to improve later

- **Cancellation dates are approximate.** `user_subscriptions` has no
  `canceled_at` column, so a cancellation is inferred from
  `status = 'canceled'` using `updated_at` as a stand-in. If a
  subscription's status changes again later, that history is lost. For
  exact churn tracking, consider adding a `subscription_events` table
  (e.g. `id, user_id, subscription_id, event_type, plan, created_at`)
  and writing to it from wherever your app currently updates
  `user_subscriptions.status`.
- **MRR is estimated**, not billed revenue. `user_subscriptions.plan` is
  just a text label with no stored price, so `lib/planPricing.ts` maps
  plan names to monthly dollar amounts by hand:

  - `free`: $0
  - `pro`: $9 / month
  - `pro plus`: $15 / month

  Yearly `pro` subscriptions are $84 / year, but the dashboard has no
  billing-interval column to distinguish monthly from yearly subscribers,
  so MRR currently assumes every paid subscriber is on the monthly plan.
  To fix this, add an `interval` column (e.g. `'month'` / `'year'`) to
  `user_subscriptions` and divide the yearly amount by 12 in the MRR
  calculation.
- **Missing plans are treated as free.** Any subscription with a
  null/empty plan, or any user without a subscription row, is counted as
  `free` in the plan distribution chart, subscribers table, and the
  subscribers-over-time graph.
- **Access control** is a simple email allow-list
  (`ALLOWED_ADMIN_EMAILS`), checked in `/api/metrics`. Fine for a single
  admin (you); if you ever add teammates, an `is_admin` column would
  scale better than an env var.

## Attribution tracking

The Subscribers table shows first-touch source, signup-touch source, and
signup UTM/referrer data. This requires two things:

1. **Add columns to Supabase.** Run the migration in
   `supabase/migrations/20260926000000_add_attribution_to_profiles.sql`
   from Supabase Dashboard → SQL Editor.

2. **Capture attribution in your main app.** The dashboard only reads
   `profiles`; it cannot record first/signup touch itself. In your main
   bookkeeping app, write to these columns when a profile is created or
   updated.

   Suggested capture flow:

   - On any page load, read UTM params from the URL and the referrer
     from `document.referrer`. If the visitor does not already have a
     stored `first_touch_source`, save one (e.g. UTM source, referrer
     host, or a fallback like "direct / unknown").
   - At signup, snapshot the current source again into
     `signup_touch_source` and the raw UTM values into
     `signup_utm_source`, `signup_utm_medium`, `signup_utm_campaign`,
     `signup_utm_content`, `signup_utm_term`, plus `signup_referrer`.

   Example values:

   - First touch: `linkedin`
   - Signup touch: `google`
   - UTM source: `google`, medium: `cpc`, campaign: `q4_launch`

   This preserves the distinction between discovery channel and the
   channel that drove the actual conversion.

## Personal data

This dashboard now shows subscriber names, emails, company names, and
attribution data in the "Subscribers" table, since it's an internal tool
only you (an allow-listed admin) can log into. The activity feed and
upcoming-renewals list still use short masked IDs instead of names, since
those are meant as a quick glance rather than a lookup. If you ever add
teammates or move this off `localhost`, revisit whether everyone who can
log in should see full subscriber PII and attribution details, or whether
it's worth splitting into a "my eyes only" view vs. a broader team view.
