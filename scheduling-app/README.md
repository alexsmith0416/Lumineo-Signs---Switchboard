# Lumineo Scheduling Hub

A React + TypeScript Code App that replaces the Canvas Production Scheduling app. Unified scheduling for Production, Installation, and Shipping with a real constraint-based scheduling engine, drag-and-drop calendar, and a Scenario Sandbox for what-if planning.

## Status

Scaffold for M0 + M1 of the [Lumineo Scheduling Hub](https://linear.app/lumineosigns/project/lumineo-scheduling-hub-b4e29b417bee) Linear project. Typechecks clean and runs locally with mock data. Power SDK is stubbed — see `src/services/dataverse.ts`.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5174`).

Other scripts:

- `npm run typecheck` — TypeScript check, no emit
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run test` — vitest (no tests authored yet)

## What it does (today, against mocks)

- **Production calendar** — employees grouped by department flow order, job cards colored by department, drag a card to a different cell or employee to move it (persists in memory).
- **Add Job panel** — search mock BC jobs by job number, three scheduling modes (single line / multi-select / auto-schedule all).
- **Scenario Sandbox** — clone the live schedule into a workspace, stack changes (overtime, weekends, shift task, insert rush job), see live diff + impact metrics, commit atomically or discard.

## What's still stubbed

- `dataverseService` returns mock data (`src/data/mock-schedule.ts`). Replace with real Power SDK calls in M1 final.
- `bcService` returns mock BC jobs (`src/data/mock-bc.ts`). Replace with real BC analytics connector calls.
- Calendar drag passes `cascade=false` to match M2 acceptance criteria. Flip to `true` for M3.

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture map, brand tokens, engine contract, and file structure conventions.

## Repo layout

```
src/
  engine/         pure TypeScript scheduling logic
  services/       I/O boundary (Power SDK, BC) — currently stubbed
  store/          Zustand stores (live + scenario)
  hooks/          React glue
  components/     UI
    scenario/     sandbox-specific components
  styles/         lumineo.css design tokens + component styles
  data/           mock fixtures
```
