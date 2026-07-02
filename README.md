# Google DSA Interview Prep

Track ~770 Google interview LeetCode questions, run 2-hour mock interviews with 5 problems, and review solved problems with Anki-style spaced repetition.

> **New here?** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is a full deep dive — tech stack, request flow, the role of Vercel/Supabase, database schema + RLS policies, the SM-2/interview-selection/recommendations algorithms, and a changelog of the recent performance and UX work. Written to be useful for both a junior dev ramping up and a senior dev reviewing the design.

## Features

- **Progress tracking** — mark problems as attempted/solved, filter by difficulty/topic/status, adjustable rows-per-page (25/50/100/All)
- **Dashboard** — coverage stats, topic gaps, and smart "next up" recommendations, backed by a single-query Postgres RPC
- **Mock interview** — 5 problems (1 Easy, 3 Medium, 1 Hard), 2-hour timer, weighted by Google frequency, optimistic "Mark as done"
- **Spaced repetition** — SM-2 algorithm with Again / Hard / Good / Easy ratings
- **Auth** — Google OAuth + email/password via Supabase
- **Responsive UI** — skeleton loaders on every route, optimistic status/completion toggles (no waiting on the server round trip to see the click register)

## Tech stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- Supabase (PostgreSQL, Auth, RLS)
- Vercel (hosting)
- Next.js Data Cache (`unstable_cache`) + React `cache()` for request-level and cross-request caching

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why each of these was chosen and how they fit together.

## Setup

### 1. Clone and install

```bash
npm install
cp .env.local.example .env.local
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In **SQL Editor**, run the migrations in order:
   - [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql) — tables + RLS (required).
   - [`supabase/migrations/002_dashboard_stats.sql`](supabase/migrations/002_dashboard_stats.sql) — `get_user_dashboard_stats` RPC that powers the dashboard in one query (optional — the app falls back to computing stats in JS if this isn't installed, just slightly slower).
3. Copy your project URL and anon key into `.env.local`.
4. Copy the **service role key** (Settings → API) into `.env.local` for seeding only.

### 3. Seed problems

```bash
npm run seed
```

This loads ~770 problems from `data/problems.csv`.

### 4. Configure auth

**Email/password** is enabled by default in Supabase.

**Google OAuth:**

1. Supabase → Authentication → Providers → Google → enable.
2. Add your Google OAuth client ID/secret (from [Google Cloud Console](https://console.cloud.google.com/)).
3. Set authorized redirect URI in Google to:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. In Supabase → Authentication → URL Configuration, add:
   - Site URL: `http://localhost:3000` (dev) or your Vercel URL (prod)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://your-app.vercel.app/auth/callback`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Update Supabase Auth redirect URLs with your Vercel domain.

> Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to Vercel — it is only needed locally for seeding.

## Project structure

```
app/           # Pages, server actions, and per-route loading.tsx skeletons
components/    # UI components (components/ui/ holds small hand-rolled primitives)
lib/           # Supabase clients, auth, SRS, interview selection, recommendations
data/          # problems.csv (Google 6-month question list)
scripts/       # Database seed script + build helpers
supabase/      # SQL migrations (schema + RLS, dashboard stats RPC)
docs/          # Architecture deep dive (docs/ARCHITECTURE.md)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#project-structure) for a fuller breakdown of what lives where.

## Performance & UX

- **Caching** — the shared problems catalog is cached across requests (`unstable_cache`); auth lookups are deduped per request (React `cache()`); the dashboard uses a single-query Postgres RPC when available.
- **Instant feedback** — status toggles on `/problems` and the "Mark as done" checkbox in mock interviews update the UI immediately (`useOptimistic`) instead of waiting on the server round trip.
- **Skeleton loaders** — every protected route has a `loading.tsx` shaped like its real content, so switching tabs never shows a blank/frozen screen.

Full details and the reasoning behind each choice are in [`docs/ARCHITECTURE.md#recent-improvements`](docs/ARCHITECTURE.md#recent-improvements).

## Data source

Problems are from [interview-company-wise-problems](https://github.com/liquidslr/interview-company-wise-problems/blob/main/Google/3.%20Six%20Months.csv) — Google questions from the last 6 months, sorted by interview frequency.

## Usage tips

1. Mark problems **solved** after completing them on LeetCode — this starts the SRS schedule (review in 1 day).
2. Check **Dashboard → Next up** for high-priority unsolved questions and due reviews.
3. Run a **Mock interview** weekly to simulate real conditions.
4. Do **Review** sessions daily for problems that are due.
