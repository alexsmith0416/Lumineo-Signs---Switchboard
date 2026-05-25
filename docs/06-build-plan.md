# 06 — Build Plan

Six phases. The order matters — the platform foundation has to land before the apps can plug into it. Each phase maps to Linear milestones.

## Phase 0 — Decisions & access (week 0)

Nothing builds until these are signed off:

- [ ] Pick the **Power Platform environment(s)** — at minimum Dev / Test / Prod, plus a personal sandbox per maker
- [ ] Dataverse capacity check (file storage estimate for photos)
- [ ] Business Central admin grants the Power Platform service principal API access
- [ ] Microsoft Entra admin creates the five security groups
- [ ] Decide on **solution publisher prefix** (e.g. `lum_`) — locks in forever, choose carefully
- [ ] Decide where **large photo files** live (Dataverse File column vs SharePoint) — drives T&P architecture

## Phase 1 — Platform foundation (weeks 1–3)

Linear project: `Platform`. Owned by one senior maker. **Blocks everything.**

- [ ] Create solution `Lumineo-Platform`
- [ ] Build all Dataverse tables from `04-dataverse-schema.md`
- [ ] Configure BC connector + virtual tables for `Customer`, `Item`, `SalesOrder`, `Vendor`, `Inventory`
- [ ] Create Dataverse security roles (Operations / Sales / Prod / Install / Ship)
- [ ] Map Entra groups → Dataverse teams → security roles
- [ ] Seed `UserProfile` rows for everyone (one-time Power Automate from Entra)
- [ ] Build the **Canvas Component Library** with header, nav, tile, KPI card, announcement card, photo carousel, birthday strip
- [ ] Build the three foundational Power Automate flows (`CreateSalesQuote`, `ConvertQuoteToOrder`, `TriggerInvoicing`)
- [ ] Set up ALM pipeline (managed solution export → Test → Prod) using Power Platform Pipelines or Azure DevOps

**Exit criteria:** a maker can stand up a throwaway canvas app, drop in the component library, query a Job and a `bc_Customer` in one screen, and a test SalesQuote lands in BC.

## Phase 2 — Switchboard shell (weeks 3–5)

Linear project: `Switchboard`. Can start once the component library exists.

- [ ] Splash screen with logo + loading
- [ ] Auth + role detection in `OnStart` (see `03-permissions-and-roles.md`)
- [ ] Unauthorized screen
- [ ] Five home screens (Ops, Sales, Prod, Install, Ship) — universal widgets first, then role-specific
- [ ] App launcher tiles (with role filter and disabled state if dependent app not yet deployed)
- [ ] Announcements editor (Ops-only screen for CRUD on `Announcement`)
- [ ] `Event` calendar editor (Ops-only)
- [ ] Photo reel: pulls `Photo` where `isShowcase=true`
- [ ] Birthday strip: rolling 14-day window from `UserProfile`

**Exit criteria:** real users in each group log in, land on the right home, see real announcements/birthdays/events. Tiles for not-yet-built sub-apps show "Coming soon."

## Phase 3 — First two sub-apps (weeks 5–9, parallel)

Pick the two with the **least React dependency** so the team learns the platform before integrating PCF:

- **Project Scheduler** (Operations only) — pure canvas, no React. Good starter.
- **Time & Photo Capture** (Operations + Employees) — canvas, mobile-first. Big employee impact.

Each sub-app:
- [ ] Own solution (`Lumineo-ProjectScheduler`, `Lumineo-TimeAndPhoto`)
- [ ] Depends on `Lumineo-Platform` (Dataverse, component library)
- [ ] Reads `Param("userEmail")` / `Param("role")` in OnStart for routing
- [ ] Tile in Switchboard turns "live" once deployed

**Exit criteria:** a Production employee opens Switchboard on a tablet, taps Time & Photo, clocks in to a task, uploads a photo, marks the task done, and an Ops user sees the rollup on Project Scheduler.

## Phase 4 — React-backed sub-apps via PCF (weeks 9–14)

The three with existing React: **Weekly Scheduler**, **Sign Builder Pro**, **Sales Hub**.

For each:
- [ ] Audit existing React app — what hooks, what state, what API it expects
- [ ] Create PCF control project (`pac pcf init`)
- [ ] Move React code into the PCF control's `index.ts`/components
- [ ] Replace any direct REST calls with calls to Dataverse via the PCF context (`context.webAPI`)
- [ ] Expose inputs (selected job ID, user email, role) as PCF properties
- [ ] Expose outputs (e.g. "user saved" event) for the host canvas screen
- [ ] Package PCF inside the sub-app's solution
- [ ] Build the host Canvas (or Model-Driven, for Sales Hub) screens around the PCF
- [ ] Wire screens to launch from Switchboard tile with `Param`s

**Why this order:** PCF has a real learning curve. Doing it twice in pure canvas first means the team isn't fighting two unknowns at once.

**Exit criteria:** each PCF control renders inside its host Power App, reads/writes Dataverse, and Switchboard launches it with the right context.

## Phase 5 — Hardening & rollout (weeks 14–16)

- [ ] Performance pass: each home screen <2s to interactive on the lowest-spec target device
- [ ] Offline behavior for Time & Photo (the shop tablets sometimes lose Wi-Fi) — uses `LoadData`/`SaveData`
- [ ] Push notifications via Power Automate for: task assigned, job due tomorrow, birthday today
- [ ] Audit: enable Dataverse auditing on `Job`, `Opportunity`, `TimeEntry`
- [ ] DLP (Data Loss Prevention) policies — block consumer connectors in the production environment
- [ ] User training: one 30-min session per role, recorded
- [ ] Help center: a `Documents` library with how-tos, linked from a "?" button in the header
- [ ] Pilot with one team per role (1 ops, 2 sales, 3 prod, 2 install, 1 ship) for two weeks
- [ ] Cutover

## Phase 6 — Next quarter (post-launch)

Things to keep on the radar but **not** in MVP:

- Copilot Studio bot embedded in every home screen
- Power BI dashboards as a sixth "App" tile for Ops
- Customer portal (Power Pages) — external view of Job status
- Automated job cost rollups vs. quoted price → margin alerts in Sales Hub
- Outlook add-in for Sales (log emails to Opportunity from Outlook)

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| BC connector rate limits | Slim cache table for typeahead; virtual tables only for detail views |
| PCF learning curve | Phase 3 first in pure canvas; one senior maker builds the first PCF, others follow the pattern |
| Photo storage cost in Dataverse | Use SharePoint doclib for full-res, thumbnail in Dataverse File column |
| One person editing the canvas app | Sub-apps are independent; component library is version-controlled; co-authoring on canvas is now GA |
| Entra group memberships drift | Nightly Power Automate audits `UserProfile.active` vs. group membership |
| Solution import conflicts Dev → Prod | Strict managed-solutions discipline; no unmanaged changes in Prod |

## Effort estimate (very rough)

| Phase | Wall-clock | Headcount (FTE) |
|---|---|---|
| 0 — Decisions | 1 wk | 0.5 |
| 1 — Platform | 3 wk | 1.0 |
| 2 — Switchboard | 2 wk | 1.0 |
| 3 — First 2 apps | 4 wk | 2.0 |
| 4 — React PCF apps | 5 wk | 2.0 |
| 5 — Hardening | 2 wk | 1.5 |
| **Total** | **~16 wk** | **~peak 2 FTE** |
