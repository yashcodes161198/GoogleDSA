# GoogleDSA visual system

## Direction
A daily study workspace, built directly from the user's workflow and wireframes. The UI prioritizes catalog progress, revision, and daily interviews. Automatic light/dark was explicitly selected by the user. Mode: Operate.

## Tokens
Canvas #F5F7FA, surface #FFFFFF, text #202936, secondary text #586577, action #3659B5, dividers #DCE2E9. Dark canvas #15191F, surface #1C222B, text #EEF2F6, secondary #A5B1C2, action #466CC9. Colors live in app/globals.css.
Geist for text, Geist Mono for duration measurements only. Page headings 26–32px, section headings 17–18px, body 14–16px, metadata 12–13px. Base spacing 4px; section gaps 24–32px. Panels 12px radius, controls 7px. Borders define groups; no decorative shadows.

## Layout and behavior
216px persistent desktop navigation. Below 768px use the bottom navigation and a compact header. Main content max-width 1540px. Daily revision queue and interview action lead the dashboard; coverage follows. Problem titles and their topics share one column. Filters have visible labels. Mobile problems become stacked entries with all actions retained. Interview sessions have question navigation beside the active work. Preserve external providers, status actions, favorites, timers, notes, queue rules, and session history.

## Wireframes
Dashboard: navigation | heading / progress strip / revision queue + daily interview / next problems + topic coverage.
Problems: navigation | heading / labeled search and filters / compact rows / pagination.
Revision: navigation | heading / daily completion and replace action / problem, timer, provider links.
Interview: navigation | heading / sticky session timer and question index | question cards and notes.

## Quality
Use actual computed counts and catalog titles; never decorative placeholder charts. Every status has a text label. Keep browser focus visible, support reduced motion, preserve native inputs, and provide useful empty and error states. Verify local interactions before broadening across pages.

## Design review
The initial generic dashboard suggestion was rejected in favor of the actual practice queue and real interview state. Brand expression is held to the ordered work list and quiet blue action treatment. No marketing hero, fabricated streak, or decorative motion. The existing stack and persistent status model stay unchanged.
