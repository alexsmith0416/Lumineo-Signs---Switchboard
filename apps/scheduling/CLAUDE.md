# Lumineo Switchboard (formerly Scheduling Hub) — CLAUDE.md

Working notes for Claude Code on this app. Read this before starting any task.

- Linear project: https://linear.app/lumineosigns/project/lumineo-scheduling-hub-b4e29b417bee
- Issues are tagged `ALE-79` through `ALE-87`. Milestones M0-M8.
- Branch convention: `claude/<slug>` for in-progress work; final branches map to the per-issue `gitBranchName` from Linear.

> **Live status, deploy steps and "where we left off" live in `START-HERE.md`
> at the repo root — read it first.** This file is the architecture / engine
> reference. The app is LIVE in Power Apps (Dataverse via the Power SDK, BC via
> flows — see `BC-CONNECTIONS.md`).

## What this app is

A React + TypeScript Power Apps Code App that replaced the Canvas Production Scheduling app. Three boards (Production, Installation WK/NEK, Shipping) share one scheduling engine (`CalendarView` renders all three), plus the Jobs list (steppers, Current Status, job flow), Monthly Gameplanning, Install Planner / Install Trips, Warehouse Management, My Schedule, the Scenario Sandbox, Settings and Help (user guide + demo tour).

## Architecture

```
App.tsx (Sidebar.tsx nav)
  ├── My Schedule · Jobs (components/jobs/) · Warehouse (components/warehouse/)
  ├── Production / Installation / Shipping  → CalendarView (shared grid)
  │     ├── JobCard · JobCardPanel · GroupPanel · JobQueuePanel (+ Bucket Lists)
  │     └── store calls: shiftTaskAndCommit / addScheduleLine / … ─┐
  ├── Monthly Gameplanning · Install Planner · Install Trips        │
  ├── Scenario Sandbox (runScenario / commitScenario)               │
  └── Settings · Help                                               │
                                                                    │
       Engine (pure TS, no React) ◄─────────────────────────────────┘
         types · capacity · time-walker · cascade · conflicts · scenarios
                  │
       Services (pure rules + I/O boundary)
         dataverse-live.ts   every Dataverse read/write (generated Power SDK);
                             writes ONLY via dvCreate / dvUpdate / dvDelete
         data-source.ts      ScheduleDataSource (mock in dev, live in prod)
         bc*.ts / flows      BC sync + push (see BC-CONNECTIONS.md)
         *.ts                pure, tested rules (job-flow, buckets, red-date,
                             install-readiness, week-plan, gameplan, …)
                  │
       Stores (Zustand, ~45)
         createScheduleStore(dataSource, boardId) — one per board
         job-tracking / job-dept-completion (steppers) / job-flow / flow-follow
         write-status-store — persistOrReport: a failed write never reverts the UI
```

## Tech stack

- Vite + React 18 + TypeScript
- Zustand for state (live store + scenario store kept separate)
- date-fns for date math
- Hand-rolled calendar grid (`CalendarView`) — permanent; react-big-calendar
  is installed but unused
- Power SDK (generated, `src/generated/`) for Dataverse — `services/dataverse-live.ts`
- BC job search via `services/bc.ts` → `searchBcJobsLive`; other BC data is
  mirrored into Dataverse by flows (`BC-CONNECTIONS.md`)
- Vitest (`npm run test`) — engine, services and stores are covered

## Brand tokens (in `src/styles/lumineo.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--lumineo-navy` | `#141464` | Headers, primary buttons, active nav |
| `--lumineo-red`  | `#E8151B` | Logo accent, urgent badges, header action icons |
| `--label-bg`     | `#E8EBF5` | Form field labels |
| `--input-bg`     | `#F2F4F8` | Form field inputs |
| `--bg-secondary` | `#F7F8FA` | Panel backgrounds |
| `--bg-tertiary`  | `#EEF0F4` | Sidebar, hover states |

Department palette:
- Metal Fab `#BED7FF` / `#042C53`
- Paint `#FAC775` / `#633806`
- Assembly `#CECBF6` / `#26215C`
- Vinyl/Graphics `#C8E6D4` / `#04342C`
- Install `#FFE0A8` / `#5E3C00`
- Fallback `#CCCCCC` / `#222`

## Engine contract (don't break these)

See [Linear Engine Contracts doc](https://linear.app/lumineosigns/document/engine-contracts-typescript-scheduling-engine-72f0a7c19b62).

1. **Pure**: engine modules import nothing from React / Power SDK / Dataverse. Only `date-fns`.
2. **Immutability**: `shiftTask` and `runScenario` always clone first via `cloneContext`.
3. **Effective hours**: `(overrideHours ?? estimatedHours) / employee.productivityRate`. Rate 0 → 1.
4. **Department flow**: a task at flowOrder N cannot start before all tasks at flowOrder < N in the same job have ended.
5. **Same-employee queue**: tasks never overlap on one employee; cascade pushes later tasks forward.
6. **Locked tasks** (`isLocked: true`) never move. Cascade flows around them and surfaces conflicts.
7. **Capacity walking**: `calculateEndTime` walks day by day via `getDayCapacity`. Days with 0 capacity are skipped, not zeroed.

## File structure conventions

```
src/
  engine/         pure TS — no imports outside date-fns
  services/       I/O boundary (Power SDK, BC) — async, returns engine types
  hooks/          React-side glue (debounced search, live preview math)
  store/          Zustand stores; live + scenario are independent
  components/     UI; each component imports from store, never from services directly
  styles/         lumineo.css with design tokens + component styles
  data/           mock fixtures for the stubbed services
```

When adding code:
- New engine logic → write a pure function, export from `engine/index.ts`, no React imports.
- New Dataverse field → add to `engine/types.ts`, update the mapping in `services/dataverse-live.ts`, update mocks in `data/`. New table → a `scripts/create-*.ps1` (privileges mirrored from an existing table).
- New editable action → persist via `persistOrReport` and add a failing-save case to `store/optimistic-edit.test.ts`.
- User-facing change → update `public/USER-GUIDE.html` body + What's New; significant feature → a `FULL_STEPS` tour step (`DemoTutorial.tsx`). See START-HERE.md §4.
- New scenario change type → extend the `ScenarioChange` union in `engine/types.ts`, handle in `runScenario` switch, add a form under `components/scenario/forms/`, wire into `ChangeBuilder`.

## Setup

```bash
npm install
npm run dev          # vite, default port 5174
npm run typecheck    # tsc -b --noEmit
npm run test         # vitest
npm run build        # production build → dist/ (deploy: START-HERE.md §4)
```

The dev server boots with mock data and an admin stand-in user; changes persist in memory only. `VITE_DATA_SOURCE=live` (or a production build) uses real Dataverse.

## Reference docs

- [Visual Design Spec](https://linear.app/lumineosigns/document/visual-design-spec-match-the-canvas-app-226d2d7f14fd)
- [Data Model & Dataverse Schema Changes](https://linear.app/lumineosigns/document/data-model-and-dataverse-schema-changes-775dd81fda37)
- [Engine Contracts](https://linear.app/lumineosigns/document/engine-contracts-typescript-scheduling-engine-72f0a7c19b62)
- [Brand Logo](https://linear.app/lumineosigns/document/brand-logo-lumineologo-component-46a5223b19b6) — already implemented at `src/components/LumineoLogo.tsx`

## Milestone status

M0–M7 are done and the app is live; work since then is tracked in
START-HERE.md's "Next up" (not in Linear milestones).

- M0 (ALE-87) — Onboarding · this file
- M1 (ALE-79) — Foundation · live Dataverse via the Power SDK
- M2 (ALE-80) — Production Calendar · live
- M3 (ALE-81) — Engine live · cascade is a user setting (`useSettingsStore.cascadeEnabled`)
- M4 (ALE-82) — Add Job Panel · single / multi / custom / group card, live BC search
- M5 (ALE-83) — Scenario Sandbox · workspace + diff + impact + commit
- M6 (ALE-84) — Installation · live WK + NEK boards (region toggle, weather, crew/truck, $, billing goal)
- M7 (ALE-85) — Shipping · live loads board on the same engine
- M8 (ALE-86) — Polish & rollout · ongoing (see START-HERE.md)

## Monthly install plan + AI auto-fill

Sidebar item **Monthly Plan** (`src/components/MonthlyPlanView.tsx`) shows a
roll-up of install billing across both regions for the current BILLING month,
with per-week cards, a target line, and gap vs that month's goal.

**Billing months follow each month's billing cut-off, not the calendar**
(`services/billing-periods.ts`, Dataverse `crfdf_billingperiod`, edited in
Settings → Billing periods by Admin / Developer / Ops). A job bills in the
period its install ENDS in; the cut-off day itself belongs to the next month.
No cut-off → calendar month; no goal → `DEFAULT_MONTHLY_GOAL` ($1.1M). The
Installation board's "Billing · <month>" stat (`WeekSummary`) uses the same
periods.

Booked $ reads every WK / NEK install card around the period
(`dataSource.loadScheduleLines`), each job once at `cardMoneyValue`, in the week
its last card ends. Pools (Past due / Ready / Near complete) come from the Jobs
rows (`hooks/useJobRows.ts`) + steppers + BC install planning lines
(`useStepQueueData`). Auto-fill + pools + week math are pure, in
`services/gameplan.ts` (tested). Commit sets `scheduledInstallDate` (job-schedule
store) and adds the jobs to a "Planned · week of …" group in the region's Install
Job Queue (`addToNamedGroup`).

## Card layouts

`CalendarView` accepts `cardLayout: "compact" | "stacked"`. Production /
Shipping use compact (24 px tall, single row of text). Installation uses
stacked (44 px, two rows: job/customer/desc on top, crew/weather/$ on bottom).
Lane height in the row layout flexes from this prop.

## Known gaps to address

- Open items and go-live steps are kept in START-HERE.md "Next up" — check there first.
- `useLivePreview` runs the engine on every render with a fresh context snapshot. Profile if the Add Job preview gets slow.
- Mock data (`data/`) only covers what dev needs; some live-only paths (BC pushes, step info, Dataverse-only tables) do nothing in dev.
