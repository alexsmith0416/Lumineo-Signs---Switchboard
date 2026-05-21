# Lumineo Signs — Switchboard

**Switchboard** is the master Power Apps "shell" that hosts five sub-apps under one roof, with role-based routing, a shared Dataverse, and a live connection to Microsoft Dynamics 365 Business Central.

## The five sub-apps

| App | Group(s) that see it | Status |
|---|---|---|
| Project Scheduler | Operations | New (canvas) |
| Weekly Scheduler | Operations, Sales, Employees (scoped to dept) | React base exists → wrap as PCF |
| Sign Builder Pro | Operations, Sales | React base exists → wrap as PCF |
| Time & Photo Capture | Operations, Employees | New (canvas, mobile-first) |
| Sales Hub | Operations, Sales | React base exists → wrap as PCF |

## Permission groups

- **Operations** — superuser; sees and edits every app
- **Sales** — Sales Hub, Weekly Scheduler, Sign Builder Pro
- **Employees** — splits into three departments, each with their own scoped home screen:
  - Production
  - Installation
  - Shipping
  - All employees see: Weekly Scheduler (filtered to their dept), Time & Photo Capture

## Where to start

1. [docs/01-architecture-overview.md](docs/01-architecture-overview.md) — the master plan in one page
2. [docs/02-flowchart.md](docs/02-flowchart.md) — user journey + system architecture diagrams
3. [docs/03-permissions-and-roles.md](docs/03-permissions-and-roles.md) — Entra ID + Dataverse role mapping
4. [docs/04-dataverse-schema.md](docs/04-dataverse-schema.md) — shared tables + Business Central integration
5. [docs/05-home-screens.md](docs/05-home-screens.md) — per-group home screen specs (KPIs, widgets, recommendations)
6. [docs/06-build-plan.md](docs/06-build-plan.md) — phased delivery plan with Linear project mapping
7. [docs/07-sub-apps.md](docs/07-sub-apps.md) — per-app screens, data, integrations
