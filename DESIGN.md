---
name: GoogleDSA
description: A clean daily workspace for DSA practice, revision, and interviews.
colors:
  background: "#f5f7fa"
  foreground: "#202936"
  surface: "#fff"
  surface-subtle: "#edf1f6"
  line: "#dce2e9"
  muted: "#586577"
  accent: "#3659b5"
  accent-hover: "#294796"
  accent-soft: "#e9effc"
  accent-text: "#304fa0"
  success: "#26704d"
  outline-border: "#bac4d0"
  dark-background: "#15191f"
  dark-foreground: "#eef2f6"
  dark-surface: "#1c222b"
  dark-surface-subtle: "#252d39"
  dark-line: "#364151"
  dark-muted: "#a5b1c2"
  dark-accent: "#466cc9"
  dark-accent-hover: "#5279d7"
  dark-accent-soft: "#273650"
  dark-accent-text: "#aac3ff"
  dark-success: "#8bd4ab"
  dark-outline-border: "#384453"
typography:
  headline:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(26px, 3vw, 32px)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  section:
    fontFamily: "Geist, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "12px"
    fontWeight: 550
  duration:
    fontFamily: "Geist Mono, monospace"
    fontSize: "24px"
    fontWeight: 600
rounded:
  badge: "6px"
  control: "7px"
  brand: "9px"
  panel: "12px"
  round: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#fff"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "8px 10px"
    width: "100%"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "24px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  revision-label:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
---

# Design System: GoogleDSA

## Overview

**Creative North Star: "Daily study workspace"**

An ordered daily study workspace for practice, revision, and interviews. Clean surfaces, readable work lists, and a quiet blue action treatment keep attention on the next useful action. The visual identity comes from real catalog content and computed progress rather than decoration.

Automatic light and dark themes follow the device. Both share the same hierarchy, spacing, and component shapes. Mobile layouts reveal secondary controls when requested while keeping search, timers, and frequent actions easy to reach.

**Key Characteristics:**

- Quiet blue actions and selected navigation.
- Flat, bordered surfaces with readable density.
- Textual progress and tabular duration measurements.
- Responsive disclosure with labeled controls.

## Colors

Blue is the single action accent. Neutral surfaces and dividers provide structure without competing with problem content. The frontmatter records the exact semantic values from the global stylesheet; matching dark-prefixed tokens are the device-theme counterparts.

### Primary
- **Quiet Blue** (`accent`): primary actions. Use `accent-hover` for their hover state.
- **Blue Tint** (`accent-soft`): selected navigation, the daily interview surface, and revision labels.
- **Readable Blue** (`accent-text`): links and text on the blue tint.

### Neutral
- **Canvas** (`background`): app backdrop.
- **Surface** (`surface`): cards, fields, navigation, and panels.
- **Subtle Surface** (`surface-subtle`): secondary layers and hover backgrounds.
- **Ink** (`foreground`): primary content; **Secondary Ink** (`muted`): descriptions and metadata.
- **Divider** (`line`): panel outlines, row dividers, and field borders.
- **Control Outline** (`outline-border`): the shared outline-button border, distinct from panel dividers.

### Semantic states
Completion uses `success` for the practice-row inset marker and completion text. Difficulty and solved labels retain their existing green, yellow, red, and emerald semantic utilities; they do not become additional brand accents. Timer warnings remain yellow at 15 minutes and red at 5 minutes or expiry, with explanatory text.

**The Revision Label Rule.** Every revision-count label uses the same blue tint and readable blue text; communicate its count in words.

## Typography

**Body Font:** Geist, with sans-serif fallback.
**Duration Font:** Geist Mono, with monospace fallback.

The sans-serif hierarchy is compact and readable. Monospace is reserved for duration measurements; tabular numerals stabilize counters without giving ordinary text a code-like appearance.

### Hierarchy
- **Headline:** responsive page titles using the frontmatter headline role.
- **Section:** compact panel headings using the section role.
- **Title:** card titles using the title role.
- **Body:** descriptions and controls use the body scale; catalog metadata also uses 13px. Page descriptions have a maximum width of 65ch.
- **Label:** field labels and supporting metadata use the label scale.
- **Duration:** session countdowns use the duration role on narrow layouts and grow to 36px at the wide session breakpoint.

**The Real Count Rule.** Use computed numbers and textual labels for progress; never manufacture a decorative counter or streak.

## Layout

Use a 4px base rhythm with recurring 8px, 12px, 16px, 20px, 24px, and 32px steps. The main area has a maximum width of 1540px, mobile padding of 30px 20px 100px, and desktop padding of 40px 32px 48px. The mobile bottom allowance protects content from the tab bar.

At 768px, the global navigation becomes a fixed 216px sidebar with a matching main-content offset. Below it, use the single-row compact header, native Account disclosure, and bottom tab navigation. At 1200px, daily panels use a 1.65fr / 1fr grid and interview sessions use a 260px sticky rail beside flexible question content.

Search stays visible at every width. Below 640px, secondary catalog filters sit behind a labeled Filters disclosure showing the active secondary-filter count. At 640px and above, all filters are exposed in the grid. Catalog entries stay stacked below 1280px and become a compact table at that breakpoint; retain their actions in both forms. Desktop rows use Problem, Open, Difficulty, Frequency, Best time, Your progress, and Action columns. Provider links are short pills, problem titles are 15px and remain on one line, and concepts appear through the adjacent information control on hover, focus, or tap. Long titles retain their full text in the title attribute. Actions remain on one line, with horizontal scrolling confined to the table at narrower desktop widths.

Interview countdowns are inline below 1280px. Session questions start collapsed there and have a Show list / Hide list control; the wide rail exposes the question list. Session layout gaps are 16px on mobile, the rail uses 8px, and these expand to 24px / 16px at 640px. Revision and interview questions share a two-line practice row inside one surface with separators: title, concepts control, provider pills, difficulty and context above; completion action on the left and compact timer on the right below. At 1024px and above, the first line uses three aligned columns: problem details, a dedicated 180px provider column, and right-aligned difficulty/context, with 24px gaps and no headers. Rows use 16px vertical and 20px horizontal padding, reduced to 16px horizontal on mobile. Titles use 16px type. Groups wrap naturally on narrow screens. Completed rows retain explicit text and a success-colored inset marker. Ordinary catalog cards use 16px padding.

## Elevation & Depth

Surfaces are flat at rest. Borders, tinted backgrounds, and whitespace distinguish groups; there are no decorative shadows in the shared system. Focus is a visible outline in readable blue (2px with a 3px offset), rather than simulated elevation. Honor the reduced-motion preference by removing animation and transitions.

## Shapes

Panels have gently curved corners using the panel radius; fields, navigation items, and buttons share the tighter control radius. Badges use the smaller badge radius. Circular avatars and queue markers identify people and list position. Borders are thin (1px) and functional.

## Components

### Buttons
Primary buttons use the blue action fill, white text, and a darker hover fill. Shared default buttons are 40px tall; small buttons are 36px and large buttons are 44px. Outline buttons use a transparent background and the control-outline border; ghost buttons rely on hover tint. Disabled buttons reduce opacity to 50%. Preserve visible focus and color-state transitions. Catalog actions on narrow screens and session-ending buttons have a minimum height of 44px.

### Labels and counters
Revision labels use the same blue treatment for Revised once, Revised twice, Revised 3 times, and Revised 4+ times. Unsolved and solved retain neutral and semantic completion treatments. Counters remain text; badges always name the state.

### Cards and containers
Use the surface background, panel radius, and divider border. Padding follows the layout context. Completed practice rows show a success-colored inset marker and retain explicit completion text.

### Inputs and fields
Use visible labels, the surface background, divider stroke, and control radius. Shared fields are 40px tall with 8px 10px padding. Placeholder and label text use secondary ink; the caret uses readable blue. Keep native select and input behavior.

### Navigation
Navigation links use muted text, 14px medium type, 10px 12px padding, and a minimum height of 44px. Hover uses the subtle surface; the current page uses blue tint and readable blue. Use aria-current for the selected destination and retain the Skip to content link.

### Interview controls
Time remaining sits beside the monospace countdown on mobile, with warnings below when necessary. The question-list disclosure and textual completion count keep the overview compact. Abandon and End session use subordinate outline buttons. Provider links, per-question solve timers, and completion controls remain accessible in each question card.

Custom setup uses a Random / Pick questions radio control with Random selected initially. Pick questions replaces the difficulty-count fields with a labeled searchable combobox, difficulty badges in results, and an ordered selected list with remove controls. Arrow keys navigate results, Enter adds a question, and Escape dismisses the dropdown. Already selected questions are excluded. Duration stays visible in both modes, and submission is disabled when a picked list is empty. Selected rows and results use bounded scrolling as the list grows; mobile remove controls have 44px targets.

## Do's and Don'ts

### Do:
- **Do** use semantic CSS variables so light and dark themes stay aligned.
- **Do** keep search visible and label every secondary filter.
- **Do** retain provider links, favorites, progress actions, and timer controls in stacked problem entries.
- **Do** use real catalog content, computed counts, and explicit state labels.
- **Do** preserve visible keyboard focus, native controls, and reduced-motion support.

### Don't:
- **Don't** reintroduce note fields or note-save actions.
- **Don't** invent activity, streaks, attempted status, or decorative progress charts.
- **Don't** use different colors to rank revision-count labels; their text communicates the count.
- **Don't** make session-ending controls more prominent than question work.
- **Don't** add decorative shadows, marketing heroes, or decorative motion.
