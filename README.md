# Sign Builder Pro — Power Apps Code App

React + Vite + TypeScript Power Apps Code app that replaces the manual sign-spec process at Lumineo Signs. Mirrors the Vercel preview UX with the routing, spec-image, and vinyl-search modifications carried over, and shares design tokens with the Switchboard prototype so the three code apps render identically.

- **Linear project:** [Sign Builder Pro — Power Apps Code App](https://linear.app/lumineosigns/project/sign-builder-pro-power-apps-code-app-8a268257911a)
- **Target platform:** Power Apps Code apps via `pac code init` / `pac code run` / `pac code push`
- **Dataverse table:** `Sign Specifications` (31 fields — see `docs/dataverse-schema.md`)
- **Launches from:** Switchboard tile launcher, with `userEmail`, `role`, optional `specId` URL params

## What's built

| Area | Status |
| --- | --- |
| Project scaffold (`power.config.json`, Vite, TS, React Router) | ✅ |
| Shared `lumineo-ui` tokens lifted from the Switchboard prototype | ✅ |
| Header + nav, Dashboard hero + KPIs + recent lists | ✅ |
| Builder shell — sidebar with search + filter, top bar with header inputs | ✅ |
| Form cascade Steps 1 → 9, plus 10/11/12 for MN/PS/PP, plus Notes & Status | ✅ |
| Real-time product code + department routing | ✅ |
| Vinyl swatch grids (3M 3630 + 7725) with color search | ✅ |
| Spec reference image thumbnail + full-screen modal | ✅ (placeholder SVG until SharePoint URLs are pinned) |
| COPY button with 2s confirm, Export Spec HTML printout, Save / Clear | ✅ |
| Draft auto-save to localStorage, `?specId=` deep-link from Switchboard | ✅ |
| Dataverse adapter (Power Apps SDK at runtime, localStorage fallback) | ✅ |
| Gallery — search, filter, duplicate, delete (with confirm) | ✅ |
| Vitest suite covering cascade + product code + dept routing + swatch search | ✅ (22 tests) |
| GitHub Actions CI — typecheck + tests + build | ✅ |

Outstanding: drop the real SharePoint filenames into `src/domain/specReferenceImage.ts`, run `pac code init` against the tenant to materialize the Dataverse client binding, and the breakpoint / tablet QA pass.

## Layout

```
app/
  src/
    ui/         lumineo-ui tokens + primitives (Header, Pill, Banner, specStatus)
    app/        AppShell, SpecContext (cascade + draft persistence), launchParams hook
    screens/    Dashboard, Builder, Gallery, Reports
    builder/    SpecSummary, SpecReferenceImage, 12-step form
    domain/     SignSpec type + 31-field model, sign-type tables, vinyl swatches,
                product-code assembly, department routing, spec-image lookup
    data/       SignSpecRepo interface, localStorage fallback, Dataverse adapter
docs/         Dataverse schema reference
.github/workflows/ci.yml   Typecheck + tests + build on every push
```

## Local dev

```bash
cd app
npm install
npm run dev                  # http://127.0.0.1:5173/
npm run dev --              "--host 127.0.0.1 --port 5174"
# Test the sub-app launch contract:
#   http://localhost:5173/?userEmail=alex@lumineosigns.com&role=Operations
#   http://localhost:5173/#/builder?specId=seed-wc-1
npm test                     # vitest run
npm run typecheck            # tsc -b --noEmit
npm run build                # production bundle into app/dist
```

## Power Apps deployment

This project is structured to drop into a `pac code init` solution. After `pac auth create` to your tenant:

```bash
cd app
pac code init --displayName "Sign Builder Pro"   # if power.config.json is missing
pac code push                                    # uploads the built dist/
pac code run                                     # launches the published app
```

The `Sign Specifications` Dataverse table must exist (see `docs/dataverse-schema.md`) before `pac code push`. The Dataverse adapter (`src/data/dataverseAdapter.ts`) auto-detects the SDK at runtime, so the deployed bundle picks it up without code changes.
