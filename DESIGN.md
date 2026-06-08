# Lumineo Signs — Switchboard Design System

This is the **single source of truth** for the visual design of the Lumineo Signs
Switchboard platform. Every application and screen (Dashboard, My Schedule,
Calendar, Project Scheduler, Weekly Scheduler, Sign Builder Pro, Job Punches,
Estimating, Sales Hub, Settings, Help) **must** use these tokens, layout rules,
and component patterns so the whole product looks and behaves as one cohesive app
in both **light** and **dark** mode.

> Source of truth: Figma — `Dashboard` file (`ATtMVBdOD3UT4ZXoHaobp6`),
> frames **Dashboard — Light** (`23:3`) and **Dashboard — Dark** (`23:344`).
> When the Figma file changes, update this document.

---

## 1. Theming model

The design is built around **semantic design tokens**, not raw hex values. A
component references a token (e.g. `surface/raised`); the token resolves to a
different hex value depending on the active theme. **Never hard-code a hex value
in a component** — always go through a token. This is what guarantees a screen
works in both light and dark mode for free.

### Implementation: CSS custom properties

Define every token as a CSS variable on a theme scope. Switch themes by toggling
a class / `data-theme` attribute on the root element (`<html>` or `<body>`).

```css
:root,
[data-theme="light"] {
  /* ...light tokens (see §2)... */
}

[data-theme="dark"] {
  /* ...dark tokens (see §2)... */
}
```

Components then reference tokens only:

```css
.card {
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  border-radius: 14px;
}
```

> Token names in Figma use a `category/name` convention (e.g. `surface/raised`,
> `text/dim`). In CSS this maps to `--surface-raised`, `--text-dim`, etc.
> (slash → hyphen). Pick one mapping and use it everywhere.

### Theme toggle

A pill toggle lives at the bottom of the sidebar in the **OTHER** section. It
shows a **moon** icon + label `Dark` while in light mode, and a **sun/light**
icon + label `Light` while in dark mode. The toggle persists the user's choice
(e.g. `localStorage`) and should respect `prefers-color-scheme` on first load.

---

## 2. Color tokens

All colors below come directly from the Figma variable definitions for each
frame. The two columns are the **same token** resolved in each theme.

### Surfaces & background

| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg/page` | `#f4f5f8` | `#0b0e1f` | App canvas / page background |
| `surface/raised` | `#ffffff` | `#1a1f3d` | Cards, panels, top-bar pills, popovers |
| `surface/sunken` | `#f4f5f8` | `#131734` | Insets inside cards (kanban columns, segmented control track) |
| `surface/sidebar` | `#141464` *(= accent/brand)* | `#131734` | Left navigation sidebar |

> **Sidebar note:** In **light** mode the sidebar uses the deep indigo brand
> color (`accent/brand` `#141464`). In **dark** mode it uses the dedicated
> `surface/sidebar` token (`#131734`). Treat the sidebar background as
> `surface/sidebar` in both themes and define `surface/sidebar = #141464` for
> light.

### Borders

| Token | Light | Dark | Usage |
|---|---|---|---|
| `border/default` | `#e4e5ea` | `#2a3056` | Card / control / input borders |
| `border/soft` | `#eff0f3` | `#1f2542` | Internal dividers, list row separators, progress track |

### Text

| Token | Light | Dark | Usage |
|---|---|---|---|
| `text/primary` | `#1f1f2e` | `#f3f4f8` | Headings, key values, primary labels |
| `text/mid` | `#4a4f5e` | `#b3b8cc` | Secondary metadata (dates, % on cards) |
| `text/dim` | `#8b91a3` | `#7b82a0` | Section captions, placeholders, muted labels |
| `text/on-accent` | `#ffffff` | `#ffffff` | Text/icons on brand or status fills (incl. sidebar nav) |

### Brand / accent

| Token | Light | Dark | Usage |
|---|---|---|---|
| `accent/brand` | `#141464` | `#7388ff` | Primary brand color, active nav text (light), links/CTAs |
| `accent/brand-soft` | `#e8eaf5` | `#2a3260` | Soft brand chips ("12 d" badges), section captions in sidebar |

### Status (semantic feedback)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `status/green` | `#0f6e56` | `#2dd4a4` | Positive delta text, "ON TRACK" |
| `status/green-soft` | `#d8efe7` | `#1d4050` | Positive chip background |
| `status/red` | `#e8151b` | `#ff5158` | Negative delta text, "BEHIND", "HIGH", avatar badge |
| `status/red-soft` | `#ffe4e5` | `#432842` | Negative chip background |
| `status/amber` | `#f2994a` | `#fcb85b` | Warning text, "AT RISK", "MEDIUM", "REVIEW" |
| `status/amber-soft` | `#fdf0d9` | `#433b42` | Warning chip background |

### Chart palette (categorical)

Use in this order for series, legends, and donut/segment fills.

| Token | Light | Dark |
|---|---|---|
| `chart/green` | `#2bb174` | `#2dd4a4` |
| `chart/indigo` | `#5969e1` | `#7388ff` |
| `chart/blue` | `#4ea7fc` | `#4ea7fc` |
| `chart/purple` | `#7f77dd` | `#7f77dd` |
| `chart/pink` | `#e67be0` | `#e67be0` |
| `status/red` | `#e8151b` | `#ff5158` |
| `status/amber` | `#f2994a` | `#fcb85b` |

### Toggle / segmented control

| Token | Light | Dark | Usage |
|---|---|---|---|
| `toggle/active` | `#ffffff` | `#7388ff` | Active segment background |
| `toggle/active-text` | `#1f1f2e` | `#ffffff` | Active segment label |

### Full CSS token block (copy/paste)

```css
:root,
[data-theme="light"] {
  --bg-page: #f4f5f8;
  --surface-raised: #ffffff;
  --surface-sunken: #f4f5f8;
  --surface-sidebar: #141464;

  --border-default: #e4e5ea;
  --border-soft: #eff0f3;

  --text-primary: #1f1f2e;
  --text-mid: #4a4f5e;
  --text-dim: #8b91a3;
  --text-on-accent: #ffffff;

  --accent-brand: #141464;
  --accent-brand-soft: #e8eaf5;

  --status-green: #0f6e56;
  --status-green-soft: #d8efe7;
  --status-red: #e8151b;
  --status-red-soft: #ffe4e5;
  --status-amber: #f2994a;
  --status-amber-soft: #fdf0d9;

  --chart-green: #2bb174;
  --chart-indigo: #5969e1;
  --chart-blue: #4ea7fc;
  --chart-purple: #7f77dd;
  --chart-pink: #e67be0;

  --toggle-active: #ffffff;
  --toggle-active-text: #1f1f2e;
}

[data-theme="dark"] {
  --bg-page: #0b0e1f;
  --surface-raised: #1a1f3d;
  --surface-sunken: #131734;
  --surface-sidebar: #131734;

  --border-default: #2a3056;
  --border-soft: #1f2542;

  --text-primary: #f3f4f8;
  --text-mid: #b3b8cc;
  --text-dim: #7b82a0;
  --text-on-accent: #ffffff;

  --accent-brand: #7388ff;
  --accent-brand-soft: #2a3260;

  --status-green: #2dd4a4;
  --status-green-soft: #1d4050;
  --status-red: #ff5158;
  --status-red-soft: #432842;
  --status-amber: #fcb85b;
  --status-amber-soft: #433b42;

  --chart-green: #2dd4a4;
  --chart-indigo: #7388ff;
  --chart-blue: #4ea7fc;
  --chart-purple: #7f77dd;
  --chart-pink: #e67be0;

  --toggle-active: #7388ff;
  --toggle-active-text: #ffffff;
}
```

---

## 3. Typography

The product uses **Open Sans** throughout, leveraging its weight range. Use
`font-variation-settings: "wdth" 100` (normal width) for the variable font.

**Font family:** `'Open Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`

### Weights in use

| Weight | CSS | Used for |
|---|---|---|
| Regular | `400` | Body / descriptive sub-text |
| SemiBold | `600` | Nav items, list item titles, legend labels |
| Bold | `700` | Pill labels, metadata, sub-brand text |
| ExtraBold | `800` | Page title, metric values, section captions, KPI numbers |

### Type scale

| Role | Size | Weight | Color token | Notes |
|---|---|---|---|---|
| Page title (H1) | `22px` | ExtraBold | `text/primary` | e.g. "Hi Alex, here's your day" |
| KPI / metric value | `22px` | ExtraBold | `text/primary` | Card numbers ($, %, counts) |
| Donut center value | `30px` | ExtraBold | `text/primary` | Large focal stat |
| Card / item title | `12.5px–13px` | ExtraBold / Bold | `text/primary` | Kanban card title, list row title |
| Body text | `11px–12px` | Regular | `text/dim` | Descriptions, secondary lines |
| Nav item | `12.5px` | SemiBold | `text/on-accent` (active: `accent/brand`) | Sidebar links |
| Section caption | `9px–11px` | ExtraBold | `text/dim` | UPPERCASE, `letter-spacing: 0.4–0.5px` |
| Eyebrow / breadcrumb | `11px` | Bold | `text/dim` | UPPERCASE, e.g. "SWITCHBOARD · DASHBOARD" |
| Pill / badge | `9px–11px` | ExtraBold / Bold | status or accent token | UPPERCASE for status |
| Micro metadata | `9.5px–10px` | Bold | `text/mid` / `text/dim` | Dates, percentages, goals |
| Brand wordmark | `13px` / `9px` | ExtraBold / Bold | `text/on-accent` / `text/dim` | "LUMINEO SIGNS" / "SWITCHBOARD" |

**Rules**
- Section captions and status badges are always **UPPERCASE** with letter-spacing.
- Numeric values (currency, %, counts) are **ExtraBold**.
- Never use a font size below `9px`.

---

## 4. Spacing, radius & elevation

### Spacing scale (px)
`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 24 · 28 · 32`

Use multiples from this scale for padding, gaps, and margins. Common patterns:
- **Card padding:** `16px` (`p-16`); compact cards `12px 16px`.
- **Inter-card gap:** `16px` in a row; `18px` between major sections (rows).
- **Main content padding:** `22px` top, `32px` bottom, `28px` left/right.
- **Sidebar padding:** `18px` top, `24px` bottom, `14px` sides.
- **Nav item padding:** `9px 10px`, `12px` gap between icon and label.

### Border radius

| Token | Value | Usage |
|---|---|---|
| Pill / fully round | `999px` | Badges, chips, search bar, segmented control, avatar, toggle |
| Card | `14px` | KPI cards, panels, main content cards |
| Inset block | `12px` | Kanban columns / sunken containers |
| Small card | `10px` | Kanban task cards |
| Nav active tab | `8px` | Sidebar nav item |
| Swatch | `3px` | Legend color squares |

### Borders & elevation
- Cards use a **1px solid `border/default`** border. The design is **flat** —
  it relies on borders + surface contrast rather than drop shadows. Avoid heavy
  shadows; if depth is needed, use a very subtle shadow only.
- Internal dividers (list rows, sidebar brand divider) use **1px `border/soft`**.
- Progress-bar tracks use `border/soft`; fills use the relevant chart/status color.

---

## 5. Global layout

Every full application screen follows the same **two-region shell**:

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Topbar (breadcrumb + title │ search · actions)│
│  Sidebar   ├──────────────────────────────────────────────┤
│  (248px)   │                                              │
│            │   Main content area                          │
│  nav +     │   (bg/page, padding 22/28/32,               │
│  theme     │    18px vertical gaps between sections)      │
│  toggle    │                                              │
└────────────┴──────────────────────────────────────────────┘
```

- **Frame size reference:** `1440 × 1034`.
- **Sidebar:** fixed width **248px**, `surface/sidebar` background, full height.
- **Main:** flexes to fill, `bg/page` background, vertical flex with `18px` gap.
- **Content max-width:** content rows align to the main area (~1136px usable
  width at 1440 frame). Cards flex evenly within rows.

---

## 6. Core components

All components must be theme-token driven and consistent across every app screen.

### 6.1 Sidebar navigation
- Background `surface/sidebar`; full height; brand block at top separated by a
  `border/soft` bottom border.
- **Brand block:** logo (36px) + "LUMINEO SIGNS" (ExtraBold 13) over
  "SWITCHBOARD" (Bold 9, `text/dim`, tracked).
- **Section captions:** `MAIN`, `APPS`, `OTHER` — ExtraBold 9, `accent/brand-soft`,
  UPPERCASE, tracked, with `8px` top padding.
- **Nav item:** icon (20px) + label (SemiBold 12.5, `text/on-accent`), `9px 10px`
  padding, `8px` radius, `12px` gap.
- **Active nav item:** background `bg/page` (light) / `surface/raised` (dark),
  label color `accent/brand`. In light mode the active item reads as a white tab
  protruding from the indigo sidebar (left side flush, `rounded-left` only).
- **Theme toggle pill** + **Settings** + **Help** sit in the `OTHER` section at
  the bottom.

### 6.2 Topbar
- Left: eyebrow breadcrumb (Bold 11, `text/dim`, UPPERCASE) above page title
  (ExtraBold 22, `text/primary`).
- Right cluster (`10px` gap):
  - **Search field:** `surface/raised`, `border/default`, pill, `380px` wide,
    `14px/7px` padding, `⌕` glyph + placeholder (`text/dim`).
  - **Secondary action button:** pill, `surface/raised`, `border/default`, icon +
    Bold 12 label (e.g. "Edit dashboard").
  - **User chip:** pill with circular avatar (32px, `status/red` fill, initials in
    ExtraBold 11 `text/on-accent`) + name (Bold 12) over role (Bold 10, `text/dim`,
    UPPERCASE).

### 6.3 KPI / metric card
- `surface/raised`, `border/default`, radius `14px`, height ~`101px`, width ~`278px`.
- Caption (Bold 10, `text/dim`, UPPERCASE, tracked) → value (ExtraBold 22,
  `text/primary`) → footer row with goal text (Bold 9.5, `text/dim`) and a
  **delta chip**.
- **Delta chip:** soft status background (`status/green-soft` / `status/red-soft`),
  status-colored ExtraBold 11 text, pill, `8px/2px` padding, with `▲`/`▼` arrow.
- KPI cards live in a **horizontally scrollable row** with a custom thin scrollbar
  (`7px` tall, translucent gray, `border/default`, rounded).

### 6.4 Panel / section card
- `surface/raised`, `border/default`, radius `14px`.
- Header caption: ExtraBold 11, `text/dim`, UPPERCASE, tracked, `10px/16px` padding.
- Body padded `16px` (or `0 16px` for list panels).

### 6.5 List rows (e.g. "Upcoming Target Dates")
- Row separated by `border/soft` bottom border (last row borderless),
  `10px` vertical padding, `12px` gap.
- Layout: fixed-width date column (date ExtraBold 12 + soft accent "N d" chip) →
  flexible title/subtitle column (Bold 13 title, Regular 11 `text/dim` subtitle) →
  trailing **status chip**.
- **Status chip:** soft status background + status-colored ExtraBold 9.5 UPPERCASE
  text (`BEHIND` / `ON TRACK` / `AT RISK`), pill, `8px/3px`.

### 6.6 Segmented control / toggle
- Track: `surface/sunken`, `border/default`, pill, `2px` padding.
- Active segment: `toggle/active` background, `toggle/active-text` label (Bold 11),
  pill, `12px/5px`.
- Inactive segment: transparent, `text/dim` label.

### 6.7 Kanban board
- Columns: `surface/sunken`, `border/soft`, radius `12px`, `12px` padding,
  `10px` gap, flex even.
- **Column header:** colored status dot (8px) + ExtraBold 11 UPPERCASE title +
  count badge (`surface/raised`, `border/default`, pill, ExtraBold 10 `text/dim`).
  Column dot colors: To Do = `chart/indigo`, In Progress = `chart/blue`,
  Review = `status/amber`, Completed = `chart/green`.
- **Task card:** `surface/raised`, `border/default`, radius `10px`, `12px/10px`
  padding, `4px` gap. Contains a **priority chip** (HIGH=`status/red`,
  MEDIUM=`status/amber`, LOW=`status/green`, soft bg), title (ExtraBold 12.5),
  description (Regular 11 `text/dim`), a meta row (Bold 10 `text/mid`: date +
  percent), and a **progress bar**.
- **Progress bar:** track `border/soft`, fill in the matching status/chart color,
  height `4px`, pill.

### 6.8 Donut / chart + legend
- Donut with center label (ExtraBold 30 value + ExtraBold 9 `text/dim` caption).
- Legend rows: color swatch (10px, radius 3px) + label (SemiBold 12) + value
  (ExtraBold 12). Series colors follow the **chart palette** order in §2.

### 6.9 Badges & chips (summary)
| Type | Background | Text | Shape |
|---|---|---|---|
| Status (ON TRACK/BEHIND/AT RISK) | `status/*-soft` | `status/*` ExtraBold UPPERCASE | pill |
| Priority (HIGH/MEDIUM/LOW) | `status/*-soft` | `status/*` ExtraBold UPPERCASE | pill |
| Delta (▲/▼) | `status/*-soft` | `status/*` ExtraBold | pill |
| Count | `surface/raised` + `border/default` | `text/dim` ExtraBold | pill |
| Duration ("12 d") | `accent/brand-soft` | `accent/brand` Bold | pill |

---

## 7. Iconography
- Line / solid icon set at **20px** for nav, **14–18px** for inline/topbar icons.
- Nav icons inherit `text/on-accent` (active item: `accent/brand`).
- Keep icon style consistent (single weight family) across all apps.

---

## 8. Accessibility
- Maintain **WCAG AA** contrast: body text vs background ≥ 4.5:1, large/bold text
  ≥ 3:1. The token pairs above are tuned per theme to meet this — do not mix a
  light-theme text token onto a dark-theme surface.
- Status is never communicated by **color alone** — always pair with a label
  (`ON TRACK`, `BEHIND`) or icon (`▲`/`▼`).
- Interactive elements need a visible focus ring (use `accent/brand` outline).
- Minimum touch/click target ~32px height for pills, buttons, nav items.

---

## 9. Rules for new applications & screens

When building **any** new app or screen in Switchboard:

1. **Reuse the shell** — sidebar (248px) + topbar + `bg/page` main area with the
   standard padding and `18px` section gaps.
2. **Tokens only** — never hard-code colors, and always provide both light and
   dark values via the token system. Test every screen in **both** themes.
3. **Reuse components** from §6 (cards, panels, list rows, chips, segmented
   control, kanban, charts) rather than inventing new ones. If a genuinely new
   component is needed, build it from the same tokens, spacing scale, radii, and
   typography, and add it to this document.
4. **Typography** — Open Sans, the scale in §3, UPPERCASE tracked captions,
   ExtraBold numeric values.
5. **Spacing & radius** — only values from §4.
6. **Status semantics** — green = good/on-track, amber = warning/at-risk,
   red = bad/behind/high, with the soft variant for fills.
7. **Keep it flat** — borders + surface contrast over heavy shadows.
8. **Update this file** whenever the Figma source changes so it stays the single
   source of truth.
