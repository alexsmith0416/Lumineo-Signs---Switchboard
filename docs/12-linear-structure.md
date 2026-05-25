# 12 — Linear Project Structure

How the design hub on Linear maps to the engineering work and to these docs.

## Team

All work lives under the **Alex Smith** team in Linear workspace `lumineosigns`.

## Projects

There are **seven** projects total. Two are new (created from this design). Five are the user's existing projects, kept as-is.

| # | Project name | Status | Purpose |
|---|---|---|---|
| 1 | **Platform Foundation — Dataverse, Security & Component Library** | new | Shared bedrock; blocks everything else |
| 2 | **Switchboard — Master Power Apps Shell** | new | Splash, login, home screens, app launcher |
| 3 | **LNI Production Schedule — Power Apps Code App** | existing | = Project Scheduler |
| 4 | **Lumineo Scheduling Hub** | existing | = Weekly Scheduler |
| 5 | **Sign Builder Pro — Power Apps Canvas App** | existing | Sign spec builder |
| 6 | **Lumineo Time & Photo Capture** | existing | Mobile time/photo app |
| 7 | **Sales Hub — Mobile Sales Tool** | existing | Sales rep mobile app |

## Project dependency graph

```
                Platform Foundation
                     ▲
        ┌────────────┼────────────┬────────────┬────────────┬────────────┐
        │            │            │            │            │            │
   Switchboard    Project      Weekly       Sign        Time &       Sales
                  Scheduler    Scheduler    Builder     Photo        Hub
                  (LNI Prod)   (Sched Hub)  Pro         Capture
                                            
        ▲
        │ tiles launch ▶
        └────────────────────── (all 5 sub-apps)
```

- **Platform Foundation blocks all six other projects.** Its Phase 1 must complete (or at least Phase 1a + 1b + 1d) before anything else can ship meaningfully.
- **Switchboard depends on Platform Foundation** but is independent of the sub-apps — it can render "Coming soon" tiles for unfinished apps.
- **The five sub-apps are independent of each other.** Each can ship at its own pace once Platform is ready.

## Milestones

Every project has phase-numbered milestones so progress is comparable across them.

### Platform Foundation milestones

| Milestone | Target | Scope |
|---|---|---|
| Phase 0 — Decisions & Provisioning | May 31 | Publisher prefix, envs, BC API |
| Phase 1a — Dataverse Schema | Jun 7 | All 13 shared tables |
| Phase 1b — Security Roles & Entra Mapping | Jun 14 | 5 groups + roles + row filters |
| Phase 1c — Business Central Integration | Jun 21 | Virtual tables + 5 write-back flows |
| Phase 1d — Canvas Component Library | Jun 28 | 10 reusable controls |
| Phase 1e — ALM Pipeline & DLP | Jul 5 | Pipelines, DLP, audit |

### Switchboard milestones

| Milestone | Target | Scope |
|---|---|---|
| Phase 0 — Decisions & Wireframes | Jun 7 | Wireframes, KPI sign-off |
| Phase 1 — Splash, Auth & Role Routing | Jun 21 | Splash + role detection |
| Phase 2 — Home Screens & Universal Widgets | Jul 5 | All 5 home screens, announcements, birthdays, events, photo reel |
| Phase 3 — KPI Strip & Days Since Lost Time | Jul 19 | KpiSnapshot pipeline + safety counter |
| Phase 4 — Weather Card & Crew/Truck Indicator | Aug 2 | Weather chip + 2M 1T badge |
| Phase 5 — Hardening, Notifications & Rollout | Aug 23 | Pilot, push notifs, cutover |

## Issue labels

In addition to the existing labels (Phase 1-5, Power Automate, Data, Logic, Design, Feature, Bug, etc.), seven new labels were created:

| Label | Used on |
|---|---|
| **Switchboard** | Any issue in the Switchboard project |
| **Platform** | Any issue in Platform Foundation |
| **Weather** | Weather card, WeatherCache, related flows |
| **KPI** | KpiSnapshot, KPI cards, per-role KPI selection |
| **Safety** | Days Since Lost Time, SafetyMetric, incident logger |
| **Home Screen** | Per-role home screen issues |
| **Crew Indicator** | 2M/1T badge, CrewAssignment table |

## How docs map to projects

| Doc | Primary project |
|---|---|
| `01-architecture-overview.md` | All — strategic |
| `02-flowchart.md` | All — strategic |
| `03-permissions-and-roles.md` | Platform Foundation (Phase 1b) |
| `04-dataverse-schema.md` | Platform Foundation (Phase 1a) |
| `05-home-screens.md` | Switchboard (Phase 2 + 3) |
| `06-build-plan.md` | All — strategic |
| `07-sub-apps.md` | Per-sub-app projects |
| `08-splash-screen-spec.md` | Switchboard (Phase 1 + 3) |
| `09-weather-card-spec.md` | Switchboard (Phase 4) + Platform (1c) |
| `10-crew-truck-indicator-spec.md` | Switchboard (Phase 4) + Platform (1a + 1c) |
| `11-widget-recommendations.md` | Switchboard (Phase 2 + Phase 6 backlog) |

## How to work this in Linear

1. **Open a milestone** to see the issues for that phase
2. **Each issue is granular** — typically <1 day of work, sized at "estimate 1/2/3/5"
3. **Cross-project blocks** are tracked with Linear's "blocks/blocked-by" relations
4. **Each issue carries a link** to the relevant section of the GitHub design doc (so the spec is one click away)
5. **The Initiatives view** can group multiple projects into a single "Power Apps Platform" rollup if you want a single high-level burndown across all seven

## Linking strategy

- Linear project description → GitHub repo / doc
- Linear issue description → specific doc section (`docs/08-splash-screen-spec.md#days-since-lost-time--detailed-spec`)
- GitHub doc references → Linear project URL
- The Linear "Resources" tab on each project can pin doc URLs as quick links
