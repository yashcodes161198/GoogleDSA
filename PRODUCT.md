# GoogleDSA

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users and purpose
The user's daily DSA practice workspace: track questions, complete daily revisions, and practice mock interviews. Visual cleanliness must support function.

## Capabilities and constraints
Preserve Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, Tailwind 4, Supabase authentication/data, existing actions and business rules. Keep problems, favorites, revision counts, external question links, solve timers, interview configuration/history and weekly leaderboard accessible. The user explicitly removed notes functionality from the app. Retain existing stored data without exposing note fields or save actions. The current persistent catalog status supports unsolved and solved only; do not invent an attempted state or migrate the database during this visual rebuild.

## Operating context
Practice questions on their existing external providers, then track progress here. Revision uses the existing daily queue and eligibility rules. User confirmed automatic light/dark following the device.

## Principles
Make frequent actions visible. Use real catalog content and computed data. Preserve working behavior. Prefer readable density over decoration. No fabricated activity, streaks, or progress.
