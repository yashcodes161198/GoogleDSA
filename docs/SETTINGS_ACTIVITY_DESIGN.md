# Settings & activity

The account menu opens `/settings`. The page is a personal score ledger for the
last 30 calendar days, including today, with day boundaries and times in IST to
match the leaderboard. Only recorded awards appear; historical totals are never
reconstructed from mutable question status.

## Visual direction

Keep the existing study workspace palette: canvas `#f5f7fa`, white surface,
ink `#202936`, muted `#586577`, divider `#dce2e9`, blue `#3659b5`.
Use the existing Geist font, 32px page title, 17px section titles, 14px body,
12px metadata, and tabular numerals for scores and timestamps. Follow the device
theme by default using existing semantic variables. Appearance settings above
the ledger offer System, Light, and Dark modes, with independent light and dark
palettes. The original Google DSA palettes remain the defaults.

The distinctive element is a selectable strip of 30 daily score bars, each a
real daily total. It doubles as a date filter. The rest is a quiet ledger, with
daily subtotals, timestamps aligned left, the action and question in the middle,
and awarded points aligned right. All revision labels use the same blue tint;
words distinguish the action. Avoid separate metric cards and decorative charts.

```text
Settings & activity
Your account and the points you've earned.

Appearance
  System | Light | Dark     Light palette | Dark palette

Account                    Score history                     Last 30 days
  email                    points / scoring actions / active days
                           [30 daily bars; select a day to inspect]
                           All | Solved | First revision | Second+ revision
How points work            Sunday, 11 October                 +14 pts
  Medium / Hard              9:42 pm   Solved · question         +8
  Three scoring actions      8:10 pm   First revision · question +4
                             7:55 pm   Second+ revision · ...   +2
                           Saturday, 10 October                +4 pts
```

On mobile, activity appears first and the account disclosure follows the ledger.
The strip can scroll within its own container without widening the page. Filters
wrap, rows keep points aligned, and touch targets are at least 44px. Native account
disclosure and filter buttons support keyboard navigation. Every score bar has a
date/points accessible label and a pressed state. Clearing the date restores the
whole period. Show explicit empty, loading, and retryable failure states.

## Data and behavior

Read the authenticated user's `leaderboard_events`, with stored points and
timestamps, plus question titles. Fetch all pages so Supabase's row limit does not
silently truncate an active user's month. Existing solve and revision award paths
remain the source of truth, including interview solves and duplicate prevention.
Group revisions numbered 2 or higher under **Second+ revision**. Display the
specific revision number in the entry metadata. Filtered totals and the daily
strip follow the selected action. The date filter narrows only the ledger.

This meets the brief without adding a separate event recorder or inventing old
timestamps. The layout adapts the existing study workspace instead of introducing
a second design system. No new database migration is needed when migration 013
is installed. Missing or failed event reads must not look like an empty history.
