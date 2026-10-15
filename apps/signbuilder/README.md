# Lumineo Sign Builder (Power Apps code app)

Sibling of Switchboard (`apps/scheduling`): same stack (React 18 + TS + Vite +
Zustand, `@microsoft/power-apps`), same design system (`src/styles/lumineo.css`
copied from Switchboard + `signbuilder.css`), same Dataverse environment and
`crfdf_` prefix, same write-path rule (every save through `dvCreate/dvUpdate/
dvDelete` with retries; a failed save keeps the edit on screen and shows in
`SaveStatus` — never reload over the user's work).

## Run

```
npm run dev:signbuilder        # from the repo root — mock data in localStorage, port 5175
npm run test:signbuilder       # engine tests
npm run build:signbuilder
```

## What lives where

| | |
|---|---|
| `src/domain/types.ts` | Setup + spec model (mirrors the BC extension, plus per-answer print text / format) |
| `src/engine/flow.ts` | Question flow: Spec Rules, Also Requires, stages, next step, sign type picking (Selected When), allowed answers, Spec Code, reference page |
| `src/engine/descriptions.ts` | Production / Field / Extended text in the BC job-ticket format |
| `src/setup/import-bc.ts` | One-time import of BC's *Export Setup (JSON)* |
| `src/services/repo.ts` | Storage: mock (localStorage) or live (Dataverse `crfdf_sb*`) — setup as JSON documents ("core" + one per sign type) |
| `scripts/create-signbuilder-tables.ps1` | Creates the Dataverse tables (device-code login; safe to re-run) |

## Before the first deploy

1. Run `scripts/create-signbuilder-tables.ps1`; give the non-admin role Read/Write on the `crfdf_sb*` tables.
2. `pac code init` in this folder (creates the appId in `power.config.json`), then `npm run build` and
   `$env:NODE_OPTIONS="--use-system-ca"; pac code push` — and commit + push afterwards (push doesn't save source).
3. In the app: Setup → Import from Business Central (file from BC *Sign Builder Setup → Export Setup (JSON)*).

## Build order

1. ✅ Shell, data model, engine, Builder, Projects, Sign Library, BC import
2. Setup tools (Categories, Sign Types, Decision Tree, Show Path, Rule Matrix, Blocks, Copy/Paste, Undo/Versions, Test Category, Check Setup, Checklist, Spec References, per-answer print text)
3. BC link: Opportunities sync flow, jobs from `crfdf_bcjob`, Generate to Project (side-by-side review → push queue → flow → BC API page writes Production/Field Descriptions + spec completeness for the Order Released check)
4. Ballpark $ / Send to Estimating, photos per sign (SharePoint JobFiles), user guide + tour
