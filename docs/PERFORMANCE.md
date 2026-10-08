# GoogleDSA performance investigation

Measured 9 October 2026 (Asia/Calcutta). Status: session library verified locally; signed-in production baseline recorded in Brave before deployment. No schema, hosting-plan or production deployment changes.

## Settled and pending decisions

- Settled by the user: prioritize navigation and save feedback. First-open transfer and frontend rendering remain secondary measurements.
- Settled by the user (Q2): refresh progress when the tab regains focus. Another device's changes can remain unseen while the tab stays active; this does not promise live synchronization. Proposed implementation safeguards: deduplicate concurrent refreshes and retain optimistic pending writes while reconciling the response.
- Q3 superseded by user steering: the user initially selected small dashboard cleanup, then clarified that optimizing other pages matters more. Dashboard application changes were reverted before retention; no dashboard optimization is claimed.
- Settled Q4: Problems ↔ Revise navigation with the session library. Interview and dashboard optimization remain deferred. Refresh on focus remains settled.
- Recorded: signed-in production navigation/save readiness with populated progress in Brave. Still unavailable: browser performance/network trace, actual account usage and deployed regions, and representative SQL plans.

The existing untracked `GLOSSARY.md` was preserved. `docs/adr/0001-session-library.md` received an amendment recording refresh on focus, the implementation and the corrected free-plan caching rationale. Its original measured wait has no attached benchmark; this investigation uses the reproducible measurements below. No new domain term was needed.

## Signed-in production baseline before deployment

User requested this baseline now and will request a rerun after deployment. Tested `https://google-dsa.vercel.app` in their signed-in Brave profile on **9 October 2026, 00:43–00:49 IST**, viewport 2175 × 1044. The existing profile/cache was retained; no throttling or cache clearing was applied. The production catalog contains **682** questions, versus 681 in the earlier local fixture. Revise showed ten questions and zero revised today.

Timings use a wall clock around the extension's click/reload and two waits for meaningful content. They include extension, action and locator overhead. They are **not** browser paint, INP, LCP, HTTP, API or SQL timings. Loaded heading/control waits alone took 34–43 ms; same-page click plus readiness controls took 326–364 ms (median 341 ms). No overhead was subtracted. These measurements support a repeatable user-flow comparison in the same tooling, not a comparison with the earlier loopback HTTP numbers.

| Production flow | Samples | Median | Range |
| --- | ---: | ---: | ---: |
| Revise → Problems, useful row visible | 10 | **3.360 s** | 2.847–3.580 s |
| Problems → Revise, queue control visible | 10 | **3.252 s** | 1.805–3.341 s |
| Problems document reload, useful row visible | 5 | 2.510 s | 2.134–2.759 s |
| Revise document reload, queue control visible | 5 | 1.767 s | 1.520–2.023 s |
| Favorite label feedback | 5 retained | 0.443 s | 0.309–1.087 s |
| Favorite save transition settled | 4 complete | **3.093 s** | 2.670–3.849 s |

The initial setup navigations were 3.221 s to Problems and 3.131 s to Revise, reported separately and excluded from the ten-round-trip summary. Reloads used a warm profile and are not clean-browser first visits. Save settlement was detected when the Replace control re-enabled; this includes React transition and route revalidation work and is not the database acknowledgement timestamp.

Functional checks passed for title search, difficulty filtering, 25-row pagination and restoration to 50 rows. Favoriting Minimum Knight Moves persisted across a document reload. Its favorite was restored to its original false value and verified after reload and in Problems search. Its other row text was unchanged. Six reversible favorite writes were made; no solves, revisions, timer values or interviews were changed. There were no observed browser console warnings/errors. Two timing attempts encountered the extension's short locator deadline; one retained feedback only, and one was omitted. Later waits checked actual enabled state and retried bounded readiness waits; there was no observed app failure.

Production Problems mounted **3,041 DOM elements** at 50 rows and **36,863** in All mode at 682 rows. Selecting and inspecting All took 2.213 s through the extension; restoration initially exceeded a three-second command deadline. Fresh DOM inspection confirmed All was rendered, and a CSS-scoped selection restored 50. This establishes large DOM size and an automation stall, not a field INP or proven main-thread duration. All filters and both search/frequency inputs were restored to defaults.

The signed-in navigation wait is now confirmed in production. Browser tooling exposes DOM and console inspection, but its read-only page scope does not expose `performance`; network and database attribution remain unmeasured. Backend call counts and payload reductions from the local experiment must not be presented as production observations. No deployment was performed.

Raw samples and visible script filenames (deployment fingerprint, not a verified Git SHA): `output/performance-2026-10-09/prod-before-brave.json`. Recompute summaries with `node output/performance-2026-10-09/summarize-prod.mjs`. The retained Brave tab is on Problems with default filters. Follow [PRODUCTION_BASELINE.md](PRODUCTION_BASELINE.md) for the later rerun, and preserve these before files.

## Implemented experiment: Problems ↔ Revise

**Keep:** repeat navigation no longer reloads the merged library. Both pages consume one user-scoped in-memory store in the persistent protected layout. The first protected document bootstraps it on the server. Focus or visible-tab return refreshes it through authenticated `GET /api/library` with `private, no-store`. Concurrent refresh events coalesce. Saves update local state immediately and use existing authenticated server actions without route revalidation. Other action callers retain revalidation by default.

Same-condition comparison: production Next builds, same laptop/browser, same 681-question synthetic catalog and populated progress (227 solved, three revised today), same loopback proxy and 100 ms artificial latency per Supabase fetch. Ten Problems → Revise → Problems rounds per build, 20 dynamic navigation responses each, no warmup navigation discarded. The before build had unchanged Problems/Revise/layout code; its temporary dashboard experiment did not participate in this path. No real Supabase writes were made.

| Navigation response | Before median (range) | After median (range) | Before / after body bytes, median |
| --- | ---: | ---: | ---: |
| To Problems | 275.6 ms (252.2–289.8) | 16.6 ms (7.9–63.5) | 60,212 / 955 B |
| To Revise | 245.4 ms (234.8–257.7) | 18.3 ms (9.7–65.9) | 2,835 / 1,159 B |

Across all 20 requests, intercepted backend fetches fell **60 → 0** and observed response-body bytes **630,464 → 21,136** (96.6% lower). Overall median HTTP completion was **255.4 → 16.6 ms** (93.5% lower); the slowest after sample was faster than the fastest before sample. These are proxy request-to-body-completion timings and transferred body sizes, excluding headers/assets; they are **not** browser click-to-paint, INP, SQL duration, or live Vercel latency. Small RSC shell requests still occur on navigation.

The first protected open still makes three backend fetches: auth, catalog and private progress (the latter two overlap). Single cold Problems document samples were 79,449 B / 742 ms before and 79,054 B / 980 ms after. Those cold timings were not repeated and cannot establish an initial-load improvement or regression. A fresh open directly on Revise, Interview or Leaderboard now also bootstraps the complete library: extra initial transfer is a deliberate cost of keeping shared state in the protected layout. Server rendering bootstraps this implementation; it supersedes the ADR's original background-load wording. Lazy bootstrap or a narrower shared layout would be a separate first-open experiment.

Correctness evidence:

- Store tests cover refresh/write overlap before and after durable save, refresh coalescing, field rollback with queued work, canonical revision count, fresh-solve 48-hour eligibility, saved times, failed refresh retention, user mismatch and late completion after sign-out.
- Browser fixture: started Top K Frequent Elements timer, favorited it, marked it revised, then navigated to Problems. Favorite, one revision and saved best time were present there. The three save responses were 96–113 B, with no library reread or page render; durable saves still took 337–380 ms under the injected delay. Feedback is optimistic, not a claim that the database write became instantaneous. Browser console had no warnings/errors during this flow.
- HTTP checks: unauthenticated refresh returns 401; authenticated refresh returns the correct user and 681 questions; both responses disable shared caching. An injected failed progress read returns 503 instead of a false unsolved library. Refresh currently performs two auth lookups plus catalog/progress reads: React request memoization does not deduplicate auth in the Route Handler, unlike the page render. This focus-only overhead remains a possible follow-up.
- Existing revision, interview, admin and leaderboard suites passed; new `npm run test:session-library`, TypeScript production build and ESLint passed (one existing unused-variable warning in `scripts/seed-problems.ts`).

Limitations: focus-event reconciliation is covered at the store level and listener wiring was inspected; no multi-device browser run or signed-in production trace was available. Session state is not persisted to disk. Saves remain authenticated and RLS-protected. Sign-out/account change clears it. Failed operations roll back only their local transformation; failed refreshes retain usable data and show retry. Pending operations are replayed over refresh results; completed writes newer than a refresh are retained until the next refresh. Revision rows keep their IDs during refresh; saved timer values are shared, while a running timer remains page-local. Other pages still use server data, and their writes reach the practice library on focus/fresh open. Admin question creation explicitly refreshes it.

Reproduction artifacts: `output/performance-2026-10-09/practice-{before,after}-{http,backend}.jsonl`, `practice-comparison.json`, `summarize-practice.mjs`, `practice-proxy.mjs`, `supabase-fixture.mjs`, `verify-library-http.mjs`. Start a production build with local flags false, preload the fixture into a loopback-only Next server on 3100, and run the proxy on 3101. Set `PERF_FIXTURE_LOG`, `PERF_PROXY_LOG` and `PERF_FIXTURE_DELAY_MS=100`. The fixture blocks external fetches and mutates only process memory; never deploy it. Use the browser's navigation links for ten round trips, then run the summary script. Raw logs retain the later correctness actions, which the summary excludes by selecting the first 20 navigation responses.

### Dashboard experiment set aside

Before the user's priority correction, a loopback production build was measured with an isolated authenticated Supabase transport fixture: 681 library questions, 227 solved, 114 due reviews, three revised today, 100 ms artificial delay per backend call, three warmups and 20 measured requests. Baseline median was 463 ms (453–489 ms), with six actual intercepted backend fetches per request. Identical progress GETs were deduplicated by Next; the stats RPC was one additional sequential operation. This measures a controlled fixture, not live production.

The proposed source changes reused the loaded library for stats/queue. They compiled, but were reverted after the user deprioritized dashboard optimization. No dashboard after-performance result or keep verdict exists. Scratch harnesses and baseline artifacts remain under `output/performance-2026-10-09/`; `verify-dashboard.ts` expects an after result and was not run. The final build uses current source. Progress-read failures now propagate for the session refresh path, preventing failed reads from turning every question into unsolved state.

## Reproducible baseline

Read installed Next 16.2.9 documentation before investigation. Built using `node node_modules/next/dist/bin/next build` with both local-mode environment flags false, then ran `next start` on `127.0.0.1:3100` with both flags true. This preserves dynamic production routes while runtime data comes from the isolated in-memory store. It measures production rendering and serialization without Supabase latency. The build passed compilation and TypeScript checks. No package installation or dependency changes.

Run from the repository root:

```powershell
$env:USE_LOCAL_DB='false'
$env:NEXT_PUBLIC_USE_LOCAL_DB='false'
node node_modules/next/dist/bin/next build
$env:USE_LOCAL_DB='true'
$env:NEXT_PUBLIC_USE_LOCAL_DB='true'
node node_modules/next/dist/bin/next start -p 3100 -H 127.0.0.1
# In another terminal:
node output/performance-2026-10-09/http-baseline.mjs
node output/performance-2026-10-09/backend-readonly.mjs
node_modules/.bin/tsx output/performance-2026-10-09/backend-cpu.ts
```

HTTP benchmark: seven sequential full-document requests per route, first reported separately; six warm samples. Warm medians use the upper middle sample. `headersMs` is elapsed time until fetch exposes response headers, including client scheduling; it is not a precise browser TTFB. No throttling, concurrent load, or authenticated production session. Compression figures use local gzip estimates and exclude headers, fonts, and image assets; they are not observed network transfer sizes. Full-document HTML includes embedded RSC data and differs from client-navigation RSC responses.

| Local route | First response total | Warm median total | Warm min–max | HTML + embedded data | Estimated gzip | Referenced JS, estimated gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dashboard | 468 ms | 56 ms | 43–78 ms | 59,375 B | 8,459 B | 265,030 B |
| Problems | 173 ms | 116 ms | 67–151 ms | 815,172 B | 72,760 B | 270,889 B |
| Revise | 35 ms | 20 ms | 16–23 ms | 24,207 B | 4,643 B | 271,513 B |
| Interview setup | 33 ms | 21 ms | 17–24 ms | 104,852 B | 30,876 B | 268,222 B |

The first request to each route is not an independent process cold start. Referenced JS sums unique initial script sources per route, includes shared framework/auth chunks, and excludes dynamically loaded chunks. It is an initial-load cost; cached chunks need not download on each navigation. Referenced CSS estimates are about 10.8–11.0 KB gzip.

Browser inspection of the local production build showed 681 library questions, initially showing 50. There were 3,013 DOM elements and 50 desktop table rows. Both mobile cards and desktop rows are mounted, although CSS hides one tree. Selecting All produced 36,712 DOM elements and 681 desktop rows. The selector was restored to 50. These are structural counts, not measured layout, hydration, INP, or scrolling latency.

Local CPU with 681 actual CSV questions and synthetic all-unsolved progress, 100 warm samples:

| Work | Median | p95 |
| --- | ---: | ---: |
| Dashboard stats | 0.609 ms | 0.889 ms |
| Revision selection | 0.020 ms | 0.032 ms |
| Recommendations | 2.116 ms | 2.632 ms |

The revision measurement is the all-unsolved case, not a populated user's queue. Full merged library JSON was 329,466 B / 55,007 B gzip; it is not the Supabase response or RSC wire payload.

Production unauthenticated HTTP results: `/login` warm median 272 ms (257–363 ms); `/problems` redirected to login, median 575 ms (550–615 ms) including redirect. Neither measures the signed-in problems page. Anonymous Supabase health warm responses took 229–262 ms; protected library reads returned `[]` under RLS in 150–210 ms. These are laptop-to-service probes, not Vercel-to-DB timings or slow-query evidence. No privileged credential was used to bypass row security.

Browser tooling exposed DOM inspection but not Performance entries. LCP, INP, CLS, browser main-thread traces, signed-in navigation/action timing, and database query time remain unmeasured. No production performance percentile is claimed from these small samples.

Raw results, harnesses, and detailed backend call graph are in `output/performance-2026-10-09/`. Turbopack's built-in `next experimental-analyze --output` also completed successfully; the module analysis lives in `.next/diagnostics/analyze` and can be regenerated without installing an analyzer package.

## What the original baseline supports

1. **Library transfer and duplicated UI are concrete costs.** `components/ProblemTable.tsx` paginates rendering after receiving the entire merged library; 50 displayed rows do not mean 50 fetched questions. Both responsive layouts render. The measured response and DOM sizes justify investigating narrower client data and a shared row layout. They do not prove a poor field INP.
2. **Navigation repeatedly depends on backend data.** `lib/data.ts` caches the library only within a React request. `getProblemsWithProgress` still merges full library and private progress for route renders. Next's router can reuse some state/prefetch shells; dynamic pages still need server data. Saves call `revalidatePath`, whose installed Next documentation says affected current UI updates and previously visited routes currently refresh when revisited. Multiple invalidations do not mean every named route immediately executes.
3. **Dashboard does avoidable server work.** It loads a full library for recommendations and revision, then awaits the stats RPC after the parallel work. Local aggregation costs under 1 ms in this baseline. Queue selection also invokes the merged loader; identical GETs may be deduplicated by Next, so two source calls do not prove two network requests. Removing the RPC is a testable candidate, subject to stats parity for a populated user.
4. **A timer save delays optimistic interview feedback.** `components/InterviewSessionView.tsx` awaits `stopAndPersist` before `toggleComplete`. This is a source-proven ordering issue. Need a real running-timer action trace to quantify its impact. Timer persistence and completion must retain agreed failure semantics if combined or reordered.
5. **Interview completion has serial backend fanout.** `endInterviewSession` in `app/actions.ts` reads progress once per completed question in sequence. It performs 2+N to 2+3N data API operations, excluding auth, retries, and page refresh, depending on whether progress is already solved. A transactional batch/RPC could reduce network stages while preserving ownership and points rules.
6. **No evidence currently justifies CPU upgrades, more connection pooling, or speculative indexes.** Production uses Supabase's HTTPS API. Adding a Postgres pooler setting does not optimize those calls. Relevant indexes already exist; representative plans are required before adding others. Local CPU numbers favor investigating transport and work duplication first, while real DB cost remains unknown.

Authenticated GETs for Dashboard and Interview are not entirely read-only: `getActiveInterviewSession` updates stale interview sessions before selecting an active session. Keep that behavior in mind when capturing a live baseline. Production progress/points mutations were not performed during this investigation.

## Options and tradeoffs within the existing free plans

Repository docs describe Vercel Hobby and Supabase Free; actual account plans, remaining quotas, and region placement were not verified in provider dashboards. The following describes documented plan capabilities, not this account's current usage.

| Option | Expected benefit | Tradeoff / condition |
| --- | --- | --- |
| Remove redundant stats work; reuse one library result per request | Fewer backend stages with a small change | Does not eliminate route round trips or full library transfer; prove stats parity and measured improvement |
| Browser session library with optimistic local state | Reuses downloads and shared state across routes; potentially biggest repeat-navigation improvement | First open still downloads library; requires user-scoped reset, pending-write reconciliation, rollback and a freshness policy; server pages must actually consume that state rather than keep refetching |
| Cache shared library server-side; fetch private progress fresh | Reduces Supabase reads/egress while keeping private state fresh | Browser/Vercel/auth/progress round trips remain; isolate cookie-dependent authorization, define TTL/version and invalidate admin additions |
| One responsive row tree / later virtualization | Reduces mounted DOM; relevant to All mode | Can affect responsive/accessibility behavior; virtualization does not reduce fetched bytes and adds keyboard/focus/scroll complexity |
| Reduce client props and split rarely used client code | Smaller serialization and initial JS | Must inspect module trace before attributing cost to a package; extra lazy-load latency for that feature |
| Atomic mutation RPCs and batch interview completion | Fewer server-to-DB trips, clearer atomicity | More SQL/migration maintenance; preserve RLS, ownership, retries, revision counts and idempotent points |
| Colocate Vercel function and Supabase DB | Potentially lower RTT on every sequential data operation | Verify both actual regions first; visitor-nearest region can be worse for DB access; no regional benefit measured yet |
| Server filtering and pagination | Smaller first download and less egress as library grows | Existing whole-library search, recommendations and revision selection must remain complete; interactive filters add requests |

The user chose refresh on focus and the session library to target repeat navigation. The remaining options can be combined later, with separate before/after measurements. No paid cache, polling, new dependency or database migration was needed for this experiment.

### Verified plan constraints

- **Vercel Hobby:** current docs list 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, one million CDN requests, one million function invocations, four active CPU-hours, and 360 GB-hours provisioned memory. Runtime log retention is one hour. Quotas are separate resource budgets, not a promise that every combination fits. [Hobby](https://vercel.com/docs/plans/hobby)
- **Server caching is available on Hobby.** Data Cache and Runtime Cache support all plans. They have regional behavior and a 2 MB item limit. Runtime Cache is ephemeral/LRU; Hobby projects share the team's cache. Cache operations and ISR have metering; verify current usage rather than assuming unbounded free capacity. Personalized merged HTML/data must not enter a global cache. [Data Cache](https://vercel.com/docs/caching/runtime-cache/data-cache), [Runtime Cache](https://vercel.com/docs/caching/runtime-cache), [ISR pricing](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing)
- **One function region can be selected on Hobby.** New projects default to `iad1`; that is not evidence of this deployment's region. [Function regions](https://vercel.com/docs/functions/configuring-functions/region)
- **Supabase Free:** 500 MB database, shared CPU/500 MB RAM, 50,000 MAU and 1 GB Storage. Egress is 5 GB uncached plus a separate 5 GB cached allowance; PostgREST/database egress does not automatically use Storage CDN cached allowance. Repeated library refetches consume the uncached budget. [Pricing](https://supabase.com/pricing), [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- **Supabase Free projects can pause after insufficient activity over seven days.** A cache cannot fix unavailable backend writes. [Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- **Free monitoring:** Supabase reports and inspection/query tools can establish resource use and plans. Vercel's current free Speed Insights tier has 10,000 events over a rolling 30 days and RES with limited breakdowns; detailed individual CWV dashboards require Plus. A lightweight, sampled `web-vitals` endpoint is an alternative, with its own implementation, data-retention and quota costs. [Reports](https://supabase.com/docs/guides/observability/reports), [Inspection](https://supabase.com/docs/guides/observability/inspect), [Speed Insights pricing](https://vercel.com/docs/speed-insights/limits-and-pricing)

### Next 16 constraints

The current configuration does not enable Cache Components. Cookies cannot be read inside a cache scope; wrapping the authenticated `createClient` loader wholesale would be incorrect. Installed docs mark `unstable_cache` as superseded by `use cache`, while `fetch` Data Cache remains supported without globally enabling Cache Components. A broad cache migration is not a prerequisite for testing a narrow shared-data cache.

Relevant installed guides: production checklist, package bundling, prefetching, caching without Cache Components, `use cache`, `use cache: remote`, and `revalidatePath` under `node_modules/next/dist/docs/01-app/`.

## Remaining production validation

After deployment is separately authorized, capture a signed-in production baseline with realistic progress and a running timer. Capture navigation-to-useful-content, click-to-visible-feedback, durable-save completion, server-action payload size, API stage timings and SQL execution separately. Short local samples are not a p95 production SLA.

For each further experiment, record baseline, result, noise, correctness checks and keep/revert decision here. Preserve rollback, user isolation, revision eligibility/counts, favorites, timers and leaderboard points. The local session-library result above passes this contract; real user performance remains to be validated.
