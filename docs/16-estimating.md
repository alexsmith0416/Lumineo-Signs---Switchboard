# Estimating — Power Apps Code App

This document is the spec for the Estimating sub-app. The app lives at
`apps/estimating/` in this monorepo and follows the conventions
established by the existing Switchboard design commits.

Tracked in Linear: **Estimating — Power Apps Code App** (issues
ALE-234 → ALE-246).

---

## Source of truth — the workbook

The estimating logic lives in:

- `reference/estimating/Sign365 LN Estimate Template - Blank.xlsx` — the
  formulas without any filled-in data.
- `reference/estimating/Sign365 LN Estimate - CNB.xlsx` — the **CNB
  job (J36938)**, a real filled estimate used as the acceptance fixture.
  CNB replaces the MERITRUST job referenced in the original draft of
  this spec — it is larger and exercises a wider mix of sign types.

The `scripts/extract-workbook.py` script reads the blank workbook with
`openpyxl` and emits three TypeScript modules under
`apps/estimating/src/data/`:

| Output | Source sheet | Notes |
|---|---|---|
| `catalog.ts` | `Inv` | 1,269 real inventory items (Description, No., Unit Cost, Unit Price, Base UoM, Profit %). |
| `workcodes.ts` | `WC` | 25 work codes + the shop labor rate (now **$97/hr** — the 1-1-26 increase from the historical $92). |
| `rates.ts` | `RateData` | 51 single named rates + 9 sqft-threshold lookup tables (pan, post & panel, routed cabinet, acrylic cabinet, flex cabinet, polecover, reveal, crown, EMC). The piece sheets read column **D** of the lookup tables; that is the column the extractor consumes. Hour-rounding factor `B84 = 0.25`. |

Run via `npm run extract:estimating` from the repo root.

Piece-type definitions live in
`apps/estimating/src/data/pieceTypes.ts` and are hand-encoded after
inspecting each visible sheet. Every entry carries a
`workbookSheet` pointer and `references` cell-list so the next author
can pick up the math without re-tracing where it came from.

## Engine

`apps/estimating/src/lib/engine.ts` is the only place that computes
totals:

- `computePiece(piece)` — runs the type's `compute` to get sqft, labor
  lines, and material lines; resolves catalog unit prices and work-code
  hourly rates.
- `computeProject(project)` — aggregates pieces.
- `aggregateForBC(project)` — collapses every piece's lines into the
  BCI (materials by item #) and BCL (labor hours by resource #) shapes
  Business Central imports.

The four formulas explicitly anchored in the original build prompt
are implemented end-to-end and unit-tested in
`src/__tests__/engine.test.ts`:

- **Apply Vinyl Graphics** — `sqft = (H * L / 144) * qty`,
  labor 2416 hours = `CEILING(sqft / (Flat 32 | PushThrough 15), 0.5)`.
- **Vinyl Cutting** — `sqft = CEILING((H * L) / 144, 4) * qty`,
  labor 2415 hours = `CEILING(sqft / 20, 0.25)`.
- **Paint Calculation** — `sqft = (H * L / 144) * faces`, material
  `EST PAINT - CUSTOM` units = `ROUND(sqft * 100)` grams, labor 2110
  hours = `sqft / 20`, labor 2112 hours = `sqft / 25`.
- **Routed Panel Shapes** — `sqft = (H * L / 144) * panels`, labor
  2010 = 1 hr setup + routing hours = `sqft / 50`.

Every other piece type ships as a `status: 'todo'` stub: its input
shape is fully defined (so the UI renders forms for all ~25 types) and
its `compute` returns sqft 0 with a note pointing back to the
workbook sheet. The next author replaces those compute functions.

## App

- **Header** — Job # (`J####`), Job name, Estimator, Description.
- **Project list** + create new (persisted to `localStorage` via the
  `LocalEstimateRepo` impl behind a `EstimateRepo` interface — Dataverse
  swap-in later, ALE-234/236).
- **Add a sign piece** → pick any of the ~25 types → per-type input
  cascade renders → sqft + default labor auto-compute → add materials
  via a searchable picker over the full ~1,269-item catalog (search by
  description or item #) → enter units → live line/piece/project
  totals. Multiple pieces per estimate, including multiples of one
  type. Extra labor lines can be added at any work code with editable
  hours.
- **BC Export view** — aggregates all pieces into BCI material lines +
  BCL labor lines (run time summed by resource); the
  **Download .xlsx** button produces a real Excel file via SheetJS in
  the exact BCI/BCL shape the workbook imports.
- **Proposal summary** — short plain-language sign description per
  piece (`buildProposal` in `src/lib/proposal.ts`).
- **Sign Builder Pro import** — `importFromSBP(spec)` stub in
  `src/lib/sbpImport.ts` maps SBP categories to Estimating piece-type
  ids and pre-fills H/L/qty/faces/panels + optional vinyl material
  line. The actual SBP wire-up is `TODO`.

## Design + platform

- Uses the design tokens from `packages/ui` (`@lumineo/ui`) — navy
  `#141464`, navy-light `#2a2a8a`, navy-bg `#e8eaf5`, red `#E8151B`,
  red-dark `#c4111a`, Open Sans, 64px header, radii `sm5 / md7 / lg10`.
- Mobile-responsive: two-column piece-list/detail collapses to one
  column below 900px; usable at 600 / 900 / 1200.
- Data layer behind `CatalogRepo` / `EstimateRepo` interfaces so a
  Dataverse implementation can plug in without touching the UI.
- Power Apps code app: `pac code init` has been run, `power.config.json`
  is committed, `vite base './'` set, and `pac code push` will register
  the app on first deploy.

## Acceptance

The CNB job (J36938) reconciles **to the cent** against the workbook:

| | Workbook | Engine |
|---|---|---|
| BCI material subtotal | $12,637.205 | $12,637.205 |
| BCL labor subtotal ($97/hr × 11 lines) | $17,393.3125 | $17,393.3125 |
| **Project total** | **$30,030.5175** | **$30,030.5175** |

Asserted in `src/__tests__/cnb-acceptance.test.ts`, plus the four
verified piece-type formulas in `src/__tests__/engine.test.ts`, plus
the BC export shape contract in `src/__tests__/bc-export.test.ts` (17
tests, all passing).

To run: `npm run test --workspace apps/estimating`.
To build: `npm run build --workspace apps/estimating`.
