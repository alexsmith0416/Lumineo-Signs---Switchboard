# Sign Builder Pro — Power Apps Code App

React + Vite + TypeScript Power Apps Code app that replaces the manual sign-spec process at Lumineo Signs. Mirrors the Vercel preview UX with the routing/spec-image/vinyl-search modifications carried over, and shares design tokens with Switchboard and LNI Production Schedule.

- **Linear project:** [Sign Builder Pro — Power Apps Code App](https://linear.app/lumineosigns/project/sign-builder-pro-power-apps-code-app-8a268257911a)
- **Target platform:** Power Apps Code apps via `pac code init` / `pac code run` / `pac code push`
- **Dataverse table:** `Sign Specifications` (31 fields)
- **Launches from:** Switchboard tile launcher, with `userEmail` and `role` URL params

## Layout

```
src/
  ui/         shared lumineo-ui tokens + primitive components (Header, Card, Pill, ...)
  screens/    Dashboard, Builder, Gallery, Reports
  builder/    the 12-step form, cascade logic, product code assembly
  data/       Dataverse service interface + localStorage dev fallback
  domain/     SignSpec type, sign-type tables, vinyl swatch tables, code assembly
  app/        AppShell, routing, sub-app param hook
```

## Local dev

```bash
cd app
npm install
npm run dev          # vite dev server, ?userEmail=...&role=Operations to test sub-app launch
npm run build        # production build for `pac code push`
npm run typecheck
```

## Power Apps deployment

This project is structured to drop into a `pac code init` solution. After `pac auth create` to your tenant:

```bash
cd app
pac code init --displayName "Sign Builder Pro"   # if power.config.json is missing
pac code push
pac code run
```

`power.config.json` holds the Dataverse environment + table bindings. The `Sign Specifications` table must exist (see `docs/dataverse-schema.md`) before `pac code push`.
