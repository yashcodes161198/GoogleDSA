# Session library, trusted clicks

The library was downloaded again on every page and after every click, which is the wait we measured. We keep one in-memory library for the browser session. It loads in the background when the app opens. The revision queue is derived from that library. A click updates the library immediately and saves in the background. The library reloads only on a fresh open.

## Status

accepted

## Considered options

- Refetch the library on every navigation and after every save. This is the current behavior, and it is the measured wait.
- Fetch the revision queue on its own at startup. The queue is a filter of the library, so that download repeats the same work.
- A paid remote cache. Vercel Hobby and Supabase Free do not include one.

## Consequences

- The first open still pays for one Supabase fetch. Later page changes in that session do not.
- A failed save puts that question back and shows an error. A successful save does not reload the library.
- Progress made in another tab or on another device shows up on the next fresh open.

## Amendment — 9 October 2026

The user chose refresh on focus: progress reloads when the tab regains focus, as well as on a fresh open. This supersedes the fresh-open-only freshness policy above. It balances fast repeat navigation with picking up changes from another tab or device when returning to the app; it does not promise immediate synchronization while a tab stays active. Concurrent refreshes coalesce, pending local saves are replayed, and writes completed after a refresh began are retained.

The free-plan rationale above is corrected: Vercel Hobby currently includes access to [Data Cache](https://vercel.com/docs/caching/runtime-cache/data-cache) and [Runtime Cache](https://vercel.com/docs/caching/runtime-cache), subject to their limits. A paid external cache is not required to investigate shared-library caching.

The user selected Problems ↔ Revise first. Both pages now consume a user-scoped session library in the protected layout. The initial server render bootstraps it, superseding the original background-load wording; other protected entry pages also pay that initial library cost. Navigation still requests small route shells but does not reload the library. Local status, favorites, revisions and saved times update through the shared store; server actions retain independent authentication and durable writes. Failures roll back only the failed transformation. Sign-out or account change discards the store and late asynchronous results. No private library enters shared server caching or persistent browser storage.

Dashboard and Interview remain server-driven. Their changes appear in this library on focus/fresh open; admin additions explicitly refresh it. Saved times carry across pages, while running timers remain page-local. The [performance investigation](../PERFORMANCE.md) records the controlled before/after result, correctness checks and production measurement limits. No paid plan or migration was required.
