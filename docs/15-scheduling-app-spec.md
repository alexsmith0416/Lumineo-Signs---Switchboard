# 15 — Lumineo Scheduling Hub: Build Specification

The blueprint for converting the React/TypeScript prototype at `scheduling-app/` into the production Code App. Read this end-to-end before starting the production build.

> This document is the **source of truth** for what the production app must do, look like, and behave like. The prototype demonstrates every interaction in this spec against mock data; the production build replaces the mock data sources with real Power SDK / Dataverse / Business Central calls without changing any engine logic, UI behavior, or visual styling.

## Quick links

- **Working prototype:** `scheduling-app/` on branch `claude/intelligent-cray-ffmS4`
- **Prototype CLAUDE.md:** [`scheduling-app/CLAUDE.md`](../scheduling-app/CLAUDE.md)
- **Linear project:** [Lumineo Scheduling Hub](https://linear.app/lumineosigns/project/lumineo-scheduling-hub-b4e29b417bee)
- **Standalone preview:** `npm run build` in `scheduling-app/` then run `node /tmp/inline.mjs` (or use the bundled `dist/`)

## Current prototype state (as of latest commit)

| Surface | Status |
|---|---|
| Production calendar | ✅ Drag/move + drag/resize with cascade-confirm dialog, dept-color cards, sticky resource column + dept label, hover tooltips, edit panel, custom-card creation, print 🖨 button |
| Installation calendar | ✅ WK ↔ NEK toggle, `$` / weather / crew toggles, stacked 3-row cards, real WK + NEK rosters, monthly goal tracking, Add Job parity with Production |
| Shipping calendar | ✅ Same engine, trucks-as-resources |
| Scenario Sandbox | ✅ Auto-enters, kind tabs (Production / Install · WK / NEK / Shipping) with change-count badges, embedded read-only calendar preview |
| Monthly Install Plan | ✅ Combined billing roll-up, per-week mini-cards vs `$1.1M` goal, AI auto-fill respecting both dollar headroom and per-region crew availability |
| Custom (non-BC) cards | ✅ 7 presets (PTO / Inventory / Truck Maint / Med Cert / DOT / Crane Cert / Holiday) all locked-by-default; Holiday auto-applies to all employees |
| Cascade-aware confirm | ✅ Dialog with Cancel / Move only this / Try in Sandbox / Continue, red pulse on affected cards |
| Mobile responsive | ✅ Hamburger nav drawer, portrait layout under 720 px, sticky resource column + dept label during horizontal scroll, iOS touch-drag polyfill |
| Engine | ✅ 47 unit tests, business-hour anchored capacity walker, cascade with 200-iteration safety cap |
| Real data | ⛔ Stubbed throughout `services/*-data.ts`, `bc.ts`, `WeatherChip.tsx`, `zip-geo.ts` — this spec is the contract for swapping them out |

## Companion docs (already in this repo — read them too)

- [01 — Architecture Overview](01-architecture-overview.md) — Switchboard shell + sub-app pattern
- [04 — Dataverse Schema](04-dataverse-schema.md) — shared tables + BC integration shape
- [09 — Weather Card Spec](09-weathercardspec.md) — `WeatherCache` table + OpenWeatherMap connector
- [10 — Crew & Truck Indicator Spec](10-crewtruckindicatorspec.md) — `CrewAssignment` table + BC `lumCrewType`
- [13 — Airtable Bridge Mapping](13-airtable-bridge-mapping.md) — interim until BC API access lands
- [14 — BC Write Operations](14-bc-write-operations.md) — queued BC write payload schemas

---

## 1. Project scope

The Lumineo Scheduling Hub is a unified scheduling surface for three operations:

- **Production** — employees grouped by department (Routing → Metal Fab → Paint → Assembly → Vinyl/Graphics → Steel MFG), drag/resize with dependency cascade, conflict detection.
- **Installation** — install crews grouped by region (WK / NEK toggle), with per-card weather chips, crew/truck badges, invoice $ amount, and a monthly invoicing-goal tracker.
- **Shipping** — trucks grouped by vehicle type, same calendar mechanics.

Plus three planning views:

- **Scenario Sandbox** — workspace cloned from the live schedule for what-if planning (overtime, weekends, shift task, rush job) with diff, impact metrics, and atomic commit.
- **Monthly Install Plan** — month-aggregated billing across both regions vs `$1,100,000` goal, per-week mini-cards, AI auto-fill that greedily packs install-candidate jobs to close the gap.
- **Cascade-aware move confirmation** — before any drag or resize that would shift downstream tasks, surface a modal listing what would shift with options to cancel, move-only, try in sandbox, or continue with cascade.

Plus a **custom (non-BC) card** facility — PTO, Holiday, Maintenance, Med Cert, DOT Physical, Crane Cert, Inventory — that block out time on a resource without tying to a job.

---

## 2. Tech stack

| Layer | Prototype | Production |
|---|---|---|
| Build | Vite + React 18 + TypeScript | Power Code App (Vite + React 18 + TypeScript) |
| State | Zustand — 4 schedule stores (production / WK install / NEK install / shipping) + 4 scenario stores (one per schedule store, via `createScenarioStore` factory) + 1 scenario preview store | Same — Zustand keeps its shape |
| Engine | Pure TS, only `date-fns` imported | Same |
| Touch-drag polyfill | `mobile-drag-drop` (~10 kB, wired in `main.tsx`) | Keep — iOS Safari needs it; Power Code Apps still render in a browser engine |
| Routing | None — view state in `App.tsx` `useState` | Same; consider URL hash sync for shareable deep links |
| Persistence (live) | `createMockDataSource()` returning in-memory mocks | **Power SDK** bindings against Dataverse tables. Until BC admin lands, Dataverse is mirrored from Airtable via a Power Automate sync flow (see §8.6) |
| BC search | Mock fixed list in `services/bc.ts` | **BC analytics connector** — `jobPlanningLines` / `jobs` (microsoft/analytics/v1.0). Same flow until BC API access lands. |
| Weather | Deterministic hash mock in `WeatherChip.tsx` | **OpenWeatherMap One Call 3.0** via Power Automate custom connector + `WeatherCache` Dataverse table |
| Crew/truck | Static columns on mock schedule lines | **BC `lumCrewType` purchase lines** → nightly `RecomputeCrewAssignments` flow → `CrewAssignment` Dataverse table |
| Auth | None (open dev server) | **Entra ID** through the Switchboard shell |
| ZIP geo | Inline table for the ~20 ZIPs in mocks | **`bc_ZipGeo`** Dataverse table (~42k US ZIPs, one-time import) |

The engine, stores, UI components, brand styles, and interaction logic transfer verbatim. The substitution is purely at the I/O boundary (`src/services/*`).

---

## 3. Architecture

### 3.1 Layering

```
            ┌─────────────────────────────────────────────┐
            │  App.tsx + AppHeader + NavDrawer            │  presentation shell
            └────────────────────┬────────────────────────┘
                                 │
   ┌─────────────────┬───────────┴────────┬──────────────────────┐
   ▼                 ▼                    ▼                      ▼
ProductionCalendar  InstallationCalendar  ShippingCalendar       ScenarioSandbox / MonthlyPlanView
   │                 │                    │                      │
   └─────────────────┴─────── CalendarView ───────────────────────┘
                                 │
                                 │  drag / resize / click
                                 ▼
                ┌────────────────────────────────┐
                │  Engine (pure TypeScript)      │
                │  types · capacity · time-walker│
                │  cascade · conflicts · scenarios│
                └────────────────┬───────────────┘
                                 │
   ┌─────────────────────────────┼─────────────────────────────┐
   ▼                             ▼                             ▼
ScheduleStore               ScenarioStore             ScenarioPreviewStore
(createScheduleStore)       (production-bound)        (no-op-backed, hydrated)
   │
   ▼
Services / Data Source (I/O boundary — STUB BOUNDARY)
   ├── dataverseService (production)
   ├── installationData (WK + NEK)
   ├── shippingData
   ├── bcService
   ├── planning-line-mapping
   ├── auto-schedule
   └── zip-geo
```

### 3.2 Module map

```
scheduling-app/src/
├── App.tsx                     — shell + view state + nav drawer mount
├── main.tsx                    — React root + mobile-drag-drop polyfill init
├── components/
│   ├── AppHeader.tsx           — navy header, hamburger button (≡)
│   ├── NavDrawer.tsx           — left-slide drawer, role=dialog, Escape closes, autofocus
│   ├── CalendarView.tsx        — generic Gantt grid; accepts useStore + scenarioStore props,
│   │                              Today/Print/Prev/Next, sticky resource column,
│   │                              cascade-aware drop/resize, lane-allocated overlay cards
│   ├── ProductionCalendar.tsx  — wraps CalendarView + AddJobPanel (production store)
│   ├── InstallationCalendar.tsx— wraps CalendarView w/ WK↔NEK toggle, $/🌤/crew toggles,
│   │                              region-specific scenario store
│   ├── ShippingCalendar.tsx    — wraps CalendarView (shipping store)
│   ├── ScenarioSandbox.tsx     — auto-enters; kind tabs (Production/Install·WK/NEK/Shipping)
│   │                              with change-count badges; renders ChangeBuilder + Impact
│   │                              + Diff + read-only CalendarView preview
│   ├── MonthlyPlanView.tsx     — month roll-up + AI auto-fill with crew capacity budget
│   ├── AddJobPanel.tsx         — slide-over with BC Job ↔ Custom Card tabs;
│   │                              custom mode has 7 presets + apply-all + lock checkboxes
│   ├── EditJobPanel.tsx        — slide-over for editing existing line
│   ├── JobCard.tsx             — single card; portal tooltip, custom-color, stacked install layout
│   ├── CrewBadge.tsx           — "2M 1T" / "4M 2T 1L" chip
│   ├── WeatherChip.tsx         — compact + expanded variants (mock backed)
│   ├── CascadeConfirmDialog.tsx— pre-commit modal with 4 options; role=alertdialog, Escape closes
│   ├── WeekSummary.tsx         — top stats strip (utilization, scheduled, capacity,
│   │                              billing-week, both-regions-week, billing-month, monthly-goal)
│   ├── LumineoLogo.tsx         — inline SVG
│   └── scenario/
│       ├── ScenarioBanner.tsx  — amber pinned banner, accepts useStore prop
│       ├── ChangeBuilder.tsx   — accepts useStore + useScheduleStore props
│       ├── ImpactSummary.tsx   — accepts useStore prop
│       ├── ScheduleDiff.tsx    — accepts useStore prop
│       └── forms/{Overtime,Weekends,ShiftTask,RushJob}Form.tsx
├── engine/
│   ├── index.ts                — barrel re-exports
│   ├── types.ts                — ScheduleLine (w/ optional invoice/crew/weather/region/custom fields),
│   │                              Employee, Department, ScenarioChange, etc.
│   ├── capacity.ts             — getDayCapacity, effectiveHours, getHoursUsedOnDay
│   ├── time-walker.ts          — calculateEndTime with 8am-4pm business-hour anchor
│   ├── cascade.ts              — shiftTask, updateDuration, cloneContext;
│   │                              MAX_ITERATIONS=200 with console.warn on cap-hit
│   ├── conflicts.ts            — detectConflicts (past-due, employee-overlap, dept-order)
│   ├── scenarios.ts            — runScenario, commitScenario, computeImpact
│   ├── *.test.ts               — 47 unit tests (locked-PTO cascade-flow-around included)
│   └── __fixtures__/build.ts   — test fixtures
├── hooks/
│   ├── useJobSearch.ts         — debounced BC search with session cache
│   └── useLivePreview.ts       — engine-driven preview of end-time as user edits
├── services/
│   ├── data-source.ts          — ScheduleDataSource interface + createMockDataSource factory
│   ├── dataverse.ts            — production data source (STUB → Power SDK)
│   ├── installation-data.ts    — WK + NEK data sources (STUB → Power SDK)
│   ├── shipping-data.ts        — shipping data source (STUB → Power SDK)
│   ├── bc.ts                   — BC analytics connector (STUB)
│   ├── planning-line-mapping.ts— keyword → department mapping
│   ├── auto-schedule.ts        — proposeSchedule (earliest-legal-slot per line)
│   └── zip-geo.ts              — ZIP → City, State lookup (STUB → bc_ZipGeo)
├── store/
│   ├── schedule-store.ts       — createScheduleStore factory + 4 instances
│   │                              (useScheduleStore, useInstallationStoreWK/NEK, useShippingStore)
│   ├── scenario-store.ts       — createScenarioStore(dataSource) factory + 4 instances
│   │                              (useProductionScenarioStore, useInstallationScenarioStoreWK/NEK,
│   │                              useShippingScenarioStore); useScenarioStore aliases production
│   └── scenario-preview-store.ts — read-only preview store hydrated from scenario state
├── data/
│   ├── mock-schedule.ts        — production employees + lines
│   ├── mock-installation.ts    — WK + NEK rosters + lines (from PDFs)
│   ├── mock-shipping.ts        — trucks + delivery lines
│   ├── mock-bc.ts              — BC job catalog for search
│   ├── mock-install-candidates.ts — AI auto-fill candidate pool
│   └── custom-card-presets.ts  — 7 preset cards (PTO, Holiday, etc.)
│                                  with lockByDefault + applyAllByDefault flags
└── styles/
    └── lumineo.css             — brand tokens + every component style + @media print
```

### 3.3 Engine contract

The engine is **pure TypeScript**, imports only `date-fns`. Production swap must not touch these files.

Invariants:

1. **Purity.** Engine functions don't import React, Power SDK, Dataverse, or any service.
2. **Immutability.** `shiftTask` / `updateDuration` / `runScenario` always clone the context first via `cloneContext`. Original inputs are never mutated.
3. **Effective hours.** `(line.overrideHours ?? line.estimatedHours) / employee.productivityRate`. Rate 0 is treated as 1.
4. **Department flow.** A task at `flowOrder N` cannot start before all tasks at `flowOrder < N` in the same job have finished.
5. **Same-employee queue.** Tasks never overlap on one employee. Cascade walks each resource's queue in chronological order; later tasks that would overlap the running max-end get pushed forward.
6. **Locked tasks** (`isLocked: true`). Never move under cascade. Cascade flows around them. Conflict icons surface the violation. Custom cards from presets default to `isLocked: true` (see §4.4).
7. **Capacity walking.** `calculateEndTime` walks day by day via `getDayCapacity`. Days with 0 capacity (weekends without `worksWeekends`, manual zero overrides) are skipped, not zeroed.
8. **Business hours.** Work is anchored to 8:00–16:00. A task that would extend past 16:00 spills to the next workday's 8:00.
9. **Cascade convergence.** Iterative cascade caps at `MAX_ITERATIONS = 200`. If the cap is hit, the engine returns a partial result and logs `[cascade] hit MAX_ITERATIONS …` so ops can investigate the pathological dependency chain.

47 unit tests in `src/engine/*.test.ts` lock these in.

---

## 4. Data model

### 4.1 Engine types

Defined in [`src/engine/types.ts`](../scheduling-app/src/engine/types.ts):

```ts
export interface ScheduleLine {
  id: ScheduleLineId;
  jobNo: string;
  customerName: string;
  planningLineDescription: string;
  startDateTime: Date;
  endDateTime: Date;
  estimatedHours: number;
  overrideHours: number | null;
  employeeId: EmployeeId;
  departmentId: DepartmentId;
  customerDueDate: Date | null;
  isLocked: boolean;
  jobSequence: number;

  // Install + billing metadata (production lines leave these null)
  invoiceAmount?: number | null;
  crewPersons?: number | null;
  crewTrucks?: number | null;
  crewCranes?: number | null;
  crewLifts?: number | null;
  crewBuckets?: number | null;
  installZip?: string | null;
  region?: string | null;

  // Custom card metadata
  isCustom?: boolean;
  customColor?: string | null;
  customTextColor?: string | null;
}

export interface Employee {
  id: EmployeeId;
  name: string;
  departmentId: DepartmentId;
  productivityRate: number;          // 0..1, where 1 = 100%
  standardHoursPerDay: number;       // typically 8
  maxOvertimePerDay: number;
  worksWeekends: boolean;
  hourlyRate?: number;               // for OT cost delta in scenarios
}

export interface Department {
  id: DepartmentId;
  name: string;
  flowOrder: number;                 // 1 = earliest in chain
  color: string;                     // hex
}
```

### 4.2 Dataverse schema (production)

Maps the engine types onto the existing/needed Dataverse tables (full schema in [docs/04](04-dataverse-schema.md)).

| Engine field | Dataverse table | Column | Notes |
|---|---|---|---|
| `Employee.*` | `crfdf_employee1` | existing | Add `productivityRate` (decimal), `standardHoursPerDay` (int), `maxOvertimePerDay` (int), `worksWeekends` (bool) |
| `Department.*` | `crfdf_department1` | existing | Add `flowOrder` (int), `color` (string) |
| `ScheduleLine.*` (production) | `crfdf_productionscheduleline` | existing | Add `overrideHours` (decimal), `isLocked` (bool), `jobSequence` (int) |
| `ScheduleLine.*` (installation) | `crfdf_installationscheduleline` | **NEW** | Mirrors production line shape + adds `region` (text), `invoiceAmount` (currency), `installZip` (text). Crew counts come from the `CrewAssignment` table. |
| `ScheduleLine.*` (shipping) | `crfdf_shippingscheduleline` | **NEW** | Same shape + freight metadata |
| Custom cards | (any of the three line tables) | `isCustom`, `customColor`, `customTextColor` | Three new columns on each line table |
| Day capacity override | `crfdf_employeeworkhours` | existing | |
| OT add-on | `crfdf_overtimeoverride` | existing | |
| Planning line → dept map | `crfdf_planninglinedepartmentmap` | existing | Keyword/regex rules; current prototype mapping in `services/planning-line-mapping.ts` is a code-side fallback |
| Job estimate lines | `crfdf_jobestimateline` | existing | |

### 4.3 Business Central integration

The Code App reads BC through the analytics connector:

- `jobs (microsoft/analytics/v1.0)` — job headers (job number, customer, promised date)
- `jobPlanningLines (microsoft/analytics/v1.0)` — planning lines (line no, description, estimated hours)

The prototype's `bcService` in [`src/services/bc.ts`](../scheduling-app/src/services/bc.ts) is a mock. Replace with:

```ts
// Pseudo-code; actual connector call shape per Power Platform docs
const result = await connectors.businessCentral.jobs.query({
  $filter: `contains(no, '${normalized}')`,
});
```

J-prefix normalization: `J103101`, `j 103101`, `103101` all match (`bcService.searchJob` already does this).

Write operations (when a custom card is committed, when a scenario commits, etc.) follow [docs/14 — BC Write Operations](14-bc-write-operations.md).

### 4.4 Custom card data

[`src/data/custom-card-presets.ts`](../scheduling-app/src/data/custom-card-presets.ts) defines the 7 presets:

| id | Label | Background | Default hours | Lock by default | Apply-all by default |
|---|---|---|---|---|---|
| `pto` | PTO | `#FFC1D6` pink | 8 | ✅ | — |
| `inventory` | Inventory | `#B8E5C4` light green | 8 | ✅ | — |
| `truck-maintenance` | Truck Maintenance | `#1F5E2E` dark green | 4 | ✅ | — |
| `med-cert` | Med Cert | `#4F7DD3` blue | 2 | ✅ | — |
| `dot-physical` | DOT Physical | `#AED8F0` light blue | 2 | ✅ | — |
| `crane-cert` | Crane Cert | `#FF9248` orange | 4 | ✅ | — |
| `holiday` | Holiday - Shop Closed | `#FFD93D` yellow | 8 | ✅ | ✅ |

Behavior driven by these flags:

- `lockByDefault: true` — cards committed from this preset get `isLocked: true`, so cascade flows around them (a regular job moving won't shove a PTO day forward). User can uncheck the lock in the AddJobPanel custom form before committing.
- `applyAllByDefault: true` — the "Apply to all N resources" checkbox is pre-checked, so a single Holiday commit writes one card per employee in the current calendar's roster. The resource dropdown disables when apply-all is on.

Production: these presets can also be stored in a Dataverse `crfdf_customcardpreset` table so Ops can edit them without a code change.

---

## 5. Business rules

### 5.1 Cascade engine

When a task is moved or resized:

1. The engine clones the schedule context (immutability).
2. Applies the move/resize to the target.
3. Walks each resource's queue chronologically; any later task whose start overlaps the running max-end gets pushed to that max-end (and its own end is recomputed via `calculateEndTime`).
4. Walks all tasks; for any task whose same-job predecessors (lower `flowOrder`) end after its current start, the task is pushed.
5. Iterates until no further changes (max 200 iterations; see §3.3 invariant 9).
6. Returns `{ context, moved, conflicts }`.

`shiftTask` accepts `{ cascade: boolean, previewOnly: boolean }`. UI runs `previewOnly: true` first; if `moved.length > 1` (i.e., other tasks would shift), surfaces the **CascadeConfirmDialog** with:

- **Cancel** — discard
- **Move only this** — commits with `cascade: false`; downstream tasks keep their dates and surface conflict icons
- **Try in Sandbox** — snapshots state, pre-stages the change in the scenario sandbox (production-only today)
- **Continue with cascade** — apply normally

### 5.2 Capacity & business hours

`calculateEndTime(start, hoursNeeded, employee, ctx, ignoreLineId?)`:

1. Snap `cursor` to `start`. If `cursor.hour < 8`, set to `08:00`.
2. Loop until `remaining == 0` or 365-day lookahead:
   - If `cursor.hour >= 16`, roll to next workday 08:00.
   - Read `dayCapacity` = `getDayCapacity(employee, cursor, ctx)`. If 0, roll to next day.
   - Read `used` = sum of `effectiveHoursOnDay` for tasks on this employee covering this day, excluding `ignoreLineId`.
   - `available` = `min(dayCapacity - used, hoursUntilDayEnd)`.
   - If `remaining <= available`, return `cursor + remaining`.
   - Else `remaining -= available`, cursor = next workday 08:00.

### 5.3 Conflict detection

`detectConflicts(ctx)` returns three kinds:

- `past-due` — `line.endDateTime > line.customerDueDate`
- `employee-overlap` — two lines on the same employee with overlapping ranges
- `department-order` — within the same `jobNo`, a higher-flow-order task starts before a lower-flow-order task ends

Cards surface ⚠/⚡ icons + the hover tooltip lists the conflict messages.

### 5.4 Scenario sandbox

Implemented as a `createScenarioStore(dataSource)` factory in [`src/store/scenario-store.ts`](../scheduling-app/src/store/scenario-store.ts) with four exported instances:

- `useProductionScenarioStore` — bound to `productionDataSource`
- `useInstallationScenarioStoreWK` — bound to `wkInstallDataSource`
- `useInstallationScenarioStoreNEK` — bound to `nekInstallDataSource`
- `useShippingScenarioStore` — bound to `shippingDataSource`

`useScenarioStore` is preserved as an alias for the production store so older imports keep working.

The `ScenarioSandbox` screen has a top tab strip — Production / Install · WK / Install · NEK / Shipping — with a red badge showing each store's pending-change count. Switching tabs swaps the active store throughout the sandbox (banner, ChangeBuilder, ImpactSummary, ScheduleDiff, and the read-only CalendarView preview) and auto-enters the matching store's workspace.

The cascade-confirm dialog's "Try in Sandbox" button writes into the right scenario store via the `scenarioStore` prop on `CalendarView` — Production cards stage into the production sandbox, Install · WK cards stage into the WK install sandbox, etc.

Five change kinds:

- `shift-task` — move a line; cascade applied
- `update-duration` — change overrideHours; cascade applied
- `add-overtime` — adds an `OvertimeOverride` row; per-employee end-time rebuild only for that employee
- `enable-weekends` — flips employee's `worksWeekends`; per-employee rebuild
- `insert-rush-job` — adds N new lines on selected resources, chained via `calculateEndTime`

`computeImpact` produces:

- `rescuedJobs` — jobs that were `past-due` in base but no longer
- `pushedJobs` — jobs whose latest end moved forward
- `nowPastDue` — jobs newly `past-due`
- `overtimeCostDelta` — sum of new OT * employee.hourlyRate * costMultiplier
- `movedCount` / `newCount`

Commit produces a list of patches (line ID + changed fields). Today these go through `dataverseService.updateScheduleLine`; production wires the real Power SDK.

### 5.5 Monthly install plan + AI auto-fill

`MonthlyPlanView` aggregates billing across both regions for the current month. Per-week mini-cards visualize fill vs `monthlyGoal / numWeeks`.

**AI auto-fill algorithm** (`autofillToGoal` in `MonthlyPlanView.tsx`):

1. Sort the candidate pool by `promisedDate` ascending (urgent first), tie-broken by descending `invoiceAmount` (close the gap faster).
2. Walk candidates. Each week has two soft caps:
   - **Dollar headroom** — `monthlyGoal / numWeeks` minus the week's existing billing.
   - **Crew-day headroom per region** — `5 workdays × crewCount` of the candidate's region (WK or NEK).
3. For each candidate, compute `crewDaysNeeded = ceil(estimatedHours / 8)` and pick the first week with `dollar headroom >= candidate.invoiceAmount * 0.5` AND `regional crew headroom >= crewDaysNeeded`. Decrement both budgets.
4. Stop selecting once `runningTotal >= gap`.
5. Return `{ selected, rejected }` — rejections specify whether the cause was dollar capacity or regional crew capacity.

Candidate pool today: `INSTALL_CANDIDATES` (10 hard-coded jobs in `data/mock-install-candidates.ts`). Production sources from a Dataverse view of production lines marked `near-complete` + install lines with no scheduled date.

---

## 6. UI screens

(See screenshots in commit history on branch `claude/intelligent-cray-ffmS4` for the visual reference.)

### 6.1 Shell

- Navy header (48 px desktop, 44 px mobile portrait) with hamburger `≡` button left of the logo, Lumineo Signs red logo block, view title centered/left, three red action icons (Home / Calendar / Settings) far right.
- Hamburger opens left-slide drawer (`NavDrawer`). Drawer has logo + × close button on top, then nav items grouped by `Schedules` (Production / Installation / Shipping) and `Planning` (Monthly Plan / Scenarios). Backdrop dismisses.

### 6.2 Production calendar

- Top: `WeekSummary` strip (utilization %, scheduled h, capacity h, jobs, lines)
- Toolbar: `‹ Prev` | `Today` (outlined navy, disabled when on current week) | `Next ›` | "Week of …" label | (right-pinned outlined navy) `🖨` print button | (far right, brand red) `+ Add Job`
- Calendar grid:
  - Resource column (140 px desktop, 110/96 px mobile) — sticky-left.
  - 7 day columns (min-width 110 px) with weekend cells dimmed.
  - Department headers as colored bars (full row width) with a sticky-left label chip showing the dept name + flow order + employee count.
  - Job cards are absolutely-positioned Gantt-style — span multiple cells based on start/end dates.
  - Cards laid out in lanes per resource row when they would overlap.
- Drag-to-move: drop on a different cell triggers cascade preview (see CascadeConfirmDialog).
- Drag-to-resize: right edge has a 7 px col-resize handle. Mouse-down + drag adjusts duration (rounded to 0.25 h). Navy chip floats above showing proposed hours. Release commits via `updateTaskHours` (also goes through the cascade preview).
- Click an existing card → `EditJobPanel`.
- Click an empty cell → `AddJobPanel` pre-filled with cell context.

### 6.3 Installation calendar

Same calendar grid as production. Differences:

- **WK / NEK region toggle** in the toolbar — switches which store the grid reads from.
- **`$` toggle** (green when active) — shows/hides the invoice $ amount on each card AND in the top `WeekSummary` strip (Billing-Week / Both-Regions-Week / Billing-Month / Monthly Goal columns).
- **Weather toggle** (`🌤`) — shows/hides the weather chip on each card.
- **Crew toggle** (`2M·1T`) — shows/hides the crew/truck badge on each card.
- **Card layout = `stacked`** (3-row, 56 px tall instead of 32 px): job# + customer / description / [crew badge · weather · $]
- Departments here are base locations (Hutchinson / Wichita / Salina / Dodge City for WK; NEK Crews for NEK).

### 6.4 Shipping calendar

Same as production. Departments are vehicle types (Flatbed / Box / Hot Shot). No region toggle today, no $ toggle.

### 6.5 Monthly Plan view

- Top strip: month label, monthly goal, combined total, WK + NEK splits, progress %, gap.
- Per-week mini-cards (4-5 weeks per month) with billing totals + a target line + a colored progress bar.
- Install candidate pool table.
- **`✨ AI auto-fill to $1,100,000` button** opens a slide-over proposal with selected + rejected candidates.

### 6.6 Scenario Sandbox

- **Auto-enters** on mount (no splash). Same behavior after Commit / Discard.
- **Kind tabs** at the top — `Production` / `Install · WK` / `Install · NEK` / `Shipping`. Each tab carries a red badge with that store's pending-change count. Switching tabs swaps every panel (banner / change builder / impact / diff / preview) to read from the matching scenario + schedule store pair.
- Amber banner pinned at top: "⚠ SCENARIO SANDBOX · N pending change(s) — nothing is live yet" with `Discard` / `Commit` buttons.
- Two-column grid: `ChangeBuilder` (left, with + Overtime / + Weekends / + Shift task / + Rush job buttons) and `ImpactSummary` + `ScheduleDiff` (right).
- Below: a **read-only `CalendarView`** showing the live schedule with every staged change applied (powered by `useScenarioPreviewStore`, re-hydrated whenever scenario state or the active tab changes). Updates reactively as the user stacks changes.

### 6.7 Add Job slide-over

Top toggle: `BC Job` | `Custom Card`.

- **BC Job** mode: search bar (debounced, J-prefix normalized, cached per session). Pick a job → see planning lines mapped to departments. Three modes:
  - Single — pick one line
  - Multi — check multiple lines
  - Auto-schedule — engine proposes a slot for every line at the earliest legal time
  Live "predicted slot" times shown under each line as the user toggles modes.
- **Custom Card** mode: 7 preset chips + a "build your own" form (title, background + text color pickers with live preview, hours with Full Day / Full Week shortcuts, resource dropdown, **Apply field** with two checkboxes — "Apply to all N resources" for shop-wide events and "🔒 Lock — cascade flows around this card" for PTO/Holiday/cert immutability — and optional notes). Picking a preset auto-fills title/color/hours and toggles the lock + apply-all checkboxes per the preset's flags (all presets have `lockByDefault: true`; only Holiday has `applyAllByDefault: true`).

### 6.8 Edit Job slide-over

Click any existing card to open. Edit employee / start / hours / lock state, or delete. Live "predicted" panel shows engine-computed new end time as user edits.

### 6.9 Cascade Confirm dialog

Centered modal with backdrop, opened automatically before any move/resize that would cascade. Lists:

- Target: line being moved + old → new
- Department-flow cascade: tasks pushed by same-job flow order
- Same-resource queue: tasks pushed by same-employee overlap
- Knock-on effects: chain reactions

Four buttons: Cancel · Move only this · Try in Sandbox · Continue with cascade. Affected cards behind the modal pulse with a red outline.

### 6.10 Hover tooltip

Portal-rendered, 250 ms delay, auto-flips above/below the card. Shows:

- Header (dept color): job # + dept name
- Customer, planning line description
- Start, End rows
- Work row: raw → engine-scheduled (productivity-adjusted)
- Resource: name · productivity % · standard h/day
- (install only) Location: City, State + ZIP
- (install only) Weather: expanded WeatherChip
- Due: date + slack/past-due delta
- Inline conflicts list

---

## 7. Brand / visual spec

### 7.1 Color tokens (CSS variables in `lumineo.css`)

| Token | Value | Use |
|---|---|---|
| `--lumineo-navy` | `#141464` | Header, primary buttons, active nav |
| `--lumineo-red` | `#E8151B` | Logo accent, urgent badges, Add Job button, header icon boxes |
| `--label-bg` | `#E8EBF5` | Form field labels |
| `--input-bg` | `#F2F4F8` | Form field inputs |
| `--bg-secondary` | `#F7F8FA` | Panel backgrounds, summary strip |
| `--bg-tertiary` | `#EEF0F4` | Hover states |
| `--text-primary` | `#1A1D23` | Body text |

Money values render in `#1b6e3e` green; goal-under-90% in `#a0420f` amber.

### 7.2 Department palette (production)

Stored in `data/mock-schedule.ts` `MOCK_DEPARTMENTS`. Listed top-to-bottom per the user's chosen flow order:

| Dept | flowOrder | Color | Text |
|---|---|---|---|
| Routing | 1 | `#F8D5B7` peach | `#5b2a00` |
| Metal Fab | 2 | `#BED7FF` blue | `#042c53` |
| Paint | 3 | `#FAC775` yellow | `#633806` |
| Assembly | 4 | `#CECBF6` purple | `#26215c` |
| Vinyl / Graphics | 5 | `#C8E6D4` green | `#04342c` |
| Steel MFG | 6 | `#D6DCE5` slate | `#1c2533` |

### 7.3 Card layouts

`JobCard` has two layouts:

- **Compact** (production / shipping; ~38 px lane height): job# + customer on top line, description below.
- **Stacked** (install; ~60 px lane height): same top two lines + a third row carrying crew badge + weather chip + invoice $ amount.

Both layouts force `text-align: left` and use column flex (`align-items: stretch; justify-content: flex-start`).

Custom cards render as a single bold title block on the chosen background color.

### 7.4 Responsive breakpoints

- Default: desktop / landscape phone layout (≥ 720 px) — hamburger overlay drawer + standard header
- `@media (max-width: 720px)`: portrait phone layout — smaller header, smaller cards, calendar grid scrolls horizontally
- `@media (max-width: 380px)`: very narrow — extra-tight resource column

Calendar grid is always horizontally scrollable when its content overflows. Resource column and dept header label are `position: sticky; left: 0` so they remain visible.

---

## 8. Real integrations to build

### 8.1 Power SDK / Dataverse

Replace each entry in `src/services/*-data.ts` with a real `ScheduleDataSource` implementation. Interface:

```ts
interface ScheduleDataSource {
  kind: ScheduleKind;
  loadDepartments(): Promise<Department[]>;
  loadEmployees(): Promise<Employee[]>;
  loadScheduleLines(from: Date, to: Date): Promise<ScheduleLine[]>;
  loadWorkHours(from: Date, to: Date): Promise<WorkHoursOverride[]>;
  loadOvertimeOverrides(from: Date, to: Date): Promise<OvertimeOverride[]>;
  updateScheduleLine(id: string, changes: Partial<ScheduleLine>): Promise<ScheduleLine>;
  createScheduleLine(line: ScheduleLine): Promise<ScheduleLine>;
  deleteScheduleLine(id: string): Promise<void>;
}
```

This is the ONLY contract the stores and UI depend on. Implementing this against Power SDK is the bulk of the production build.

### 8.2 BC analytics connector

Replace `src/services/bc.ts` `searchJob` / `getJob` with real calls. The hook `useJobSearch` already does debouncing and session-level caching — no UI change needed.

### 8.3 OpenWeatherMap

Per [docs/09](09-weathercardspec.md):

1. Create `WeatherCache` Dataverse table.
2. Create `Lumineo Weather` custom Power Automate connector wrapping the OpenWeather API key.
3. Build `GetWeatherForJob` flow: takes `{ zip, forDate }`, returns cached row if < 3h old, else fetches + upserts.
4. Replace `getMockWeather` in `WeatherChip.tsx` with a call through to this flow.
5. Populate `bc_ZipGeo` Dataverse table from the public US ZIP dataset (~42 k rows, one-time import).

### 8.4 BC `lumCrewType` → CrewAssignment

Per [docs/10](10-crewtruckindicatorspec.md):

1. Confirm `lumCrewType` and `lumCrewMultiplier` custom fields exist on BC items.
2. Create `CrewAssignment` Dataverse table.
3. Nightly `RecomputeCrewAssignments` Power Automate flow walks open install tasks, sums purchase-line items by `lumCrewType`, upserts `CrewAssignment` rows (source = `Auto-BC`).
4. `JobCard`'s `crewPersons`/`crewTrucks`/`crewCranes`/`crewLifts`/`crewBuckets` are populated from this table at line-load time.

### 8.5 LNI Project Scheduler integration

Both apps share the install Dataverse tables. When LNI sets an install date on a project, the install line shows up here automatically; when Ops moves a card in the Scheduling Hub, LNI sees the updated date. No sync layer needed — same source of truth.

Production work: confirm LNI's data shape matches; align field names; add change-watcher subscriptions if real-time refresh between apps is required.

---

## 8.6 Airtable bridge (interim data source)

Until BC admin privileges land, both this Scheduling Hub and the production Scheduling app pull from Dataverse mirrored from Airtable via a Power Automate sync flow (the design lives in [docs/13](13-airtable-bridge-mapping.md)). Implication for the production build:

- The `ScheduleDataSource` interface is unchanged — implementations read from Dataverse just like the final BC-backed version would.
- The Airtable→Dataverse mirror flow runs on a schedule (every N minutes). Stale reads are possible. Plan for ~5 minute lag.
- Writes from the app go to Dataverse and are picked up by the reverse flow into Airtable. Don't write to Airtable directly from the app.
- When BC API access lands, the data source implementations swap from "Dataverse mirror" to "Dataverse virtual table over BC" with no UI change.

## 9. Deferred improvements with implementation notes

Items intentionally deferred from the prototype build that the production team should sequence in. Each entry includes the suggested approach so you can scope quickly.

### Offline mode + service worker

Shop-floor wi-fi is often spotty. The Code App should serve the last-known schedule offline and queue writes for replay on reconnect.

Approach:

- Register a service worker that caches the app shell + the latest `loadWeek` response per kind.
- Move the `ScheduleDataSource` calls behind a thin retry/queue wrapper that, on `navigator.onLine === false`, writes to an IndexedDB outbox and returns optimistic results.
- On `online` event, drain the outbox via the real data source. Surface a "syncing N changes" toast.
- Pair with a "Stale data — last sync HH:MM" banner when the cache is over ~10 min old.

The 4 schedule stores plus the scenario stores all already use the same data source interface, so this wrapper is the only insertion point needed.

### Multi-user real-time sync

Two ops users editing simultaneously should see each other's changes within a few seconds.

Approach (Dataverse-backed):

- Subscribe to Dataverse `subscribe` events on the schedule line tables.
- On change, dispatch through `useScheduleStore.setState` for the affected line.
- For conflict resolution, take last-write-wins for non-cascade edits; for cascade commits, use an optimistic-concurrency token (existing `modifiedon` column) and re-fetch + re-apply on conflict.

Approach (Airtable interim):

- Airtable doesn't expose change-watch in the way Dataverse does. Poll the Dataverse mirror every 30 s via `loadWeek` while a calendar is mounted.
- Show a "refreshed N seconds ago" indicator.

### Audit log per schedule line

"Who moved this, when, and why" matters for liability + post-mortems.

Approach:

- New Dataverse table `crfdf_schedulelinehistory` with FK to the line, plus actor, timestamp, old value, new value, change reason (text), source ("drag" / "edit-panel" / "scenario-commit" / "auto-fill").
- Trigger via Dataverse plugin or via the data source wrapper writing a history row on every `updateScheduleLine` / `createScheduleLine` / `deleteScheduleLine`.
- Surface a "History" tab in `EditJobPanel` showing the tail of changes.

### Virtualize calendar for large shops

At Lumineo's current scale (~20 + ~20 + ~10) the calendar renders every row eagerly with no issue. If either shop grows past ~75 employees a single render starts to feel sluggish.

Approach:

- Replace the `grouped.map(({ dept, emps }) => emps.map(emp => <EmployeeRow ... />))` chain in `CalendarView` with `react-window`'s `VariableSizeList`, item per employee row.
- Department headers stay outside the virtualization, rendered as fixed dividers between sections.
- The sticky resource column + sticky dept header label CSS continues to work since they're inside the virtualized children's container.

## 10. Suggestions for the production build

Ordered by leverage. Items marked ✅ have already landed in the prototype.

### Sequencing for the production wiring

1. **Get Power SDK + Dataverse environment set up first.** Without it the rest is paralyzed. The schema changes in [docs/04](04-dataverse-schema.md) need to land before the SDK gen step. While BC admin access is pending, the Airtable → Dataverse mirror via Power Automate (§8.6) is the data source.
2. **Wire up real BC search before anything else.** Biggest external dependency, easiest to validate end-to-end. Add Job isn't testable without it.
3. **Build CrewAssignment + WeatherCache tables in parallel** — both are small, both unblock install card chrome.
4. **Keep the prototype HTML running for stakeholder demos in parallel.** Single self-contained file; ops/sales can click around it without waiting for the production build.
5. **Don't re-implement the engine.** Copy `engine/*.ts` and `engine/*.test.ts` verbatim. The 47 tests pin the behavior.
6. **Don't redesign the calendar UI.** The Gantt-style overlay with sticky resource column took several iterations. The CSS in `lumineo.css` is the result.
7. **Use feature flags** to roll out by area: Production → Install → Shipping → Scenario → Monthly Plan. Each surface is independent enough.

### Items that already landed in the prototype

- ✅ **Pin custom cards by default.** All 7 presets have `lockByDefault: true`; AddJobPanel exposes a `🔒 Lock` checkbox so the user can override.
- ✅ **Bulk-apply for Holiday.** "Apply to all N resources" checkbox loops `addScheduleLine` per employee in the active calendar's roster.
- ✅ **Per-region scenario stores.** `createScenarioStore(dataSource)` factory + Production / WK / NEK / Shipping instances + kind tab strip in `ScenarioSandbox`.
- ✅ **iOS Safari touch-drag.** `mobile-drag-drop` polyfill wired in `main.tsx` with `forceApply: true`.
- ✅ **Print stylesheet + 🖨 button** that strips chrome and renders a clean 7-day grid suitable for foreman paper.
- ✅ **AI auto-fill respects crew availability** alongside dollar headroom; rejections name which budget is exhausted.
- ✅ **Accessibility basics** — NavDrawer + CascadeConfirmDialog use `role=dialog` / `role=alertdialog`, trap Escape, auto-focus first item. Prev/Next + Print get aria-labels.
- ✅ **Cascade convergence cap** raised to 200 with a logged warning.

### Items deferred to the production build (sketches in §9)

- **Offline mode / local cache** — service worker + IndexedDB outbox.
- **Multi-user real-time sync** — Dataverse `subscribe` (long-term) or 30s poll against the Airtable mirror (interim).
- **Audit log per line** — `crfdf_schedulelinehistory` table + History tab in EditJobPanel.
- **Virtualize calendar grid** — `react-window` for employee rows when shops grow past ~75 resources.

### Out of scope per current direction

- **Push notifications.** Not in the current build phase.
- **Monthly goal as a Dataverse config row.** `MONTHLY_INSTALL_GOAL` stays a constant in `InstallationCalendar.tsx` for now; easy to swap to a Dataverse fetch when needed.

### Items worth revisiting after launch

- **Recurring custom cards** — yearly PTO, monthly inventory.
- **Per-region scenario forms** — today the change-builder forms (Overtime/Weekends/Shift/Rush) still write through `useScenarioStore` (production); they should accept a `useStore` prop like the rest of the scenario sub-components to fully respect the active tab.
- **Keyboard nav for drag/resize.** Today's accessibility wins are around dialogs + ARIA labels; full keyboard scheduling is a larger refactor.

---

## 11. File-by-file map (what to port vs replace)

| File | Port verbatim | Replace |
|---|---|---|
| `src/engine/*.ts` | ✅ all (47 tests pin behavior) | — |
| `src/engine/*.test.ts` | ✅ all | — |
| `src/components/*.tsx` (all 17+ files) | ✅ all | — |
| `src/components/scenario/*.tsx` (banner / builder / impact / diff / 4 forms) | ✅ all | — |
| `src/styles/lumineo.css` (incl. `@media print`) | ✅ | — |
| `src/store/schedule-store.ts` (factory + 4 instances) | ✅ | — |
| `src/store/scenario-store.ts` (factory + 4 instances) | ✅ | — |
| `src/store/scenario-preview-store.ts` (no-op-backed) | ✅ | — |
| `src/hooks/*.ts` | ✅ | — |
| `src/services/data-source.ts` (interface + mock factory) | ✅ (interface only) | — |
| `src/services/dataverse.ts` | — | **Replace with real Power SDK adapter for production lines** (interim: Dataverse mirror of Airtable) |
| `src/services/installation-data.ts` | — | **Replace with real Power SDK adapters for WK + NEK install lines** |
| `src/services/shipping-data.ts` | — | **Replace with real Power SDK adapter for shipping lines** |
| `src/services/bc.ts` | — | **Replace with real BC analytics connector** |
| `src/services/zip-geo.ts` | — | **Replace with `bc_ZipGeo` lookup via Dataverse** |
| `src/services/planning-line-mapping.ts` | ✅ (logic) | Source rules from `crfdf_planninglinedepartmentmap` table instead of inline |
| `src/services/auto-schedule.ts` | ✅ | — |
| `src/components/WeatherChip.tsx` | ✅ (component) | **Replace `getMockWeather` with `Lumineo Weather` connector call** |
| `src/components/CrewBadge.tsx` | ✅ | — (just populated from `CrewAssignment` rows) |
| `src/main.tsx` (incl. mobile-drag-drop polyfill init) | ✅ | — |
| `src/data/*.ts` (mock fixtures) | — | **Delete all** in the production codebase — wire to real data sources |
| `src/data/custom-card-presets.ts` | ✅ for v1; later, source from `crfdf_customcardpreset` Dataverse table | — |
| `package.json` deps (`date-fns`, `zustand`, `mobile-drag-drop`, `react`) | ✅ | — |

---

## 12. How to validate the production build matches the prototype

For each milestone in Linear (M0–M15 + future):

1. Build the production version of the corresponding feature.
2. Run the prototype HTML side-by-side in another tab.
3. Walk through the acceptance criteria on the matching Linear issue.
4. Spot-check that the engine produces the same output for the same inputs (the 47 engine tests should still pass).
5. Update the Linear issue status.

The prototype is the contract. The production build is the implementation. They should be indistinguishable to the user.
