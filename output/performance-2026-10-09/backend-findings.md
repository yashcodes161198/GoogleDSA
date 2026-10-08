# Backend performance investigation — 9 October 2026 IST

This is an investigation, with no application, schema, or hosting-setting changes. Times in JSON files use UTC. Local `.env` selects the in-memory database, so local route measurements do **not** measure Supabase. No service-role requests were made.

## Measurements and limits

| Measurement | Result | Interpretation |
| --- | --- | --- |
| Actual CSV catalog | 681 Medium/Hard problems | Architecture doc's roughly 770 and Easy-inclusive mix are stale |
| Stats derivation, 100 warm samples | median 0.609 ms; p95 0.889 ms | Cheap local CPU for actual catalog with synthetic all-unsolved progress |
| Revision selection, 100 warm samples | median 0.020 ms; p95 0.032 ms | All-unsolved case; not a populated user's queue benchmark |
| Recommendations, 100 warm samples | median 2.116 ms; p95 2.632 ms | CPU unlikely to explain seconds of latency in this scenario |
| CSV parse | first 19.382 ms; warm median 7.569 ms | Local seed and lazy CSV enrichment; enrichment map is process-cached |
| Full library JSON estimate | 329,466 bytes; gzip 55,007 bytes | Synthetic progress; not measured RSC wire size or Supabase response size |
| Anonymous Auth health, 5 sequential GETs | first 940.1 ms; subsequent 228.7–261.6 ms | Laptop-to-Supabase transport/service timing only |
| Anonymous catalog read, 5 sequential GETs | first 889.5 ms; subsequent 150.4–210.2 ms; all `200 []` | RLS prevents catalog visibility; **not an authenticated catalog query benchmark** |

Run `node output/performance-2026-10-09/backend-readonly.mjs` and `node_modules/.bin/tsx output/performance-2026-10-09/backend-cpu.ts` from the repository root to reproduce. Read-only requests have a 15-second timeout. The first sample includes a cold connection and service-cache differences; it does not prove a platform cold start. Five transport samples are not enough for a p95 service estimate.

Authenticated database timing, SQL plans, actual user-row counts, Vercel/Supabase region placement, pool pressure, and account usage remain unmeasured. `.env` has no ordinary user session or direct database connection string. Privileged credentials were not used to work around RLS.

The coordinating agent separately measured the local production build, still using the local memory store: problems-page HTTP completion median 115.6 ms (six warm samples, 66.7–151.1 ms); dashboard median 56.1 ms; revise 20.3 ms; interview 20.9 ms. Problems HTML/RSC was about 815 KB raw / 72.8 KB gzip and referenced JavaScript about 270.9 KB gzip. Browser inspection counted 3,013 elements with 50 rows and 36,712 with all 681, with both desktop/mobile representations mounted. Those observations direct attention to payload and rendering; they cannot establish a production database bottleneck. No authenticated deployed session was available in either browser inspected.

## Source-proven work and latency chains

These are SDK/API operations inferred from source, not observed SQL-query counts. A single PostgREST request/RPC may execute several SQL statements. Next's automatic memoization of identical GETs may reduce duplicates during server rendering. Auth refresh/retries and post-action rendering can add calls.

| Flow | Source-level operations in Supabase mode | Dependency chain |
| --- | --- | --- |
| Problems or revision page | Auth GET, catalog GET, progress GET | Auth, then catalog/progress in parallel |
| Dashboard | Auth; catalog; 2 progress-query builders; stale-session UPDATE; active-session SELECT; stats RPC | Auth; parallel library reads and UPDATE→active SELECT; then stats RPC |
| Interview setup with history | Auth; catalog/progress; stale-session UPDATE→active SELECT; history SELECT→batched summary join SELECT | Independent branches run in parallel after auth |
| Interview session, nonexpired | Auth; session SELECT; session-problems join SELECT; progress SELECT for selected IDs | Four sequential API stages |
| Mark solved | Auth; progress upsert; leaderboard RPC; revalidation-triggered page data | Two sequential DB API calls after auth, plus refresh |
| Mark revision | Auth; atomic revision-increment RPC; leaderboard-award RPC; refreshed page data | Two sequential DB API calls after auth, plus refresh |
| Favorite or save time | Auth; existing-row SELECT; upsert/update/insert; refreshed page data | Read then write after auth |
| Mark interview problem complete, newly solved | Auth; session-problem UPDATE; progress SELECT; progress upsert; award RPC; refreshed page data | Four sequential DB calls after auth |
| End interview with N completed problems | Auth; session UPDATE; completed-row SELECT; N serial progress SELECTs; plus upsert and award for each newly solved problem | N+1-shaped serial loop, 2+N to 2+3N DB API calls excluding auth and refreshed UI |

Default interviews contain five problems. Random/custom configuration permits up to 20. `endInterviewSession` usually finds progress already solved by earlier checkbox updates, but still makes N serial reads. This is a source-proven fanout; its real latency has not been profiled.

Expected API totals before refresh/retries, with an already-valid session: problems/revise = 3 including auth; dashboard = 6 if identical progress GETs deduplicate, otherwise 7; interview setup with history = 7; nonexpired interview detail = 4. They are estimates from code and installed fetch semantics, **not recorded production request counts**. The protected layout can share request-cached auth with the page. RPCs and writes do not receive GET deduplication.

Evidence:

- `lib/auth.ts:9`: request-memoized `getUser`, then `auth.getUser()`.
- `lib/data.ts:70–81`: catalog uses React `cache()`, `select('*')`, and frequency ordering. This cache deduplicates one render, not a browser session.
- `lib/data.ts:115–139`: full catalog and all current-user progress fetched in parallel and merged.
- `app/(protected)/dashboard/page.tsx:24–29` and `lib/data.ts:269`: dashboard asks for the same merged library directly and through revision selection, then awaits the stats RPC afterward.
- `lib/data.ts:234–251`: stats RPC still needs the already-downloaded full list for revision stats; JavaScript fallback already exists.
- `lib/data.ts:312–319`: history uses one batched query for the selected ten sessions, avoiding per-session N+1.
- `lib/data.ts:376–420`: interview detail has three data calls in series.
- `lib/data.ts:443–465`: active-session reads issue a stale-session UPDATE before selecting, even when nothing expires.
- `app/actions.ts:107–123`, `272–298`, `510–535`, `552–569`, `589–616`: sequential action writes, award RPCs, repeated path invalidation, and end-interview serial loop.
- `components/InterviewSessionView.tsx:154–159`: completion waits for timer persistence before starting optimistic completion. A running timer can add a separate server-action read→write→refresh before completion feedback.
- `components/ReviseCard.tsx:240–243`: revision and timer persistence are started together; Next server-action dispatch may serialize them. Actual browser timeline needed.
- `lib/problems-enrich.ts:5–13`: CSV link map initialized once per process.
- `supabase/migrations/001_schema.sql:12–13,30–31,43`: indexes already support frequency order, per-user status/review, and session history. Missing-index claims need plans.

Next 16.2.9 local documentation says identical `fetch` GETs are memoized and uncached data blocks until complete (`06-fetching-data.md:57–59`). Supabase uses global fetch with no explicit signal in these query builders; Next's installed `dedupe-fetch.js:87–119` can therefore deduplicate the dashboard's identical progress GET. Do not claim two actual progress network requests without a trace. The duplicate merge/selection work still exists.

`revalidatePath` in a Server Function updates the current affected UI and currently makes previously visited pages refresh when revisited (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md:16–17`). Four calls do **not** prove four immediate route executions, but this invalidation explains why visited-route reuse can be lost after saves.

## Existing decision and implementation diverge

`docs/adr/0001-session-library.md:3,17–19` accepts one browser-session library, background saves, rollback, and freshness only on fresh open. Current components receive route-fetched data and actions invalidate paths. This accepted decision is not implemented. The report does not silently implement it because the user asked to discuss tradeoffs first.

## Free-plan backend choices to discuss

1. **Remove repeated work while keeping current fresh server rendering.** Derive dashboard stats/queue from its one merged list, skip the redundant stats RPC, memoize the merged loader per request if needed, and combine appropriate read/write chains into transactional RPCs. No extra service. Local stats CPU is under 1 ms here; exact network savings need an authenticated trace. Preserve atomic revisions, row security, error rollback, and points correctness. A new mutation RPC is more SQL to maintain but can improve both atomicity and latency.
2. **Implement the accepted session library.** One authenticated full catalog/progress bootstrap, mounted browser provider, local derivation for routes, optimistic local updates with background persisted saves. Later navigation avoids repeated read/serialization and can reduce free-tier egress. Initial load still pays the fetch; another tab/device or admin catalog changes stay stale until fresh open unless a refresh policy is added. Clear memory on sign-out/account switch. This is a product-freshness decision as much as an optimization.
3. **Separate slow-changing catalog from current user progress.** Cache/version the shared catalog safely; fetch small progress fresh. Avoid globally caching a cookie-bound Supabase client or mixed per-user results. Current RLS requires authenticated catalog reads, and admins can add catalog rows; caching requires an explicit authorization and invalidation design. Next 16 prefers `use cache` with Cache Components; cookies cannot be read inside its scope. Enabling it is a framework change, not a drop-in memoization.
4. **SQL-side filtering/aggregation/pagination.** Reduces full-catalog transfer when catalog/user history grows, while retaining fresh data. Current client filters and global recommendations require a larger list; moving them server-side changes search/navigation semantics and can introduce an API call per filter edit. At 681 rows, first measure transfer/render costs. Add indexes only after representative `EXPLAIN` plans; existing catalog/progress indexes already cover common shapes.
5. **Keep PostgREST rather than adding a pooler rewrite without evidence.** The app talks HTTPS to Supabase API, not `pg` in production; adding Supavisor settings to that code will not reduce existing HTTP waterfall. Direct DB access requires new credentials and recreating the authenticated/RLS context correctly. No measured pool exhaustion supports that complexity.

As checked 9 October 2026, Supabase Free documents 500 MB database, 5 GB egress, 50,000 monthly active users, 1 GB file storage, and 500,000 Edge Function invocations. Quotas do not establish this project's actual usage. The relevant limits here are repeated database egress and small shared compute, not a generic request-count cap. Moving work into Edge Functions adds another hop and consumes a different quota unless it replaces existing hops.

Primary sources:

- [Supabase billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Egress categories and allowances](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Connection endpoints and free/paid differences](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Connection management](https://supabase.com/docs/guides/database/connection-management)
- [Performance tuning](https://supabase.com/docs/guides/platform/performance)

No evidence supports paying for compute, adding Redis, increasing connection pool size, or blindly adding indexes before identifying authenticated latency.
