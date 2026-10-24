# Verification

Use the Node version in `.nvmrc` (22.23.3), then run:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
```

Windows users can omit `--with-deps`. `npm test` runs the same entry point. PGlite and Playwright are pinned development dependencies in the lockfile; no external runtime folder or private credentials are required. Package installation, audit and the build's Google font download need network access.

The command scans repository text for private keys/privileged credentials, executes every `scripts/test-*.ts` script, lints application and script sources, applies actual SQL migrations/policies in isolated PGlite, checks migration repair/deletion behavior, and audits dependencies. It builds twice with identical synthetic public Supabase settings in `.next-verification`, confirms the cache survives, then runs auth HTTP, responsive/practice/discussion/history/interview browser checks in both CSP modes and the theme browser suite.

HTTP/browser fixtures block backend and browser requests outside loopback or their intercepted synthetic Supabase origin. They exercise anonymous, user-A/user-B isolation and admin denial; SQL checks exercise actual roles, grants, ownership, malformed direct calls and transaction rollback. Storage is modeled in PostgreSQL; this does not prove the hosted Storage transport or multi-connection concurrency. Unit actions reject malformed inputs before writes. Catalog validation requires migration 025 on the deployed database.

The browser fixture uses 1,205 questions/progress rows under a 137-row service cap and enforces complete payloads, bounded non-practice documents, single mounted controls at mobile/desktop widths, durable saves, rollback and immediate timer feedback under injected latency. SQL fixtures cover 10k-event/comment paging. These are correctness and payload budgets, not production latency or field INP guarantees.

Evidence is saved under `output/verification/` and `work/review-bounded-reads/`. CI runs the same command on pushes and pull requests and retains evidence for seven days. It uses read-only repository permissions and dependency/config/source-keyed Next cache restoration. Existing application builds in `.next` are untouched.

The exact known credential in `.env.local.example` is fingerprinted and explicitly excluded from blocking the credential scan because S01/rotation was deferred by the user; new privileged JWTs fail, including replacements in the example file. Values are never printed. The dependency check requires a clean production audit and permits only the previously documented development advisory GHSA-vfj7-8cjw-p6xm; registry/audit failures and new advisories fail verification. Neither exclusion resolves the underlying finding.

After deploying, separately verify real OAuth, uploads near the limit, cleanup scheduling, HTTPS/HSTS/CSP and multi-connection database behavior. Local success does not confirm rollout.

Interview completion after expiry or session end requires `supabase/migrations/028_interview_completion_after_end.sql` on the deployed database. Apply it with the migration runner or Supabase SQL editor before deploying the matching UI. It replaces only the completion RPC, preserves ownership and atomic solve-credit checks, and is safe to reapply. The database suite covers expired/completed/abandoned sessions, cross-user rejection, and duplicate-credit prevention; the browser suite checks pending controls, save failures, and completion persistence after reload.
