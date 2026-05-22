# Lumineo Scheduling Hub — CLAUDE.md

Working notes for Claude Code on this app. Read this before starting any task.

- Linear project: https://linear.app/lumineosigns/project/lumineo-scheduling-hub-b4e29b417bee
- Issues are tagged `ALE-79` through `ALE-87`. Milestones M0-M8.
- Branch convention: `claude/<slug>` for in-progress work; final branches map to the per-issue `gitBranchName` from Linear.

## What this app is

A React + TypeScript Code App replacing the Canvas Production Scheduling app. Three calendars (Production, Installation, Shipping) share one scheduling engine, plus a Scenario Sandbox for what-if planning.

## Architecture

```
App.tsx (sidebar nav)
  ├── ProductionCalendar  ── shiftTaskAndCommit() ─┐
  ├── InstallationCalendar (M6 stub)               │
  ├── ShippingCalendar (M7 stub)                   │
  └── ScenarioSandbox                              │
        ├── ScenarioBanner / ChangeBuilder        │
        ├── ImpactSummary / ScheduleDiff          │
        └── runScenario() / commitScenario()      │
                                                  │
       Engine (pure TS, no React)  ◄──────────────┘
         types · capacity · time-walker
         cascade · conflicts · scenarios
                  │
       Services  ◄┘
         dataverseService   (Power SDK — stubbed)
         bcService          (BC analytics — stubbed)
         planning-line-mapping
         auto-schedule
                  │
       Stores (Zustand)
         useScheduleStore   (live)
         useScenarioStore   (sandbox)
```

## Tech stack

- Vite + React 18 + TypeScript
- Zustand for state (live store + scenario store kept separate)
- date-fns for date math
- react-big-calendar (installed; current calendar is a hand-rolled grid that
  matches the Canvas styling pixel-for-pixel — swap in r-b-c in M2 if needed)
- Power SDK for Dataverse (replace stubs in `services/dataverse.ts` for M1 final)
- BC analytics connector for job search (replace stub in `services/bc.ts`)

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
- New Dataverse field → add to `engine/types.ts`, update `dataverseService` mapping, update mocks in `data/`.
- New scenario change type → extend the `ScenarioChange` union in `engine/types.ts`, handle in `runScenario` switch, add a form under `components/scenario/forms/`, wire into `ChangeBuilder`.

## Setup

```bash
npm install
npm run dev          # vite, default port 5174
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

The dev server boots with mock data; everything is reactive but persists only in memory until M1 final wires real Power SDK.

## Reference docs

- [Visual Design Spec](https://linear.app/lumineosigns/document/visual-design-spec-match-the-canvas-app-226d2d7f14fd)
- [Data Model & Dataverse Schema Changes](https://linear.app/lumineosigns/document/data-model-and-dataverse-schema-changes-775dd81fda37)
- [Engine Contracts](https://linear.app/lumineosigns/document/engine-contracts-typescript-scheduling-engine-72f0a7c19b62)
- [Brand Logo](https://linear.app/lumineosigns/document/brand-logo-lumineologo-component-46a5223b19b6) — already implemented at `src/components/LumineoLogo.tsx`

## Milestone status

- M0 (ALE-87) — Onboarding · this file is the deliverable
- M1 (ALE-79) — Foundation · scaffold written, stubs in place; **Power SDK still stubbed**
- M2 (ALE-80) — Production Calendar · drag/drop works against in-memory state
- M3 (ALE-81) — Engine live · cascade is implemented; calendar currently passes `cascade=false` per M2 acceptance — flip to `true` for M3
- M4 (ALE-82) — Add Job Panel · all three modes (single / multi / auto) implemented against mocks
- M5 (ALE-83) — Scenario Sandbox · workspace + diff + impact + commit implemented
- M6 (ALE-84) — Installation · stub view
- M7 (ALE-85) — Shipping · stub view
- M8 (ALE-86) — Polish & rollout · not started

## Known gaps to address

- Power SDK is `declare`d but not actually called — `services/dataverse.ts` returns mock data with an in-memory mutation log so changes survive within a session but not across reloads.
- The calendar uses a hand-rolled grid (close visual match to Canvas). M2 may swap to react-big-calendar; the package is already installed.
- `useLivePreview` runs the engine on every render with a fresh context snapshot. Profile when wiring it into the Add Job preview pane.
- No tests yet. Vitest is installed; engine modules are pure, so they're the natural first target.
