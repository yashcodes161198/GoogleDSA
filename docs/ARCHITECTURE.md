# Google DSA Prep — architecture & tech deep dive

A Next.js 16 app that tracks ~770 Google interview questions, runs 2-hour mock interviews, and reviews solved problems with SM-2 spaced repetition. This doc explains how it works, what each service does, and why the stack was chosen — plain enough for a junior developer, with deep dives for a senior one.

> An interactive version of this doc (with a request-flow diagram) is available as a [Cursor Canvas](https://cursor.com) for anyone working in this repo with Cursor — ask the agent to open `google-dsa-architecture.canvas.tsx`. This file is the portable, git-native copy.

**Stack:** Next.js 16.2.9 · React 19 · TypeScript · Tailwind v4 · Supabase · Vercel

**At a glance:** ~770 Google questions tracked · 1 Easy / 3 Medium / 1 Hard per mock interview · SM-2 spaced repetition · 4 RLS-protected tables

## Table of contents

1. [What the app does](#what-the-app-does)
2. [Tech stack](#tech-stack)
3. [How a request flows](#how-a-request-flows)
4. [The role of Vercel](#the-role-of-vercel)
5. [The role of Supabase](#the-role-of-supabase)
6. [Why these choices](#why-these-choices)
7. [Key data flows](#key-data-flows)
8. [Project structure](#project-structure)
9. [Recent improvements](#recent-improvements)
10. [Concepts a junior should take away](#concepts-a-junior-should-take-away)
11. [Local vs production at a glance](#local-vs-production-at-a-glance)

## What the app does

Five features over four protected pages, all behind Supabase auth:

| Page | Feature | How it's built |
|---|---|---|
| `/dashboard` | Stats, topic coverage, smart next-up | Single fetch feeds `getDashboardStats()` (Postgres RPC or JS fallback) + `getNextProblems()` |
| `/problems` | Browse / filter, mark status (optimistic), paginated | Server Component + Server Actions; `useOptimistic` flips status instantly |
| `/review` | Due SM-2 reviews with Again / Hard / Good / Easy | `getDueReviews()` + `submitReview()` action applies SM-2 |
| `/interview` | 2-hour mock: 5 problems, timer, optimistic Mark-as-done | `startInterviewSession()` selects + persists; `/interview/[sessionId]` runs it |

## Tech stack

Each layer was picked to minimize moving parts — one framework, one data/auth product, one host.

| Layer | Choice | Role in this project |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Routes, Server Components, Route Handlers, Server Actions — renders HTML on the server |
| Language | TypeScript | Shared types (`lib/types.ts`) across client and server |
| Styling / UI | Tailwind CSS v4 + lucide-react | Utility classes + icons; a few hand-rolled primitives in `components/ui` |
| Database + Auth | Supabase (Postgres + Auth + RLS) | Stores problems, per-user progress, sessions; email + Google login; row-level isolation |
| Hosting | Vercel | Builds, deploys, serves at the edge, preview URLs per push |
| Data seeding | tsx + dotenv script | `scripts/seed-problems.ts` loads `data/problems.csv` with the service role key |
| Runtime | Node 22.x (pinned via `engines`) | Vercel build + server runtime version |
| Caching | Next.js Data Cache (`unstable_cache`) + React `cache()` | Shared problems catalog cached across requests; auth deduped per request |

## How a request flows

Protected routes render dynamically because they read the session cookie on every request — not because of a blanket `force-dynamic`. That flag used to sit on the root layout and disabled Next's Data Cache app-wide; it was removed so `unstable_cache` can actually cache the shared, read-only problems catalog across requests.

```
Browser
  │
  ▼
Vercel Edge          (CDN, routing, static cache)
  │
  ▼
Next.js (server)     (Server Components · Actions · Route Handlers)
  │                 │
  ▼                 ▼
Supabase Auth     Supabase Postgres
(session cookies, (problems · progress ·
 Google OAuth)     sessions)
```

The server component reads the session cookie via Supabase Auth (deduped with React `cache()`), reads the problems catalog from the Data Cache instead of Postgres when warm, queries per-user rows fresh (filtered by RLS), and streams HTML back the same path. Client components hydrate only the interactive bits (forms, buttons, checkboxes).

## The role of Vercel

Vercel is the build pipeline, the runtime, and the CDN — three jobs in one, with zero config for Next.js.

Builds the app (`next build` via Turbopack), turns each route into a serverless function, serves static assets from the edge, gives every push a preview URL, and production-serves the main branch. No servers to manage, no Docker, no Nginx.

<details>
<summary>Lesson learned: the build cache + routing manifest saga</summary>

The 404 we fought early on came from Vercel-side state, not the code:

1. **Stale build cache** — Vercel restored a build cache from an old middleware (`proxy.ts`) version, breaking `next build`. Fixed by pinning `engines.node` to `22.x` (which forced a cache skip) and adding a `prebuild` step (`scripts/clean.mjs`) that wipes `.next`.
2. **Corrupted routing manifest** — a known Next.js 16 + Vercel issue: a green build but sitewide `404: NOT_FOUND`. Fixed by deleting and re-importing the Vercel project fresh from GitHub.
3. **OAuth redirect to localhost** — Supabase fell back to the Site URL because the Vercel callback wasn't in the allowlist. Fixed by setting the Site URL to the production domain and adding `https://google-dsa.vercel.app/auth/callback` to Redirect URLs.

</details>

## The role of Supabase

One product gives a Postgres database, an auth system, and row-level security — so the app skips a custom API layer entirely.

**Database.** Four tables hold the question catalog and all per-user state. The client/server SDK runs SQL directly; no REST layer to write.

**Authentication.** Email/password and Google OAuth. Sessions live in HTTP-only cookies managed by `@supabase/ssr`; the server client reads them on every request.

### Schema

| Table | Purpose | Key columns |
|---|---|---|
| `problems` | Shared catalog of ~770 Google questions (read-only) | `slug, title, difficulty, frequency, acceptance_rate, link, topics[]` |
| `user_problems` | Per-user progress + SM-2 state | `user_id, problem_id, status, ease_factor, interval_days, repetitions, next_review_at` |
| `interview_sessions` | A single mock interview (2h window) | `id, user_id, started_at, ends_at, status` |
| `interview_session_problems` | The 5 problems chosen for a session | `session_id, problem_id, position (1–5), completed` |

<details>
<summary>Row Level Security policies (senior)</summary>

RLS is enabled on every table, so even if the client SDK runs a query, Postgres itself filters rows to the authenticated user:

| Table | Policy | Rule |
|---|---|---|
| `problems` | Authenticated read | `SELECT TO authenticated USING (true)` — shared catalog, read-only |
| `user_problems` | Own rows, all ops | `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| `interview_sessions` | Own rows, all ops | `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| `interview_session_problems` | Via owning session | `EXISTS (SELECT 1 FROM interview_sessions WHERE id = session_id AND user_id = auth.uid())` |

The composite primary keys (`user_id, problem_id`) and (`session_id, problem_id`) plus `ON DELETE CASCADE` keep per-user data consistent when a user or session is removed.

</details>

## Why these choices

**Why Next.js App Router.** Server Components fetch data with the user's cookies and render HTML on the server — no client-side fetch waterfall, no auth token in JS bundles. Server Actions mutate data in one round trip. Route groups (`(auth)` vs `(protected)`) cleanly separate public and auth-gated layouts.

**Why Supabase.** Postgres + Auth + RLS in one product means the database enforces "you only see your own rows" — the app never hand-rolls authorization. The `@supabase/ssr` cookie helpers make server-side sessions a few lines. The free tier covers a project this size.

**Why Vercel.** It's Next.js's maker's platform: zero-config build + RSC runtime, edge CDN, and a preview URL per push for free. The tradeoff — Vercel-specific build-cache and routing state — is what bit us early on, and is intrinsic to any managed Next.js host.

## Key data flows

### Google OAuth redirect flow

1. **User clicks "Continue with Google"** — on `/login`, the client calls `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: \`${window.location.origin}/auth/callback\` })`. This redirects the browser to Supabase Auth.
2. **Supabase Auth redirects to Google** — Supabase sends the user to Google's consent screen. The redirect target must be in Supabase's Redirect URLs allowlist, or Supabase falls back to the Site URL (the classic localhost-redirect bug).
3. **Google authenticates and returns to Supabase** — Google redirects back to Supabase's callback (`https://<project-ref>.supabase.co/auth/v1/callback`), which exchanges the Google code for a Supabase session.
4. **Supabase redirects to the app's `/auth/callback`** — with `?code=...` appended: `https://<your-vercel-url>/auth/callback?code=...`.
5. **Next.js route handler exchanges the code** — `app/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`, which sets the auth cookies, then redirects to `/dashboard`.
6. **Protected routes read the cookie** — every subsequent request to a `(protected)` route uses the server Supabase client (cookie-based) to call `auth.getUser()`; `requireUser()` redirects to `/login` if there is no session.

<details>
<summary>SM-2 spaced repetition (senior)</summary>

When a problem is marked solved, `initialSrsOnSolve()` seeds `ease_factor = 2.5`, `interval = 1 day`, `repetitions = 0`. Each review calls `applyReview()` in `lib/srs/sm2.ts`:

| Rating | Effect on interval | Effect on ease |
|---|---|---|
| again | reset to 1 day, repetitions = 0 | ease − 0.2 (floor 1.3) |
| hard | interval × 1.2 | ease − 0.15 (floor 1.3) |
| good | 1 → 6 → interval × ease (classic SM-2) | unchanged |
| easy | interval × ease × 1.3 | ease + 0.15 |

`next_review_at = now + interval_days` is stored on `user_problems` and indexed, so `getDueReviews()` is a cheap filter + sort per user.

</details>

<details>
<summary>Mock interview problem selection (senior)</summary>

`selectInterviewProblems()` builds a 1 Easy / 3 Medium / 1 Hard set that's both high-frequency and topically diverse:

1. **Sort the pool** — unsolved first, then earliest review-due, then by Google frequency.
2. **Bucket by difficulty** and fill the target mix from each bucket.
3. **Diversify** — within a bucket, take the top 15 candidates, re-rank by least topic overlap with already-selected problems, keep the top 5.
4. **Weighted random pick** from those 5, weighted by `frequency` — so high-frequency questions come up more often, but no two interviews are identical.

Remaining slots (if a bucket ran dry) are backfilled by a weighted-random pick across the whole pool.

</details>

<details>
<summary>Recommendations engine (senior)</summary>

`getNextProblems()` returns a prioritized list (lower priority = shown first) for the dashboard's "Next up" widget:

| Priority | Source | Reason shown to user |
|---|---|---|
| 1 | Due SM-2 reviews | "Due for spaced repetition review" |
| 2 | Unsolved, frequency ≥ 60% | "High Google frequency (n.n%)" |
| 3 | Weakest topics (lowest solved ratio) | "Topic gap: `<topic>`" |
| 4 | Unsolved mediums by frequency | "Common medium-difficulty Google question" |

`estimateDaysToFinish()` divides remaining problems by a 3/day pace for the "X days to finish" estimate.

</details>

## Project structure

```
app/                      # Routes (App Router)
  (auth)/                 # /login, /signup
  (protected)/            # /dashboard, /problems, /review, /interview(+[sessionId])
                           # each has its own loading.tsx skeleton
  auth/callback/route.ts  # exchanges the OAuth code
  actions.ts              # Server Actions
  layout.tsx              # root layout (fonts; no force-dynamic)

components/                # UI (AppShell, AppNav, AuthForm, tables, widgets)
  ui/                       # small hand-rolled primitives — button, card, input,
                             # badge, skeleton, checkbox, tooltip

lib/
  supabase/                # server + browser Supabase clients (server client
                             # wrapped in React cache())
  auth.ts                  # getUser()/requireUser(), also cache()-wrapped
  data.ts                  # all Supabase queries + the problems-catalog cache
  srs/sm2.ts                # spaced repetition algorithm
  interview/selectProblems.ts
  recommendations/nextProblems.ts
  types.ts

data/problems.csv          # ~770-question source (Google, last 6 months, by frequency)
scripts/                   # seed-problems.ts, free-port.mjs, clean.mjs (prebuild)
supabase/migrations/       # 001_schema.sql (tables + RLS),
                             # 002_dashboard_stats.sql (get_user_dashboard_stats RPC)
```

## Recent improvements

Two focused passes: first cut server round-trips per click, then polished the interactions so the UI feels instant even while those round-trips run in the background.

### Performance

| Change | Before | After |
|---|---|---|
| Auth lookups | `auth.getUser()` called ~3× per request (layout + data helpers) | Wrapped in React `cache()` — one call per request, shared everywhere |
| Problems catalog | Refetched all ~770 rows from Postgres on every page load | Cached via `unstable_cache` (tag: `problems-catalog`); only per-user rows fetched fresh |
| Dashboard | Two separate `getProblemsWithProgress()` calls (stats + recommendations) | One fetch reused for both; stats also has a single-query Postgres RPC with a JS fallback |
| Root layout caching | `force-dynamic` on the root layout disabled the Data Cache app-wide | Removed — routes still render dynamically (cookie-based auth) but `unstable_cache` now works |

`supabase/migrations/002_dashboard_stats.sql` adds `get_user_dashboard_stats(user_id)` — one query aggregates totals, per-difficulty counts, reviews due, and weakest-topic coverage in Postgres instead of shipping ~770 rows to JS for aggregation.

### UX polish

- **Skeleton loaders, per route.** Every protected route (`dashboard`, `problems`, `review`, `interview`, `interview/[sessionId]`) has its own `loading.tsx` shaped like its real content, so switching tabs shows an instant skeleton instead of a frozen screen during the fetch. Page-level — not per-widget — Suspense was the deliberate choice: after the caching work above, one query dominates each page's load time, so splitting into independently streaming widgets would add complexity without a visible benefit.
- **Optimistic UI.** Both the status buttons in `/problems` (`useOptimistic` in `ProblemTable`) and the interview "Mark as done" checkbox (`useOptimistic` in `InterviewSessionView`) flip instantly on click; the Server Action confirms and revalidates in the background instead of blocking the click for a full round trip.
- **Table & layout cleanup.** `/problems` rows are single-line now (the per-problem notes input was removed); the status pill has a fixed width so toggling status no longer shifts the column; pagination gained an adjustable rows-per-page control (25 / 50 / 100 / All).
- **New UI primitives.** `components/ui/checkbox.tsx` and `tooltip.tsx` — a bigger custom checkbox (24px, emerald check) with an accessible hover/focus tooltip, both dependency-free and following the project's existing "small custom `ui/` component" convention rather than pulling in a component library.
- **Interview session summaries.** The recent-sessions list on `/interview` shows a per-difficulty solved breakdown (e.g. `E 1/1 · M 2/3 · H 0/1`) inline on the same single line as the date and status.

## Concepts a junior should take away

**Server vs Client Components.** Files are Server Components by default — they can be `async`, fetch data, and never ship that data-fetching code to the browser. Add `"use client"` only for interactivity (`onClick`, `useState`, forms). `AuthForm` and `AppNav` are client; the pages and layouts are server.

**Row Level Security in one line.** RLS = Postgres policies that silently filter query results to the authenticated user. The app queries `user_problems` without a `where user_id = ?` — the database adds it for you, enforced.

**Server Actions.** An `async` function in a `"use server"` file that the client can call like a normal function. It runs on the server, can use the cookie-based Supabase client, and `revalidatePath()`/`revalidateTag()` refreshes cached routes/data. No manual REST endpoint needed.

**`NEXT_PUBLIC_` vs server env vars.** `NEXT_PUBLIC_*` is baked into the client bundle at build time (the Supabase URL + anon key — safe to expose). Server-only vars (the service role key) never reach the browser. In this project, envs live in the Vercel dashboard, not git.

## Local vs production at a glance

| Concern | Local | Production (Vercel) |
|---|---|---|
| Env vars | `.env.local` (gitignored) | Vercel dashboard, scoped to Production + Preview |
| Auth redirect URLs | `http://localhost:3000/auth/callback` | `https://google-dsa.vercel.app/auth/callback` |
| Build cache | none (fresh each time) | restored across deploys — `prebuild` wipes it here |
| Node version | whatever you run | pinned to `22.x` via `package.json` `engines` |
| Service role key | needed for `npm run seed` | never deployed — seeding is local only |

---

Source: the live repository — `app/`, `lib/`, `components/`, `supabase/migrations/`, and `package.json`.
