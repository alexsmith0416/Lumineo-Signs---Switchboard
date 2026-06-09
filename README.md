# Lumineo Signs — Switchboard

**Switchboard** is the master Power Apps "shell" that hosts five sub-apps under one roof, with role-based routing, a shared Dataverse, and a live connection to Microsoft Dynamics 365 Business Central.

## Web apps in this monorepo

Two of the sub-apps are built as React + Vite + TS web apps in `apps/*` and
deploy independently. They share the Switchboard design system (`DESIGN.md`)
and are wired together by a URL handoff:

| App | Path | Run | Connection |
|---|---|---|---|
| **Sign Builder Pro** | `apps/sign-builder` | `npm run dev:sign-builder` | *Send to Estimating* → opens Estimating with the spec pre-loaded |
| **Estimating** | `apps/estimating` | `npm run dev:estimating` | imports the SBP payload, links back to the originating spec |

Shared design tokens live in `packages/ui`. **To deploy both and let others
test the connection, see [docs/deploy.md](docs/deploy.md).** The payload
contract between them is in
[docs/estimating-integration.md](docs/estimating-integration.md).

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

### Strategic

1. [docs/01-architecture-overview.md](docs/01-architecture-overview.md) — the master plan in one page
2. [docs/02-flowchart.md](docs/02-flowchart.md) — user journey + system architecture diagrams
3. [docs/06-build-plan.md](docs/06-build-plan.md) — phased delivery plan
4. [docs/12-linear-structure.md](docs/12-linear-structure.md) — how the Linear hub is organized

### Platform

5. [docs/03-permissions-and-roles.md](docs/03-permissions-and-roles.md) — Entra ID + Dataverse role mapping
6. [docs/04-dataverse-schema.md](docs/04-dataverse-schema.md) — shared tables + Business Central integration

### Switchboard (master shell)

7. [docs/05-home-screens.md](docs/05-home-screens.md) — per-group home screen specs (KPIs, widgets, recommendations)
8. [docs/08-splash-screen-spec.md](docs/08-splash-screen-spec.md) — splash visual + KPI strip + Days Since Lost Time counter
9. [docs/09-weather-card-spec.md](docs/09-weather-card-spec.md) — weather chip for Installation
10. [docs/10-crew-truck-indicator-spec.md](docs/10-crew-truck-indicator-spec.md) — 2M 1T crew/truck badge
11. [docs/11-widget-recommendations.md](docs/11-widget-recommendations.md) — full widget catalog (MVP + Phase 6)

### Sub-apps

12. [docs/07-sub-apps.md](docs/07-sub-apps.md) — per-app screens, data, integrations

## Linear hub

All implementation work is tracked in Linear under the **Alex Smith** team. Seven projects total — two new (Platform Foundation, Switchboard) plus the five existing app projects. See `docs/12-linear-structure.md` for the dependency graph and milestone schedule.
