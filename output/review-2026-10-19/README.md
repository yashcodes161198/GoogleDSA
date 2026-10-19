# Review evidence

See `../../docs/PERFORMANCE_SECURITY_REVIEW_2026-10-19.md` for scope, findings, limitations and ranking. Run commands from the repository root. These harnesses use local fixture data only; never substitute production credentials for fixture values.

- `npm-audit.json`: full dependency audit; `npm-audit-production.json`: audit with dev dependencies omitted. Regenerate with `npm audit --json` and `npm audit --omit=dev --json` respectively. Nonzero audit exit codes indicate findings.
- `http-results.json`: all 77 sequential samples and seven summaries from `http-baseline.mjs`. Build with both local-mode flags false, then run `node scripts/local-test-server.mjs` on its default loopback port 3123. The S06 launcher supplies the explicit local-test markers required by the production guard. Run `node output/review-2026-10-19/http-baseline.mjs`. This intentionally bypasses auth only on loopback and measures the production renderer with in-memory data. Do not expose the server to the network.
- `verify-award-boundary.mjs`: isolated real-PostgreSQL checks for forged awards, award replay after deletion, unsafe comment timestamps and the picked-question position constraint. Reinstall its isolated runtime, if missing, with `npm ci --prefix output/review-2026-10-19/db-runtime --ignore-scripts`, then run `node output/review-2026-10-19/verify-award-boundary.mjs`. Success confirms the current defects are reproducible; this is not a regression test expecting them to be fixed. Storage service behavior is not emulated.
- `verify-provider-url.ts`: run `node_modules/.bin/tsx output/review-2026-10-19/verify-provider-url.ts`; success confirms the misleading provider URL is currently accepted.
- `theme-verification/`: results copied from the existing authenticated browser suite. Its original tracked outputs were restored after copying. All 38 palettes and listed behavior checks passed.

Existing checks also run: all 16 `scripts/test-*.ts`, lint, production build, auth HTTP fixture, and score-deletion database test with `SCORE_DB_TEST_RUNTIME` pointing to `db-runtime`.

For auth/theme HTTP fixtures, first build with `NEXT_PUBLIC_SUPABASE_URL=https://auth-test.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key`, and both local-mode flags false. Build-time public values must match the runner; changing only runtime env is insufficient. The theme runner additionally requires `CODEX_BROWSER_RUNTIME` to point to the bundled node_modules directory containing Playwright. Rebuild with normal development environment values afterward before starting the app normally.

Review checks ran on Node 20.15.0; package.json requests Node 22. Repeat on Node 22 in CI. No real service-role key is required for any of these checks.

Subsequent S02–S06/R01–R02 remediation checks ran on Node 22.23.3; see the review document for grouped results and remaining deployment gates. For the current database regression suite, restore the isolated runtime with the `npm ci --prefix` command above, set `SCORE_DB_TEST_RUNTIME` to its absolute directory, and run `node scripts/test-security-db.mjs`. Installed `db-runtime/node_modules` files are intentionally ignored; its manifest and lockfile are tracked.
