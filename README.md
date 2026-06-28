# Google DSA Interview Prep

Track ~770 Google interview LeetCode questions, run 2-hour mock interviews with 5 problems, and review solved problems with Anki-style spaced repetition.

## Features

- **Progress tracking** — mark problems as attempted/solved, add notes, filter by difficulty/topic/status
- **Dashboard** — coverage stats, topic gaps, and smart "next up" recommendations
- **Mock interview** — 5 problems (1 Easy, 3 Medium, 1 Hard), 2-hour timer, weighted by Google frequency
- **Spaced repetition** — SM-2 algorithm with Again / Hard / Good / Easy ratings
- **Auth** — Google OAuth + email/password via Supabase

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (PostgreSQL, Auth, RLS)
- Vercel (hosting)

## Setup

### 1. Clone and install

```bash
npm install
cp .env.local.example .env.local
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In **SQL Editor**, run the migration at [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql).
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
app/           # Pages and server actions
components/    # UI components
lib/           # Supabase clients, SRS, interview selection, recommendations
data/          # problems.csv (Google 6-month question list)
scripts/       # Database seed script
supabase/      # SQL migration
```

## Data source

Problems are from [interview-company-wise-problems](https://github.com/liquidslr/interview-company-wise-problems/blob/main/Google/3.%20Six%20Months.csv) — Google questions from the last 6 months, sorted by interview frequency.

## Usage tips

1. Mark problems **solved** after completing them on LeetCode — this starts the SRS schedule (review in 1 day).
2. Check **Dashboard → Next up** for high-priority unsolved questions and due reviews.
3. Run a **Mock interview** weekly to simulate real conditions.
4. Do **Review** sessions daily for problems that are due.
