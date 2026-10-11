# Appearance settings

Settings & activity includes System, Light, and Dark modes and independent
palettes for each mode. System is the default and responds immediately to device
color-scheme changes. Google DSA Light and Google DSA Dark preserve the original
app colors. Reset to defaults restores both palettes and System mode.

All 38 bundled palettes from the sibling Pomotroid clone are included, grouped
into 8 light and 30 dark themes. Their names, backgrounds, surfaces, and accents
are preserved. Text shades are adjusted where necessary to provide at least
4.5:1 contrast on app backgrounds and surfaces; primary buttons use black or
white text for contrast. Semantic success and error colors remain distinct.
The source palettes live in `lib/themes/pomotroid.json`; the original MIT notice
is retained in `licenses/Pomotroid-LICENSE`.

Authenticated preferences are stored in the user's Supabase Auth metadata under
`appearance`, containing `mode`, `light`, and `dark`. The server validates each
mode/palette pair and updates only the authenticated account. Existing metadata
is preserved. No database migration is needed. Local development uses a cookie
named for the local user, lasting one year.

The root layout reads the current account and emits both palettes as CSS
variables. CSS selects the correct mode before JavaScript runs, including System
mode, so refreshes don't flash a different theme. Changes preview immediately
and save automatically. Controls stay disabled during a save; failure restores
the previous selection and displays a retry message.

## Verification

- `npm run test:themes` checks all source palettes, contrast, original defaults,
  and validation of mode/palette pairs.
- `scripts/verify-themes.mjs` exercises all themes through the actual settings
  UI, modes, reloads, keyboard controls, mobile layout, navigation, button text,
  failed saves, and reset. Set `THEME_PREVIEW_URL` to a local development server
  and `CODEX_BROWSER_RUNTIME` to the bundled Playwright package directory.
- `scripts/verify-theme-scroll.mjs` clicks the visible preview of all 40 themes
  on desktop and mobile and verifies that both page and picker scroll positions
  stay unchanged. It uses the same environment variables. Hidden radio inputs
  are positioned inside their labels so browser focus follows the visible card
  within the scrollable picker.
- `npm run test:themes:http` runs the same browser checks against a production
  build and a synthetic Supabase backend. It also verifies account isolation,
  cross-device persistence, first paint with JavaScript disabled, and preservation
  of unrelated metadata. Build first with `USE_LOCAL_DB=false`,
  `NEXT_PUBLIC_USE_LOCAL_DB=false`,
  `NEXT_PUBLIC_SUPABASE_URL=https://auth-test.supabase.co`, and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key`. Set `CODEX_BROWSER_RUNTIME` as
  above. The fixture blocks external backend traffic and uses no live accounts.
