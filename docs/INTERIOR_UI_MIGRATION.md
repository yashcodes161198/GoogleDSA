# Interior.dev UI migration

The 54-entry [Interior.dev catalog](https://www.interior.dev/docs) was reviewed against the existing Google DSA interface on 25 October 2026. The migration adapts 15 component sources to existing interactions. It changes presentation, not workflows, data access, permissions, server actions, scoring, revision scheduling or interview configuration.

Source and licensing details are in [components/interior](../components/interior/README.md). `motion` is the only added runtime dependency. The lockfile also updates the existing lint toolchain's transitive Zod dependency to resolve the audit failure; application validation is unchanged.

## Catalog assessment

| Interior component | Use or reason to retain the existing control |
| --- | --- |
| Copy Button | No existing clipboard action; adding one would add functionality. |
| Loading Button | Reserved idle/pending labels in authentication, add question, interview start, display-name save, comment/reply actions, pagination loads, history retry and award deletion. Existing async handlers retained. |
| Hold to Confirm | Would change the existing click-to-confirm award deletion workflow. |
| Like Burst | Favorite stars throughout problem lists, revision and interviews; existing optimistic persistence retained. |
| Ripple | Press Depth supplies the same feedback across buttons without stacking two effects. |
| Icon Morph | Native completion/revision checkboxes animate their existing checkmark. |
| Press Depth | Shared Button and all other application button elements: actions, timers, filters, sorting, pagination, account controls, comment controls and question selection. |
| Floating Label | Visible external form labels retained; changing label placement adds no benefit to the existing dense forms. Field chrome uses Interior's inset/focus treatment. |
| Inline Validation | Add-question server validation errors animate on arrival; field rules, messages and alert semantics retained. Input styling also uses the source's inset/focus treatment. |
| Password Strength | Would introduce password advice/criteria beyond the current authentication contract. |
| OTP Input | No existing OTP flow. |
| Tag Input | Topic input remains comma-separated; question selection keeps its existing combobox/hidden IDs. Tag creation/deletion rules would differ. |
| Expanding Search | Search remains visible and labeled; collapsing it would add a step. |
| Skeleton Swap | Practice-library loading-to-content arrival, with no artificial wait or new scrolling region. Existing route skeletons retain their dimensions and honor reduced motion. |
| Progress Bar | Dashboard topic coverage uses the spring fill and keeps its accessible percentage. |
| Load More | Automatic sentinel loading would alter bounded reads. Existing explicit buttons use Loading Button presentation. |
| Streaming Text | No streaming content. |
| Task Steps | No staged background job UI. |
| Live Activity | Existing refresh/error notices stay in their current location; no new dismiss/retry state machine. |
| Collapsible Banner | Existing notices remain immediately readable, with no new collapse/dismiss action. |
| Presence Avatars | Account and leaderboard avatars do not represent live presence. |
| Typing Indicator | Discussion is not live chat. |
| New Items Pill | No existing live-feed insertion workflow. |
| Modal | No existing modal interaction; inline deletion confirmation retained. |
| Popover | Concepts tooltip and interview question results use its crossfade, retaining positioning, hover/pin, Escape and selection handlers. |
| Tooltip Group | Shared favorite/replace tooltips use delayed pointer reveal, immediate focus reveal and Escape dismissal. Each standalone trigger keeps its own timing. |
| Command Palette | Would add navigation/search functionality. |
| Drawer | Existing mobile navigation stays visible; no drawer step added. |
| Context Menu | No existing right-click actions. |
| Dropdown | Native selects and mobile account disclosure retained for platform keyboard behavior, form values and existing interactions. |
| Tabs | Shared selection indicator on desktop/mobile route links and score-history action filters. Link and pressed-button semantics retained. |
| Segmented Control | Theme mode and random/picked interview selection, using native radios and original form names/values. |
| Accordion | Custom-interview panel arrival, preserving natural size and immediately removing disabled configuration fields when closed. Native `details` elsewhere retain browser behavior. |
| Wizard Steps | No multi-step wizard. |
| Pagination | Reserved page-number slot and transition; existing page size, Previous/Next, disabled boundaries and URL state retained. |
| Tree View | No hierarchical navigation data. |
| Sticky Header | Existing sidebar/header positioning retained; no scroll-driven resizing. |
| Reading Progress | No long-form reading workflow. |
| Scroll Spy | Session anchors keep their existing behavior; no new scroll-tracking selection. |
| Snap Carousel | No carousel content. |
| Hide on Scroll | Would hide currently persistent navigation/actions. |
| Sortable Table | Spring sort indicator with native table/ARIA semantics. Existing three-state comparator and responsive rows retained instead of upstream fixed-height positioned rows. |
| Filter Grid | Library remains a table; layout animation across up to the entire catalog would impose work on every row. |
| Value Flash | Dashboard summary and shared stat numbers use keyed arrival transitions, without treating every increase as good or decrease as bad. |
| Poll Results | No voting feature. |
| Slider Detents | Duration/count inputs remain exact numeric fields. |
| Swipe Deck | Would replace explicit problem actions with gestures. |
| Reorder List | Existing question ordering is deliberate; manual reordering would change functionality. |
| Long Press | Would delay or change existing click actions. |
| Lightbox | No existing media enlargement workflow. |
| Text Reveal | Essential headings, instructions and question text remain immediately readable. |
| Logo Marquee | No logo collection. |
| Blur-up Image | Existing lazy GIF/sticker media retains its native sizing, decoding and error behavior; no placeholder asset exists. |
| Show More | Existing explicit pagination and native disclosures retained; no truncation of visible content added. |

Cards, badges, tables, native selects, textareas and links are not standalone replacements in the catalog. They retain their semantics and use the application's theme tokens; shared button-link and input chrome follows the adapted components.

## Verification

`npm run check` includes all existing unit/database checks, lint, dependency audits, production builds, authentication/revision HTTP checks, authenticated browser scenarios under both CSP modes, and the theme suite. It now also runs `scripts/test-interior-ui-http.mjs` against an isolated loopback production fixture.

The Interior browser pass checks keyboard favorites and Escape tooltips, three-state sorting, pagination, preserved interview form values and picker IDs, dynamic form layout, display-name focus restoration, dark/light settings, six mobile routes, reduced-motion controls, and browser errors. It saves screenshots and a JSON result in `output/verification/interior`.

To use the same pass with a local development fixture, set `INTERIOR_TEST_URL` and run `node scripts/verify-interior-ui.mjs`. The verifier rejects non-loopback URLs and blocks external browser requests. It does not mutate a live account or database. Existing authenticated fixtures cover successful and failed persistence; live OAuth, multi-connection database behavior and the live Storage service remain outside this local UI verification.
