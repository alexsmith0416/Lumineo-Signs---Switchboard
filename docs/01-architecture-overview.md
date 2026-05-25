# 01 — Architecture Overview

## The core question: how do you build a "master Power App" with sub-apps?

Power Platform has no native "app of apps" container. There are four real patterns; the right answer for Lumineo is a **hybrid** of two of them.

### Pattern review

| Pattern | What it is | Fit |
|---|---|---|
| **A. Single Canvas App, many screens** | Everything is one .msapp file | Bad — five teams editing one file = merge hell, slow load, hard to scope permissions |
| **B. Model-Driven hub + Custom Pages** | Model-driven app is the shell; each sub-app is a Custom Page (canvas) inside it | Good — native Dataverse, security roles, but limited theming on splash/home |
| **C. Canvas shell app that launches other Canvas apps** | A "Switchboard" canvas app with `Launch()` to open each sub-app | Good — full visual control of splash/home, each sub-app deploys independently |
| **D. Teams app catalog** | Each app is a personal Teams app | Bad fit for shop-floor employees and walk-up tablets |

### Recommended: **C + B hybrid**

- **Switchboard (Canvas App)** is the shell — splash, login routing, role-aware home screen, app launcher tiles, announcements, KPIs.
- **Sub-apps are separate Canvas Apps**, each developed and deployed independently by its own owner. Switchboard launches them with `Launch(SubApp.URL, "userEmail", User().Email, "context", JSON(ctx))` so they boot already knowing who the user is and what they were doing.
- **Sales Hub** lives inside a **Model-Driven App** (it's CRM-shaped — accounts, opportunities, activities — and benefits from views/charts/business process flows out of the box). Switchboard launches it the same way.
- **Existing React apps** get wrapped as **PCF (Power Apps Component Framework) controls** so the React code keeps running, just hosted inside a Canvas/Model-Driven screen. This preserves the engineering already done and gives you a single login surface.

### Why this is the right call

1. **Independent deployment.** Each Linear project ships its own canvas/PCF on its own cadence. Switchboard doesn't have to redeploy when Sign Builder Pro ships a fix.
2. **Independent ownership.** Each sub-app can have its own maker(s) without stepping on the shell.
3. **One identity, one data layer.** All apps share Entra ID auth + the same Dataverse environment, so a Job created in Project Scheduler is visible in Weekly Scheduler, Time & Photo Capture, and Sales Hub — same row, same ID.
4. **React isn't thrown away.** PCF is the Microsoft-sanctioned way to embed React inside Power Apps; it ships as a managed solution component alongside the canvas apps.
5. **Mobile + desktop from day one.** Canvas apps run in the Power Apps mobile app (iOS/Android) and in browser; the same Switchboard works on a shop-floor tablet, a sales rep's phone, and an ops manager's laptop.

## High-level component map

```
                    Microsoft Entra ID  (Azure AD groups: ops / sales / prod / inst / ship)
                              │
                              ▼
                ┌─────────────────────────────┐
                │  Switchboard  (Canvas App)  │   ← splash, login, role router, home, launcher
                └──────────────┬──────────────┘
                               │ Launch() with user + context
       ┌──────────────┬────────┼────────┬─────────────────┬──────────────────┐
       ▼              ▼                  ▼                 ▼                  ▼
 Project        Weekly            Sign Builder      Time & Photo         Sales Hub
 Scheduler      Scheduler         Pro               Capture              (Model-Driven)
 (Canvas)       (Canvas + PCF)    (Canvas + PCF)    (Canvas, mobile)     (+ PCF)
       │              │                  │                 │                  │
       └──────────────┴──────────────────┴─────────────────┴──────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │     Dataverse       │  ← shared tables (Jobs, Customers, Tasks, …)
                              └──────────┬──────────┘
                                         │ virtual tables + Power Automate
                              ┌──────────▼──────────┐
                              │ D365 Business       │  ← source of truth for Customers, Items,
                              │ Central             │     Sales Orders, Inventory, Vendors
                              └─────────────────────┘
```

## Tech stack at a glance

| Layer | Tool | Why |
|---|---|---|
| Identity | Microsoft Entra ID (Azure AD) | Same accounts users already have for M365 |
| Shell | Canvas Power App | Pixel-perfect splash/home; mobile + web; theming |
| Sub-apps | Canvas Power Apps + 1 Model-Driven (Sales Hub) | Right tool per app shape |
| Existing React | PCF controls | Keep React investment, host in Power Apps |
| Data | Dataverse | Native Power Apps store, RBAC, audit, virtual tables to BC |
| BC integration | Dataverse Virtual Tables (read) + Power Automate (write) | Real-time reads, durable writes |
| Files / photos | Dataverse File columns or SharePoint doclib | File columns for ≤128 MB; SharePoint for larger |
| Push notifications | Power Automate → mobile push | Birthdays, job assignments, completion alerts |
| Shared UI | Canvas Component Library | One header, nav, tile, KPI control reused everywhere |
| ALM | Solutions + managed exports → Dev/Test/Prod | Standard Power Platform pipeline |

## Linear project mapping

Each sub-app is already a Linear project. Add one more for the shell:

- `Switchboard` (new) — shell, splash, login routing, home screens, KPI widgets
- `Project Scheduler`
- `Weekly Scheduler`
- `Sign Builder Pro`
- `Time & Photo Capture`
- `Sales Hub`

A seventh internal project — `Platform` — should hold the shared Dataverse schema, security roles, BC connector setup, and the Canvas Component Library. It's the dependency for everything else.
