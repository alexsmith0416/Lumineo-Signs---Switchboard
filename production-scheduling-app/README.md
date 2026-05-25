# Lumineo Scheduling Hub — Production Build

The production Power Code App. Engine + UI + Zustand stores are ported verbatim from `../scheduling-app/`; the service layer (`src/services/*`) wires to Power SDK / Dataverse / BC / OpenWeather per [`../docs/15-scheduling-app-spec.md`](../docs/15-scheduling-app-spec.md).

## Status

M1 scaffold. Engine + UI ported. Every I/O-boundary service is a typed `NotImplementedError`-throwing stub keyed to the milestone that will wire it:

| Service | Stubbed | Wires in |
|---|---|---|
| `services/dataverse.ts` (productionDataSource) | ✅ | M2 / ALE-80 |
| `services/bc.ts` (bcService) | ✅ | M4 / ALE-82 |
| `services/installation-data.ts` (wk + nek) | ✅ | M6 / ALE-84 |
| `services/shipping-data.ts` (shippingDataSource) | ✅ | M7 / ALE-85 |
| `services/zip-geo.ts` + `WeatherChip` getWeatherForJob | ✅ | M10 |
| `services/install-candidates.ts` | ✅ | M11 |

Reads return `[]` with a `console.warn`; mutations throw. The app type-checks and the 47 engine tests pass.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5174`). The shell will render but every calendar is empty until M2+ wires real data.

Other scripts:

- `npm run typecheck` — TypeScript check, no emit
- `npm run build` — production build
- `npm run test` — vitest (47 engine tests)

## Source of truth

- Build spec: [`../docs/15-scheduling-app-spec.md`](../docs/15-scheduling-app-spec.md)
- Starter prompt + milestone notes: [`../docs/16-scheduling-app-starter-prompt.md`](../docs/16-scheduling-app-starter-prompt.md)
- Prototype (stakeholder-demo reference): [`../scheduling-app/`](../scheduling-app/)

## Repo layout

```
src/
  engine/         pure TypeScript scheduling logic (ported verbatim, no edits)
  services/       I/O boundary — currently stubs that warn / throw
  store/          Zustand stores (live + scenario, ported verbatim)
  hooks/          React glue
  components/     UI (ported verbatim)
    scenario/     sandbox-specific components
  styles/         lumineo.css design tokens + component styles
  data/           only custom-card-presets.ts (the one preset file the spec keeps)
```
