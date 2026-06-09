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
- **Sign Builder Pro handoff (live)** — when an estimator clicks
  **Send to Estimating** on a built sign in Sign Builder Pro, SBP opens
  `https://estimating.lumineosigns.com/#import?payload=<base64url-json>`.
  The reader on this side is `src/lib/sbpPayload.ts`
  (`parseSBPPayloadFromHash` → validate `version === 2` → `projectFromPayload`).
  `App.tsx` runs it on mount **and** on `hashchange`, so the handoff fires
  whether SBP opens a fresh tab or navigates an already-open one. It builds
  a new `Project` from the header fields (`signName`/`projectName` →
  `jobName`, `productCode`/`specId`/`jobId` → `description`), maps each
  `EstimatingPieceDraft` to a `Piece` (typeId + inputs + optional
  extra material/labor lines), activates it, shows a confirmation banner,
  and clears the URL hash so a refresh doesn't re-import. The estimator
  reviews and finalizes — nothing auto-saves to BC. The canonical contract
  (payload schema + SBP→Estimating typeId mapping) lives in
  `docs/estimating-integration.md` on the SBP branch; round-trip is covered
  by `src/__tests__/sbp-payload.test.ts`. The older
  `importFromSBP(spec)` category stub in `src/lib/sbpImport.ts` remains for
  callers that hand over a single loose spec object rather than the URL
  payload.

## Design + platform

- Adopts the **Switchboard design system** (`DESIGN.md`): the standard
  two-region shell (248px `Sidebar` + `Topbar` + `bg/page` main), the
  semantic light/dark token set (driven by `data-theme` on `<html>`, with
  the legacy `--color-*` names aliased onto the tokens), Open Sans, the
  spacing/radius scale, and the shared component patterns (segmented
  control, panels, list rows, chips). A theme toggle pill in the sidebar
  **OTHER** section persists the choice and respects
  `prefers-color-scheme` (`src/ui/useTheme.ts`). Test every screen in both
  themes.
- Mobile-responsive: the estimates panel + piece-list/detail collapse to
  one column on narrow viewports; the sidebar hides below 820px.
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
