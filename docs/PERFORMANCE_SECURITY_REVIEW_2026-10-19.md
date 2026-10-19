# Performance and security review — 19 October 2026

The immediate priority is credential containment: the tracked environment example contains a JWT labeled `service_role`. Next, patch vulnerable dependencies and move scoring and discussion invariants into database-enforced boundaries. Performance work should then bound discussion/history reads and reduce the full-library cost of opening unrelated pages.

This is a repository-wide review and ranked implementation plan, with isolated reproductions and a local production-build baseline. It is not a certification of the deployed service. The original review made no application or migration changes; subsequent remediation is tracked below. The pre-existing change to `data/problems.csv` was preserved and is included in the local measurement dataset.

## Implementation progress

Work proceeds one issue at a time in ranked order. Credential rotation is excluded at the user's request. Findings and baseline measurements below describe the original review unless a resolution is recorded here.

| Issue | Status | Result / next step |
|---|---|---|
| S01 — exposed credential | Deferred by user | Credential unchanged; risk remains unresolved. |
| S02 — vulnerable dependencies | Implemented and locally verified; deployment pending | Next/lint config upgraded to 16.4.2; production audit **6 → 0**. Full audit **15 → 5**, with one unpatched development-only chain documented below. |
| S03 — fabricated awards | Implemented; grouped local checks passed; rollout pending | Migration 020 makes progress and awards atomic, revokes direct progress writes/award RPCs, retains private award identities after visible deletion, and accepts retry IDs. Application and interview callers use the trusted boundary. |
| S04 — comment timestamps | Implemented; grouped local checks passed; rollout pending | Migration 021 repairs nonfinite legacy timestamps, constrains timestamps and insert columns, and assigns creation time in a trigger. Defensive date rendering uses a safe fallback. |
| S05 — upload/comment abuse | Implemented; grouped local checks passed; hosted Storage/cleanup rollout pending | Migration 022 reserves 100 objects/50 MiB per account, limits uploads/posts, and removes direct client upload/delete policies. Only server-validated, decoded/re-encoded images are published. Cleanup command added. |
| R01 — picked interviews | Implemented; grouped local checks passed; rollout pending | Migration 023 permits positive positions, preserves distinct question order, and replaces multi-request creation with one user-locked, retry-aware transaction. Random selection retains its 20-question cap. |
| S06 — hosted local-mode bypass | Implemented; grouped local checks passed; hosted smoke test pending | The public flag cannot enable bypass; either flag fails config loading on hosted platforms and ordinary production. Explicit loopback test launcher added. |
| R02 — mutation races/partial saves | Implemented; grouped local checks passed; multi-connection staging checks pending | Field-specific progress changes use migration 020's transaction and canonical results; owned interview completion/finish use atomic RPCs. Session creation is atomic under migration 023. |
| P06 — upload transport limit | Quick fix implemented; hosted near-limit verification pending | Shared file limit reduced to 3 MiB, action-body limit to 4 MiB, and Storage bucket limit to 3 MiB. |
| S07–S08, P01–P05, P07, Q01 | Pending | Next ranked issue is P01. Retain the implementation and acceptance criteria below. |

### S02 resolution — 19 October 2026

- Updated `next` and matching `eslint-config-next` from 16.2.9 to **16.4.2**, following the [upstream release](https://github.com/vercel/next.js/releases/tag/v16.4.2) and installed version-matched upgrade/security docs. Updated the lockfile's compatible vulnerable dependencies without forcing a major upgrade or lint-config downgrade. Current stack references in `PRODUCT.md` and `docs/ARCHITECTURE.md` match the installed version; historical baseline versions below are retained.
- The lockfile now includes patched Sharp 0.35.5, Next's PostCSS 8.5.23, root PostCSS 8.5.31, source-map-js 1.2.2, nanoid 3.3.20, js-yaml 4.3.2, brace-expansion 1.1.21/5.0.12 and browser-mapping/browser-list updates. Compatible Tailwind packages moved from 4.3.1 to 4.3.3. React and Supabase dependencies were not changed.
- `npm audit --omit=dev` reports **zero vulnerabilities**. Full audit reports **five high package entries**, all from `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. These are one underlying advisory propagated through its parents, not five separate flaws.
- **Open upstream residual:** [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no patched braces release at verification time. The installed registry release remains 3.0.3. In this tree it is used only by the linter to process configured root-directory globs; the project does not configure those globs or feed request data to the linter. The production dependency audit is clear, and the built server `.nft.json` traces contain no braces/micromatch/fast-glob entries. Keep this issue visible and update the lint dependency chain when a compatible fix is available. Do not downgrade Next's lint config, remove lint checks, or suppress the advisory to obtain an artificial clean audit. This assessment does not make linting arbitrary untrusted repository configuration safe.
- **Verification:** Node **22.23.3**, successful `npm ci`, production compilation and TypeScript, all **16** existing TypeScript test scripts, ESLint (zero errors; existing `_links` warning), OAuth HTTP fixtures, and the authenticated browser suite for all **38** themes including save/rollback, reload, navigation and account isolation. The first build uses the fixture Supabase public values; the normal build configuration is restored afterward. `npm ci` emitted a Windows cleanup warning for an unused optional WASM binding but completed successfully. The pre-existing caught `DYNAMIC_SERVER_USAGE` diagnostic still appears during the build's static probe; dynamic routes build successfully.
- **Evidence:** [`s02-dependencies`](../output/review-2026-10-19/s02-dependencies/) contains before/after full audits, the clean production audit, package changes, build/test logs, runtime trace check and browser results. No production deployment, real OAuth session, live upload or provider configuration change was performed. Credential rotation remains excluded and the credential was left unchanged.

### S03 resolution — 19 October 2026

- Forward migration `020_trusted_progress.sql` introduces a user-locked progress RPC. Status changes, server-derived revision counts, favorites, best-time minima and awards commit together. Authenticated callers cannot write progress directly or execute the old award/increment helpers. Owned interview question completion and session finishing use the same transaction boundary, and failures propagate to the caller.
- Private award state is backfilled from retained progress/history, and is unaffected by visible score deletion. Previously deleted awards with no surviving progress/history cannot be reconstructed; existing history is preserved rather than declared trustworthy. Retry IDs are bound to user, problem, operation and value; reuse returns the original result or rejects mismatched content. Progress writes are limited to 120/minute and 2,000/UTC day per account in PostgreSQL. Receipt records are retained to preserve retry identity.
- Grouped verification passed as recorded below. Production migration/deployment and multi-connection PostgreSQL concurrency verification remain outstanding.

### S04 resolution — 19 October 2026

- Forward migration `021_comment_timestamps.sql` normalizes legacy infinite timestamps before adding `isfinite`, restricts insertable columns and stamps new comments in trusted database code. Author-only text editing is preserved.
- Comment date formatting now renders `Date unavailable` for malformed timestamps instead of throwing. Grouped verification with S03 passed; no production data was read or changed.

### S05 resolution — 19 October 2026

- Migration 022 removes authenticated upload/delete policies for the discussion bucket. The authenticated reservation RPC serializes each account's capacity: 100 objects, 50 MiB total, and five reservations/minute; abandoned reservations retain capacity until cleanup. Direct comment inserts enforce ten posts/minute and 100/day and require a finalized, unclaimed reservation for media.
- The upload action decodes and re-encodes images with pinned Sharp 0.35.5 before publishing through a server-only Storage client. Limits are 3 MiB input/output, 2048 pixels per dimension, 60 frames and 16 million decoded pixels. Existing server storage credentials are read only at runtime; no credential was rotated, inspected or used against the real service. Uploads fail closed when server credentials are unavailable.
- Attachments retain existing public visibility; the composer now discloses it. `node scripts/cleanup-comment-media.mjs` removes expired/unreferenced objects, including deleted-account objects, through the Storage API, then releases abandoned reservations. Run it on a trusted maintenance schedule with server credentials; no hosted schedule has been installed here. The command is retry-safe and never deletes referenced attachments.
- P06's quick fix is included: 3 MiB leaves multipart headroom under the documented hosting limit. Real hosted near-limit uploads remain to be verified.

### R01 resolution — 19 October 2026

- Migration 023 repairs legacy positions into a stable positive sequence, adds unique positions, closes expired/duplicate active sessions, and enforces one active session per account. The new start RPC validates selected IDs, duplicates, duration and mode before changing prior sessions; questions and session creation commit atomically. Picked selections may contain the entire catalog; random selections remain capped at 20.
- The application now creates/replaces sessions in one RPC. Direct session/question writes are revoked; owned completion/finishing already use migration 020. Expired-session reads derive their display status without database writes; stale state is persisted on the next lifecycle mutation.

### S06 resolution — 19 October 2026

- Local bypass now requires the server `USE_LOCAL_DB` flag; the public flag cannot authorize a user. Either bypass flag rejects hosted configuration on the supported platform signals, even with explicit test markers. Ordinary production rejects bypass unless an explicit loopback test configuration is supplied. Next config checks this before build/start, and server auth/proxy paths repeat the guard.
- `scripts/local-test-server.mjs` sets the test markers and binds to `127.0.0.1`. Use the same markers while building a local-memory fixture. Production and preview builds must set both bypass flags false. Anonymous hosted smoke testing remains a deployment gate.

### R02 resolution — 19 October 2026

- Migration 020 removes read/modify/write favorites and JavaScript minimum-time writes. The shared transaction updates only the requested fields and returns canonical solve time/revision values. Award errors roll back progress instead of reporting success.
- Owned interview questions must match before completion can change progress. Session finishing verifies ownership/state and batches completed-question synchronization and scoring into one RPC; retrying the same final state is harmless. Migration 023 makes session replacement atomic. Browser queuing is preserved but is no longer the database consistency boundary.

### Grouped verification and rollout — 19 October 2026

- **Passed under Node 22.23.3:** production compilation and TypeScript; all **19** `scripts/test-*.ts` scripts (the existing 16 plus date/media/local-mode checks); full ESLint with zero errors and the existing `_links` warning; and the production OAuth HTTP fixture, including anonymous protected-page rejection. A fresh `npm audit --omit=dev` still reports **zero vulnerabilities** after adding Sharp as an explicit dependency. The fixture-specific public Supabase values were used only for its build; the final build was restored to the normal public configuration with both auth-bypass flags explicitly false. The pre-existing caught static-probe `DYNAMIC_SERVER_USAGE` message remains; both production builds succeeded.
- **Isolated database checks passed:** `scripts/test-security-db.mjs` applies every migration, including modeled Storage tables and real Storage policies. It verifies revoked award/progress privileges, user isolation, retry identity/mismatch handling, server-derived consecutive revisions, immutable solve identity after score deletion, field preservation, non-increasing best time, injected award/question-insert rollback, progress and comment/media quotas, timestamp repair/rejection, author-only text edits, 25-question and full-fixture-catalog ordering, replacement-session rollback, single-active-session constraint, revoked direct Storage upload, server-only media finalization, and cleanup discovery that preserves referenced media and finds deleted-account objects. It also verifies migration repair of 25 legacy rows sharing the same position.
- The database harness uses the already-isolated PGlite runtime via `SCORE_DB_TEST_RUNTIME=output/review-2026-10-19/db-runtime`. It runs actual PostgreSQL functions/RLS/grants, but **does not prove multi-connection concurrency or live Storage-service behavior**. Serialized tests confirm transaction semantics; staging should still exercise separate database connections and real object uploads.
- No production migration, real credential use, hosted cleanup schedule, live upload or deployment was performed. Apply **020–023** through a transactional migration runner as a coordinated application/database release: the new application requires the RPCs, and the migrations intentionally revoke old clients' direct writes. A maintenance window or equivalent release coordination is required. Keep both local-mode flags false on the hosted build and verify anonymous `/problems` and `/api/library` behavior after deployment. Run near-limit valid uploads and invalid/unauthorized upload checks before enabling attachments, then schedule cleanup in a trusted environment.

**Next ranked implementation issue: P01** — bound discussion/history reads and rendering. S01 remains excluded; the remaining performance/header/input-validation/CI findings are pending.

## Scope and evidence

- Revision reviewed: `ce70829`, plus the working-tree CSV change. Stack: Next 16.2.9, React 19.2.4, Supabase SSR/Auth/PostgREST/Storage, 19 SQL migrations.
- Covered authentication, OAuth callback/proxy, exported mutations, API refresh, ownership/RLS/grants, privileged SQL functions, uploads/comments, secrets, dependencies, query shape/pagination, cache boundaries, client data/DOM, timers, build scripts and existing verification.
- Read installed Next documentation on data security, CSP and caching before creating review harnesses. No Pstack skills or subagents used.
- Evidence directory: [`output/review-2026-10-19`](../output/review-2026-10-19/). It contains audit JSON, HTTP samples, isolated SQL reproductions, a URL-validation reproduction, and browser theme results. The temporary PGlite dependency is isolated there. The initial review left root dependencies unchanged; S02 subsequently updated them as recorded above.
- No privileged credential was used, no production database was queried or modified, and no destructive exploitation/load testing was performed. Git history was inspected for the environment example; this was not an exhaustive historical secret scan.
- Deployed migration state, credential validity/revocation, Supabase Auth configuration, account quotas, WAF rules, production headers, function/DB regions and SQL execution plans remain unverified.

### Ranking method

P0 means immediate containment. P1 means the next security/reliability release. P2 means the next performance/hardening iteration. P3 is lower urgency. Order reflects impact, reachability, evidence and effort; package advisory severity is distinguished from demonstrated application exploitability. Estimates are engineering effort, excluding deployment access and production observation, and overlap where fixes share an RPC or migration.

| Rank | ID | Priority | Finding / proposed outcome | Evidence | Effort |
|---:|---|---|---|---|---|
| 1 | S01 | P0 | Revoke exposed service-role credential and prevent recurrence | Tracked file and Git history | 0.5–1 day + incident follow-up |
| 2 | S02 | P1, urgent | Upgrade vulnerable framework and transitive packages | Fresh npm audit + upstream advisories | 1–2 days |
| 3 | S03 | P1 | Make leaderboard awards derive from atomic, validated progress operations | Reproduced in isolated PostgreSQL | 2–3 days |
| 4 | S04 | P1 | Prevent user-controlled timestamps from breaking shared discussion | SQL insertion + formatter exception reproduced | 0.5 day |
| 5 | S05 | P1 | Enforce upload/comment quotas at the directly callable service boundary | SQL policies and action review | 1–3 days |
| 6 | R01 | P1 | Make picked interviews and their database schema agree; create atomically | Existing test accepts 25; SQL rejects position 21 | 1–2 days |
| 7 | S06 | P1, conditional exposure | Fail closed if auth-bypass local mode reaches a hosted deployment | Config/auth source | 0.5 day |
| 8 | R02 | P1 | Prevent lost updates, partial saves and false-success mutations | Source-proven interleavings and call order | 2–3 days, overlaps S03/R01 |
| 9 | P01 | P2; elevate under abuse | Bound discussion, leaderboard and activity reads/rendering | SQL/loader/component review | 1–2 days |
| 10 | P02 | P2 | Avoid transferring the complete practice library on every first protected open | Fresh local payload measurements | 1–2 days |
| 11 | P03 | P2 | Keep catalog/progress complete above the API row cap | Unpaginated reads + documented API default | 1 day |
| 12 | S07 | P2 | Add response security headers and a tested CSP | Absent in config and local HTTP responses | 0.5–1 day |
| 13 | P04 | P2 | Remove redundant dashboard/refresh work and evaluate safe catalog caching | Source + earlier controlled measurements | 1–2 days |
| 14 | P05 | P2 | Reduce duplicated row rendering and initial JS; unblock timer feedback | Current source + payload sizes | 1–3 days |
| 15 | S08 | P2 | Validate action inputs and exact external-link hosts | URL bypass reproduced; other checks absent | 0.5–1 day |
| 16 | P06 | P2 | Align the advertised 5 MB upload with the hosting transport limit | Code + Vercel documentation | 0.5–1 day, overlaps S05 |
| 17 | Q01 | P2 | Make security/schema/performance checks reproducible in CI | Verification gaps and fixture behavior | 1–2 days |
| 18 | P07 | P3 | Preserve build cache and stop automatically killing unrelated listeners | Build/dev helper review | 0.5 day |

## Findings and detailed solutions

### S01 — Privileged credential in the tracked example

**Evidence:** `.env.local.example:10` contains a non-placeholder JWT assigned to `SUPABASE_SERVICE_ROLE_KEY`; the payload identifies the `service_role` role. The file is tracked despite the general `.env*` ignore rule. Its latest touching commit is `b153c66` dated 17 September 2026. The credential is deliberately omitted here. Its signature, current validity and exposure outside the repository were not tested.

**Impact:** if valid, this credential grants privileged API access that bypasses RLS. The public anon key is not equivalent to this privileged key. [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys) explains that distinction and rotation options.

**Plan:** immediately revoke/rotate the exposed credential through Supabase's supported flow. It is a legacy JWT key, so first identify whether disabling legacy keys/migrating privileged consumers or coordinated legacy-secret rotation is required; do not assume creating a new key invalidates the old one. Update seeding/admin consumers securely, verify revocation, and replace committed values with unmistakable placeholders. Check repository visibility, forks, logs and artifacts for copies; review service activity during the exposure window. Coordinate any history rewrite after revocation. Add secret scanning/push protection and a CI check that examples contain no privileged credentials.

**Acceptance:** old credential rejected by the owner-controlled verification procedure; legitimate maintenance still works; scanner flags a synthetic service-role credential; no actual secret appears in tests/reports. Never restore the exposed key as a rollback.

### S02 — Vulnerable production framework and dependencies

**Evidence:** `package.json:43` pins Next 16.2.9. Fresh `npm audit` reports **15 affected packages: 1 critical, 12 high, 2 moderate**. `npm audit --omit=dev` reports **6: 1 critical, 4 high, 1 moderate**. These are package-level counts, not 15 independently exploitable application flaws. Full advisory details are in the saved JSON.

The upstream [Server Actions DoS advisory](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj) affects this version and the App Router/Server Action architecture used here. The [Windows server RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) is especially relevant if the local Windows server is reachable; it does not establish RCE on the documented Vercel deployment. Image/OG, rewrite, Edge and SSG-specific advisories need individual reachability assessment; several corresponding features are not configured here. Application authorization also occurs outside the proxy, reducing the relevance of a proxy-only bypass.

**Plan:** test Next and matching `eslint-config-next` **16.4.2**, the registry-confirmed upgrade suggested for Next at review time, with compatible React/runtime dependencies. Recheck advisories immediately before upgrading. Update vulnerable transitive dependencies and verify the resulting lockfile; do not blindly run `audit fix --force`—the current audit suggests a Next ESLint config downgrade to 14.2.35 for some chains. Run under the declared Node 22 runtime. Validate auth cookies, uploads, actions and RSC navigation after reading the new installed docs.

**Acceptance:** production audit has no unresolved reachable high/critical issues, with explicit disposition for remaining build-only findings; fresh install/build, auth HTTP, action and browser checks pass. No exploit payload needs to be run against production.

### S03 — Users can fabricate leaderboard awards

**Evidence:** migration `013_leaderboard.sql:95` accepts a client-supplied revision number, checks only that it is positive and the problem exists, and grants execution to `authenticated` at line 205. Neither award function proves the corresponding progress operation occurred. Migration 001 allows users to write all their own progress columns, so checking a freely writable counter alone would not fix this.

**Reproduction:** the isolated harness applies the real award migrations. With no progress table at all, an authenticated role receives 8 points for a Hard solve and 2 points each for revision numbers 1,000,000 and 1,000,001. Migration 016 also allows deleting one's award and then minting that solve award again. That does not multiply simultaneously retained solve awards, but permits replay and potentially moving an award into a later week.

**Plan:** introduce narrow authenticated RPCs for solve/revise that derive `auth.uid()`, lock/update the owned progress row, derive the next revision number server-side and create the event in one transaction. Remove direct authenticated execution of internal award helpers and arbitrary writes to authoritative counters. Use an immutable event identity or a private deduplication record so correcting/deleting visible points does not erase the evidence that an action already earned an award. Keep point-correction UX and its historical-week semantics. Add retry identifiers and agreed per-user write limits. Actual learning remains self-reported; the goal is consistent state and controlled resource use, not proof that a person solved a problem.

**Acceptance:** direct API/RPC calls cannot fabricate an award, supply revision numbers or overwrite counters; duplicate retries award once; valid separate revisions remain allowed; cross-user writes fail; concurrent legitimate revisions have consecutive counts. A failed award rolls back its associated progress transaction.

### S04 — A comment can break the shared page with an infinite timestamp

**Evidence:** migration `017_leaderboard_comments.sql:49` grants unrestricted-column INSERT; the policies constrain the author/media but not `created_at`. PostgreSQL accepts `infinity`. `components/LeaderboardDiscussion.tsx:10–18` passes it to `Intl.DateTimeFormat.format(new Date(value))`, which throws `RangeError`.

**Reproduction:** using the final comment policy/function definitions from 017, the comment portion of 018, and 019, an authenticated role inserts an infinite timestamp. The exact formatter operation throws. The full browser error-boundary outcome was not reproduced; the shared discussion rendering path is confirmed to throw when that row is returned.

**Plan:** assign timestamps in trusted database code, restrict insertable columns and enforce finite timestamps (`isfinite`). Inspect and repair malformed existing rows before validating the new constraint. Add defensive date rendering so one corrupt record cannot fail the whole page. Preserve author-only text edits.

**Acceptance:** direct REST insertion of infinity, negative infinity or a supplied ordering timestamp is rejected/overridden; legitimate timestamps render; one malformed fixture renders a safe fallback without crashing other comments.

### S05 — Upload and comment abuse can bypass the action layer

**Evidence:** migration `018_leaderboard_comment_media.sql:15` permits authenticated users to insert any object under their own folder, subject to per-file size/MIME settings. There is no application-enforced aggregate byte/object quota or posting rate. The action's first-byte identification does not protect direct Storage calls. Comments are also directly insertable. Storage is public, and media retrieval does not share the page's sign-in requirement. Public attachments may be intentional, but must be communicated as such.

**Impact:** a registered user can consume storage/egress and flood discussion without using the UI. A 5 MB per-object cap does not bound total usage. MIME/magic-byte checks do not enforce pixel dimensions or animation complexity. No arbitrary script execution through the current image rendering was demonstrated.

**Plan:** reserve upload capacity atomically per account; issue a short-lived, single-object upload authorization only after checking quota. Ensure generic direct upload permissions cannot bypass reservation. Validate content/dimensions/frame budgets in a controlled processing step, finalize only validated media, and clean up expired/unreferenced reservations. Bound comment writes in database-accessible logic, with separate provider/WAF limits where available. Choose public vs private media explicitly; use authorized/signed reads if discussion attachments should be private. Include account-deletion cleanup.

**Acceptance:** direct API requests obey the same quotas as UI requests, concurrent uploads cannot exceed reservations, invalid media is not published, orphan cleanup is retry-safe, and media-access behavior matches the product decision. Rate limits must not rely on per-process memory in serverless deployment.

### R01 — Picked interviews over 20 questions fail after earlier writes

**Evidence:** `PRODUCT.md:17` explicitly allows any number of distinct picked questions. `scripts/test-picked-interview.ts:25` accepts 25. Migration `007_custom_interview_size.sql:6` still limits position to 20. `app/actions.ts:430–470` closes the previous active session, creates the new session, then inserts questions in separate operations. The isolated SQL check rejects position 21.

**Impact:** a valid product flow fails against the shipped database schema and can leave a closed old session plus an empty new session. Passing in-memory tests masks the mismatch.

**Plan:** migrate the database to support positive positions for all valid selected catalog IDs, preserve uniqueness/order and retain the 20-question rule specifically for random selection. Validate the full request before altering the prior session. Create/replace a session and its selected rows atomically, with a user-scoped lock or uniqueness strategy for concurrent starts. Do not solve this by silently capping picked interviews at 20.

**Acceptance:** 25-question and full-catalog selections succeed in PostgreSQL with exact order; random selection above 20 fails; invalid IDs/duplicates leave the previous session unchanged; an injected insert failure leaves no empty session; concurrent starts have the intended single-active-session result.

### S06 — Local mode can disable authentication in a hosted build

**Evidence:** `lib/config.ts:1–5` enables bypass for either local-mode flag without a deployment guard. `lib/auth.ts:9–11` then returns a shared administrator; `proxy.ts` skips session handling. The tracked example enables both flags. This is a configuration-dependent exposure, not proof that production currently uses local mode. It switches to process-local memory rather than granting direct production-database access.

**Plan:** make local bypass a server-only decision. Reject local mode on hosted production/preview environments at startup/build. Preserve intentional loopback production-build tests with an explicit test mode and loopback binding. Pass a derived boolean to client components instead of treating a public build-time flag as an authorization input. Add a deployment smoke test requiring anonymous `/problems` to redirect and `/api/library` to return 401.

**Acceptance:** any hosted configuration with either bypass flag fails closed; local fixtures remain possible; flags cannot bake an unauthenticated admin experience into a deployment.

### R02 — Read/modify/write races and partial mutations

**Evidence:** `setProblemFavorite` reads status and writes that stale status back (`app/actions.ts:138–149`); a simultaneous solve can be undone by a favorite save. `saveProblemSolveTime:216–237` calculates the minimum in JavaScript; two devices can overwrite a faster time with a slower one. A read error in the favorite lookup is ignored. Browser per-question serialization protects one store, not multiple tabs/devices/direct calls.

Solve/revise and point awards are separate requests; award helpers log errors but allow the action to report success. Interview completion updates without verifying a row was actually changed before syncing progress. Ending an interview performs a serial progress read per completed question, plus possible upsert and award. This is 2+N to 2+3N data calls excluding authentication and refresh; picked interviews make N potentially large.

**Plan:** use field-specific atomic upserts/RPCs, calculate `LEAST` inside PostgreSQL, and return canonical values. Require matched owned session/question rows and validate state transitions in the same transaction. Combine batched session completion, progress synchronization and awards using S03's trusted implementation. Surface durable failures and make retried operations idempotent. Check query errors rather than interpreting them as missing records.

**Acceptance:** concurrent favorite/solve preserves both, best time never increases, nonexistent/foreign session rows produce no side effects, injected failures roll back consistently, retries do not duplicate points, and completion uses a bounded number of network stages. Run these against PostgreSQL, not only the memory store.

### P01 — Discussion/history loads have no useful work bound

**Evidence:** the comment RPC in migration 018 orders all historical rows without a limit. The UI renders every returned thread/reply and eagerly loads each image (`LeaderboardDiscussion.tsx:207`). `lib/data.ts:163` follows 1,000-row history pages until exhaustion and transfers all results to `ScoreHistory`. Weekly ranking aggregates every event in the week. API row caps may truncate RPC results, which creates an additional correctness issue rather than reliable pagination.

**Plan:** cursor-page top-level threads by `(created_at,id)`, page their replies explicitly and return counts so replies do not disappear when their parent falls outside a page. Paginate activity with the same stable composite cursor; obtain weekly/daily summary totals separately so visible-page totals are not misleading. Load media lazily with reserved dimensions, asynchronous decode and appropriate previews for animation. Bound returned leaderboard entries while preserving the user's rank/ties. Inspect representative `EXPLAIN (ANALYZE, BUFFERS)` results before adding a `(user_id,created_at,id)` history index or aggregate table.

**Acceptance:** at 10k+ comments/events, first-page returned rows and bytes stay bounded, traversal has no duplicates/missing rows, totals remain correct, and below-fold images are not all fetched immediately. Test hostile volume only in isolated/staging data.

### P02 — Every protected first open bootstraps the entire practice library

**Evidence:** `app/(protected)/layout.tsx:12` loads and serializes all catalog/progress for every protected route. Fresh local results show 403–449 KB raw HTML/RSC for Revise, Leaderboard and Settings even with empty user activity. `/api/library` sends 337,221 bytes for 697 questions. `select('*')` also includes unused progress fields such as stored notes, contrary to the product's request not to expose note fields; this is the same user's data, not a demonstrated cross-user leak.

**Plan:** keep the proven browser library reuse for Problems↔Revise, but separate provider lifetime from eager bootstrap. Load the practice data on practice routes or on explicit demand; preserve the existing queueing/reconciliation/account-reset behavior. Use explicit minimal catalog/progress projections and omit notes. Consider a catalog version plus private progress payload if measurements justify it. Validate first-open and repeat navigation separately; narrowing a route group must not silently discard the fast navigation the user already requested.

**Acceptance:** direct Settings/Leaderboard opens contain no question/progress payload; a first practice visit gets complete data once; warm Problems↔Revise retains its existing behavior; account changes clear state; pending saves survive refresh correctly. Compare identical datasets before and after.

### P03 — Catalog/progress silently truncate at the service row cap

**Evidence:** `lib/data.ts:76–79` and `:200` read complete tables without ranges/cursors. Supabase documents a default maximum of 1,000 returned rows, configurable per project. Current local catalog size is 697, so this is a growth defect, not a demonstrated current production truncation. [Supabase select reference](https://supabase.com/docs/reference/javascript/select).

**Plan:** either retrieve the full intended library through bounded pages ordered by a stable unique key, or explicitly implement server-side filtering/pagination with complete recommendations and revision selection. Do not merely raise the global API cap. Keep progress loading complete, or restrict it to the relevant catalog IDs without making remaining records appear unsolved. Add tie-breakers such as `id` to frequency ordering.

**Acceptance:** a 1,205-question fixture with more than 1,000 progress rows yields correct favorites, counts, search, revision candidates and interview choices, including records beyond the first page.

### S07 — Missing response security headers

**Evidence:** `next.config.ts` defines no headers. Fresh loopback responses lack CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy. Private pages and the library API correctly use no-store. Hosting may add some headers; production was not checked.

**Plan:** add anti-framing (`frame-ancestors`, with X-Frame-Options fallback), `nosniff`, an explicit referrer policy and a minimal permissions policy. Roll out CSP in report-only mode first, then enforce. Follow the installed Next nonce/header propagation model; account for inline theme CSS, Next/RSC scripts, Supabase connections/media and blob previews. Do not apply a strict policy that silently breaks theme changes or OAuth. Verify HTTPS/HSTS at the deployed edge separately.

**Acceptance:** login, callback, private pages and errors have intended headers; an external iframe cannot embed the app; theme/upload/auth/action flows work under enforced CSP; no credentials appear in violation telemetry.

### P04 — Redundant dashboard and focus-refresh backend work

**Evidence:** Dashboard already fetches the full merged library, then awaits `getDashboardStats` which calls the stats RPC (`lib/data.ts:309`). Queue selection reloads the same conceptual library. `getActiveInterviewSession` first writes stale-session status and then reads; authenticated GETs are therefore not entirely read-only. `/api/library` authenticates before calling a loader that authenticates again; React render memoization is not a general Route Handler cache. Earlier isolated measurements in `docs/PERFORMANCE.md` observed two auth requests for refresh and six backend calls for Dashboard, but these were not rerun against the current production service.

**Plan:** use one merged snapshot for dashboard aggregation and queue selection where parity tests confirm identical behavior. Pass a verified user/client explicitly within the API refresh request. Keep focus refresh, with in-flight coalescing and a measured freshness policy. Evaluate catalog-only caching separately: authenticate outside the cache, keep private progress fresh, and invalidate on admin additions/version changes. Do not put cookie-dependent clients or merged per-user data in a global cache. Evaluate stale-session cleanup as a separate mutation/lifecycle operation rather than an unconditional GET write.

**Acceptance:** instrument actual backend calls, remove proven redundant stages, maintain day/time-zone/stat parity and logout isolation, and prove a response-time/egress improvement beyond noise. No new pooler, paid cache or speculative index is justified by current evidence.

### P05 — Duplicate responsive trees, broad client cost and delayed feedback

**Evidence:** `ProblemTable.tsx:320` and `:357` both mount the same `pageRows` as cards/table, using CSS to hide one. All mode renders the full list twice. Earlier measured DOM counts were 3,013 at 50 rows and 36,712 at All for 681 questions; these are historical counts, not today's browser trace. Today's initial referenced JS is about 273–280 KB gzip per protected route. `InterviewSessionView.tsx:159–164` awaits timer persistence before applying the optimistic completion toggle.

**Plan:** first build one accessible responsive row representation or otherwise avoid mounting the hidden tree without hydration/layout regressions. Profile All/search/rapid writes; virtualize only if necessary and preserve keyboard/focus behavior. Use a module analyzer to identify shared client costs before changing import patterns; lazy-load rarely used UI if it reduces first-open cost. Snapshot/stop a running timer locally and show pending completion immediately, with explicit handling of time-save/completion failure. Keep duration accounting correct while requests are pending.

**Acceptance:** one logical row's controls are mounted once, breakpoints and keyboard interaction work, All mode remains usable, timer completion acknowledges immediately under injected latency, and failed persistence remains visible/retryable. Record main-thread/INP traces; bundle bytes alone do not prove user-perceived improvement.

### S08 — Incomplete runtime validation and provider hostname checks

**Evidence:** `lib/problems/parseNewProblemInput.ts:53–71` parses a URL but then matches the provider against the entire original string. The harness confirms `https://example.invalid/leetcode.com/problems/fixture` is accepted as LeetCode. Catalog creation is admin-only, which limits exposure; this is a misleading outbound-link/phishing risk, not server-side SSRF. Several progress/timer actions rely on TypeScript argument types, while `Math.round` does not establish a finite bounded duration. SQL constraints reject some invalid values but are not a complete application contract.

**Plan:** compare parsed HTTPS hostnames against exact allowed provider hosts and validate paths; reject credentials and misleading host/path combinations. Validate UUID/string/boolean/enumeration/finite-integer inputs at exported actions; handle malformed configuration objects before property access. Add sensible title/topic/array limits consistent with the full-catalog picked-interview requirement, and apply critical invariants at direct database boundaries too.

**Acceptance:** external-host/path/query/userinfo lookalikes fail; supported provider links pass; null/object/NaN/infinite/oversized inputs yield controlled errors without writes; local and production paths behave consistently.

### P06 — 5 MB attachment promise exceeds the Vercel request limit

**Evidence:** UI/action/storage allow 5 MiB and Next actions allow 6 MB. Vercel documents a 4.5 MB function request/response payload limit; multipart overhead reduces the usable attachment size further. Increasing Next's setting does not override the hosting limit. This is conditional on the documented Vercel deployment. [Vercel function limits](https://vercel.com/docs/functions/limitations).

**Plan:** quick fix: lower the advertised/file limit below the platform threshold with tested multipart headroom. Preferred if preserving 5 MiB: implement S05's scoped direct-to-storage upload and validation/finalization flow; do not just open unrestricted client uploads. Reduce the global action size allowance after removing binary transport from actions.

**Acceptance:** near-limit uploads work on the real deployment; oversized ones fail clearly before transfer; unauthorized uploads and abandoned objects remain controlled.

### Q01 — Verification gaps allow security/schema drift

**Evidence:** no checked-in `.github` workflows or umbrella `test` script. Most behavior checks use the in-memory store; some inspect source strings. The picked-interview suite passes while the real SQL constraint rejects the intended flow. The SQL deletion suite needs an externally supplied PGlite runtime. Auth HTTP tests require a build containing the same public Supabase URL as the fixture.

**Plan:** provide documented Node 22/pinned package installation and a single check entry point. Run TypeScript/unit tests, lint, build, isolated database policy/migration tests, fixture-auth HTTP and focused browser tests. Include anonymous/user-A/user-B/admin and direct REST/RPC cases, not only action mocks. Pin fixture public env values during the fixture build. Add secret/dependency scanning and budgets for serialized data and key browser flows. Seed realistic high-volume fixtures and inject transport/database failures.

**Acceptance:** a clean machine can reproduce checks without private credentials; S03/S04/R01 regressions fail the suite; no fixture can contact real external services; security and performance evidence is saved without tokens.

### P07 — Build cache erased and startup kills matching processes

**Evidence:** `scripts/clean.mjs` deletes `.next` on every `npm run build`, removing restored cache. `scripts/free-port.mjs` is invoked by predev/prestart and uses a substring match for `:3000` followed by force-kill, so other matching ports/listeners can be terminated. Its shell interpolation is unnecessary for port input. These are local operational hazards; no remote execution path was identified.

**Plan:** keep clean as an explicit recovery command, with cache keys tied to dependencies/config rather than unconditional deletion. Let startup fail with a clear port conflict or use an explicitly requested alternate port. If a helper remains, validate the port and check exact endpoint/process ownership before stopping anything.

**Acceptance:** repeated identical builds can reuse cache without stale-output failures; starting the app does not terminate an unrelated listener. Measure CI build time before claiming savings.

## Fresh performance baseline

Production Next build, loopback server on `127.0.0.1:3123`, in-memory data, no external backend latency, 697 questions and empty user activity. Eleven sequential full-document requests per route; first excluded, median of ten warm samples. No throttling/concurrent load. Windows host ran **Node 20.15.0**, despite the project's declared Node 22; repeat under Node 22 before release decisions. These are HTTP body-completion times, not TTFB, LCP, INP or production percentiles.

| Route | Warm median (range), ms | Raw HTML/RSC or JSON bytes | Estimated body gzip bytes | Referenced initial JS gzip bytes |
|---|---:|---:|---:|---:|
| Dashboard | 32.1 (29.6–54.6) | 435,239 | 67,980 | 272,850 |
| Problems | 35.9 (33.1–48.0) | 832,255 | 75,700 | 279,527 |
| Revise | 18.6 (16.6–25.8) | 403,032 | 64,216 | 278,704 |
| Interview | 23.7 (18.5–46.8) | 484,780 | 90,581 | 276,030 |
| Leaderboard | 21.8 (18.0–31.9) | 406,596 | 65,302 | 279,038 |
| Settings | 23.3 (18.6–25.8) | 448,606 | 69,284 | 278,554 |
| Library API | 6.6 (5.8–12.0) | 337,221 | 56,347 | 0 |

Gzip figures are calculated locally, not observed on-wire transfer. JS totals sum unique script references for each document; shared chunks can be cached on subsequent visits. Fonts, images, lazy chunks and headers are excluded. No claim is made that all of these bytes recur on client navigation. The existing session library intentionally reduces warm Problems↔Revise fetches; preserve that gain.

No fresh LCP/INP/CLS, signed-in production timing, database query duration, concurrent-load result or authenticated production scan is available. Historical measurements in `docs/PERFORMANCE.md` were used as context and explicitly labeled above; different datasets/builds are not a valid before/after comparison.

## What passed and protections to preserve

- Fresh build compiles and passes TypeScript. It logs a caught `DYNAMIC_SERVER_USAGE` diagnostic from comment loading during the static probe, then correctly emits dynamic routes. This is noisy error handling, not a failed build; distinguish framework control-flow errors from backend failures in a follow-up.
- ESLint passes with one existing unused `_links` warning in `scripts/seed-problems.ts:50`.
- All **16** `scripts/test-*.ts` scripts pass, covering auth/admin, filters/sorting, revision, session library races, interview selection, timers, scores and themes.
- Auth production HTTP fixture passes empty/stale callback, cookie persistence, token refresh, anonymous protection and failed exchange after a build with fixture-specific public environment values. The first run against the normal build failed because the compiled Supabase URL and fixture cookie name differed; it is not evidence of a production OAuth defect.
- Theme browser fixture passes all 38 palettes and its persistence, rollback, pre-JavaScript, responsive and account-isolation checks after supplying the bundled Playwright runtime.
- Existing isolated score-deletion database check passes ownership, anonymous rejection, unchanged update privileges, retry and weekly-total behavior. The new boundary harness nevertheless demonstrates S03/S04 and R01's SQL constraint.
- Auth identity uses `getUser`; proxy `getSession` is refresh plumbing, not authorization. OAuth return destinations are same-origin checked. Admin checks use `app_metadata`, not user-editable metadata. Core user-owned tables have RLS; score deletion and comment edits restrict owners. API refresh/callback disable shared caching. Ordinary text rendering is escaped by React; no arbitrary HTML rendering or dynamically constructed SQL was found in application request paths. External links use `noopener noreferrer`.

These protections should be retained. RLS ownership alone does not enforce trusted score transitions, posting quotas or valid timestamps.

## Delivery sequence and rollout gates

1. **Containment, immediately — account owner + maintainer:** S01 revoke/rotate and investigate exposure; check hosted bypass flags; begin S02 upgrade. Gate: old privileged credential revoked, real auth required, patched framework build verified. Do not wait for performance refactoring.
2. **Database integrity release — application/database maintainer:** S03, S04, R01 and R02. Add forward migrations rather than editing already-applied history. Deploy compatible narrow RPCs/constraints, migrate callers, then remove unsafe grants/helpers in a coordinated release so old clients cannot retain a bypass. Gate: direct API two-user policy tests, retries/concurrency, fault rollback, 25-question SQL flow. Existing award history may be suspect: audit it without automatically deleting legitimate scores.
3. **Abuse and exposure controls — maintainer:** S05/S06/S07/S08/P06. Gate: quota enforcement at direct services, finite timestamps, scoped upload validation, actual hosted size tests, report-only CSP evidence followed by enforcement. Choose attachment privacy explicitly.
4. **Bounded reads and first-open cost — frontend/backend maintainer:** P01/P02/P03/P04. Establish the Node 22 authenticated staging baseline first; implement and measure one hypothesis at a time. Gate: 1,205-question and 10k-event fixtures remain complete, account isolation holds, non-practice pages do not serialize the library, and warm practice navigation does not regress.
5. **Interaction and operations — frontend/CI maintainer:** P05/Q01/P07; start Q01 security gates earlier alongside step 2. Gate: repeatable mobile/desktop interaction traces, build-cache correctness and CI from a clean clone.

Proposed targets, not current achieved SLAs: p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 on representative devices; bounded first history page (for example 50 rows); no whole-library payload on non-practice first opens; initial JS below 200 KB gzip if module analysis demonstrates an achievable reduction. Track immediate feedback and durable-save latency separately. Establish actual server/DB p95 budgets from authenticated measurements rather than assigning an unsupported 200 ms promise.

For every performance change, retain the baseline/result/variance/correctness evidence and revert complexity that does not measurably help. Roll back UI/cache experiments independently of security fixes. Before tightening database grants, verify all legitimate callers; prefer forward fixes over restoring unsafe score RPCs or revoked credentials. Production rollout, provider configuration changes and credential rotation are outstanding implementation work, not actions performed by this review.
