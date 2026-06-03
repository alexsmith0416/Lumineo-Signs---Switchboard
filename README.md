# Lumineo Signs — Switchboard

**Switchboard** is the master Power Apps "shell" that hosts five sub-apps under one roof, with role-based routing, a shared Dataverse, and a live connection to Microsoft Dynamics 365 Business Central.

## The five sub-apps

| App | Group(s) that see it | Status |
|---|---|---|
| Project Scheduler → **Scheduling Hub** | Operations | **React Code App prototype in [`scheduling-app/`](scheduling-app/)** — Production / Installation (WK + NEK) / Shipping calendars + Scenario Sandbox + Monthly Install Plan. See [docs/15](docs/15-scheduling-app-spec.md) for the build spec and [docs/16](docs/16-scheduling-app-starter-prompt.md) for the production starter prompt. |
| Weekly Scheduler | Operations, Sales, Employees (scoped to dept) | React base exists → wrap as PCF |
| Sign Builder Pro | Operations, Sales | React base exists → wrap as PCF |
| Time & Photo Capture | Operations, Employees | New (canvas, mobile-first) |
| Sales Hub | Operations, Sales | React base exists → wrap as PCF |

## Scheduling Hub prototype

The biggest piece in this repo right now is the React/TypeScript **Lumineo Scheduling Hub** prototype at [`scheduling-app/`](scheduling-app/). It's a complete end-to-end demo against mock data:

- Three calendar surfaces (Production / Installation / Shipping) with drag-to-move, drag-to-resize, bidirectional cascade with pre-commit confirmation, sticky resource column + dept header during horizontal scroll, lane-allocated Gantt-style overlay cards, week navigation with Today button, brand-red Add Job button, and a 🖨 print button.
- Installation gets stacked cards with crew/truck badge, weather chip, invoice $ amount, WK ↔ NEK region toggle, and per-region monthly billing goal tracking ($1.1M).
- Scenario Sandbox with kind tabs (Production / Install · WK / Install · NEK / Shipping), each backed by its own `createScenarioStore(dataSource)` instance. Embedded read-only calendar preview reflects every staged change.
- Monthly Install Plan with combined billing roll-up + AI auto-fill respecting per-region crew availability and dollar headroom.
- Custom (non-BC) cards: 7 presets (PTO / Inventory / Truck Maintenance / Med Cert / DOT Physical / Crane Cert / Holiday-Shop-Closed) all locked-by-default; Holiday auto-applies across the whole roster.
- Cascade-aware drop/resize: previews exactly which downstream tasks would shift, grouped by reason, with four choices (Cancel / Move only this / Try in Sandbox / Continue). Affected cards pulse red behind the modal.
- Mobile responsive — hamburger drawer, sticky left column during horizontal scroll, iOS touch-drag polyfill (`mobile-drag-drop`).
- 48 engine unit tests covering capacity walking, business-hour anchoring (8am–4pm), cascade purity, **bidirectional pull-back**, conflict detection, locked-card flow-around, and scenario commit patches.

### Run it locally

```bash
cd scheduling-app
npm install
npm run dev          # http://127.0.0.1:5174
npm run typecheck
npm run test         # 48 tests
npm run build        # production bundle in dist/
```

The standalone single-file HTML build is the easiest demo artifact — `npm run build` then bundle `dist/` into one file with the inliner script.

## Permission groups

- **Operations** — superuser; sees and edits every app
- **Sales** — Sales Hub, Weekly Scheduler, Sign Builder Pro
- **Employees** — splits into three departments, each with their own scoped home screen:
  - Production
  - Installation
  - Shipping
  - All employees see: Weekly Scheduler (filtered to their dept), Time & Photo Capture

## Where to start

### Strategic

1. [docs/01-architecture-overview.md](docs/01-architecture-overview.md) — the master plan in one page
2. [docs/02-flowchart.md](docs/02-flowchart.md) — user journey + system architecture diagrams
3. [docs/06-build-plan.md](docs/06-build-plan.md) — phased delivery plan
4. [docs/12-linear-structure.md](docs/12-linear-structure.md) — how the Linear hub is organized

### Platform

5. [docs/03-permissions-and-roles.md](docs/03-permissions-and-roles.md) — Entra ID + Dataverse role mapping
6. [docs/04-dataverse-schema.md](docs/04-dataverse-schema.md) — shared tables + Business Central integration
7. [docs/13-airtable-bridge-mapping.md](docs/13-airtable-bridge-mapping.md) — **interim** Airtable → Dataverse mirror until BC API access lands
8. [docs/14-bc-write-operations.md](docs/14-bc-write-operations.md) — payload schemas for the 7 queued BC write operations

### Switchboard (master shell)

9. [docs/05-home-screens.md](docs/05-home-screens.md) — per-group home screen specs (KPIs, widgets, recommendations)
10. [docs/08-splash-screen-spec.md](docs/08-splash-screen-spec.md) — splash visual + KPI strip + Days Since Lost Time counter
11. [docs/09-weather-card-spec.md](docs/09-weather-card-spec.md) — weather chip for Installation
12. [docs/10-crew-truck-indicator-spec.md](docs/10-crew-truck-indicator-spec.md) — 2M 1T crew/truck badge
13. [docs/11-widget-recommendations.md](docs/11-widget-recommendations.md) — full widget catalog (MVP + Phase 6)

### Sub-apps

14. [docs/07-sub-apps.md](docs/07-sub-apps.md) — per-app screens, data, integrations

## Linear hub

All implementation work is tracked in Linear under the **Alex Smith** team. Seven projects total — two new (Platform Foundation, Switchboard) plus the five existing app projects. See `docs/12-linear-structure.md` for the dependency graph and milestone schedule.
