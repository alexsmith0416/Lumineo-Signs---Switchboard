# 07 — Sub-App Specs

A one-pager per sub-app. Each is a separate Power Apps solution and a separate Linear project, but they share the Dataverse + component library from `Lumineo-Platform`.

---

## Project Scheduler

**Linear project:** `Project Scheduler`
**Audience:** Operations only
**Type:** Canvas App (no React dependency)

The control panel for jobs. Operations creates and schedules them; everyone else consumes the schedule downstream.

### Screens

1. **Job list** — filterable by status, customer, team lead, date range
2. **Job detail** — header (customer, dates, status) + tabs:
   - Overview (key fields, % complete bar, photos)
   - Tasks (embedded gallery from `Task` filtered to this job)
   - Sign Specs (links to Sign Builder Pro)
   - Files & photos
   - BC Sales Order (virtual table card)
3. **Calendar / Gantt** — timeline view across all open jobs
4. **New Job** — wizard, optionally pre-fills from a Won Opportunity

### Dataverse touch

- Owner of `Job` table
- Reads/writes `Task` (high-level milestones)
- Reads virtual `bc_Customer`, `bc_SalesOrder`

### Launches from Switchboard with

```
{ userEmail, role: "Operations" }
```

---

## Weekly Scheduler

**Linear project:** `Weekly Scheduler`
**Audience:** Operations (all), Sales (read), Employees (filtered to their dept)
**Type:** Canvas App + **existing React app wrapped as PCF**

The weekly task board — a drag-and-drop calendar of `Task` rows.

### Screens

1. **Week view** — the PCF control fills most of the screen; columns are days, rows are people in your dept, cards are Tasks
2. **Task detail flyout** — title, job link, est hours, materials, notes
3. **My week** (employee default) — filtered to `Task.assignedTo = me`
4. **Dept view** (Ops default) — switcher to flip between Prod / Install / Ship

### PCF control (`WeeklyScheduler`)

- Inputs: `userEmail`, `role`, `deptFilter`, `weekStart`
- Outputs: `taskClicked` event (taskId)
- Behavior: handles drag/drop internally, persists via `context.webAPI.updateRecord` to `Task`

### Dataverse touch

- Owner of `Task` table (schema-wise; Project Scheduler creates the high-level ones, this app refines and assigns)

### Launches from Switchboard with

```
{ userEmail, role, deptFilter: role }   // for employees, deptFilter == their dept
```

---

## Sign Builder Pro

**Linear project:** `Sign Builder Pro`
**Audience:** Operations, Sales
**Type:** Canvas App + **existing React app wrapped as PCF**

The build-sheet generator. Sales designs the sign with the customer; Production reads the SignSpec to actually build it.

### Screens

1. **Spec list** — filter by customer, status, linked job
2. **Builder** — the PCF control. Width/height/depth, material picker, BOM, live preview, art file uploads
3. **Approval view** — Ops reviews and approves before production starts
4. **Print/Export** — generates a PDF spec sheet (Power Automate + Word template)

### PCF control (`SignBuilder`)

- Inputs: `specId` (optional, for edit), `opportunityId` (optional, for new), `userEmail`, `role`
- Outputs: `specSaved` (specId), `specSubmitted` (specId)
- Behavior: all the existing React UI for the visual builder lives here

### Dataverse touch

- Owner of `SignSpec`
- Reads `bc_Item` (virtual) for material BOM
- Writes `Photo` (rendered preview thumbnails)

### Launches from Switchboard with

```
{ userEmail, role }
```

---

## Time & Photo Capture

**Linear project:** `Time & Photo Capture`
**Audience:** Operations (admin view), Employees (their own data)
**Type:** Canvas App (mobile-first, no React)

The shop-floor app. Clock in/out, snap photos. Built for tablet + phone with thumb-sized buttons.

### Screens

1. **My day** — big tiles for today's assigned tasks; tap to clock in
2. **Clock-in confirmation** — full-screen, "tap to clock out" button
3. **Photo capture** — camera, caption, optional showcase flag
4. **History** — my time entries this week, sum at bottom
5. **Ops view** — admin-only, sees everyone's timeline and photo feed for moderation

### Special considerations

- **Offline-first** for clock-in (network drops on the shop floor) — `SaveData`/`LoadData`, sync when back online
- **Geofencing** (optional) — flag a TimeEntry if it's logged off-site
- **Photo metadata** — capture device geo + EXIF timestamp into Dataverse for verification

### Dataverse touch

- Owner of `TimeEntry`, `Photo`
- Reads `Task` (today's assignments)

### Launches from Switchboard with

```
{ userEmail, role, todaysTasks: [taskIds] }
```

---

## Sales Hub

**Linear project:** `Sales Hub`
**Audience:** Operations, Sales
**Type:** **Model-Driven App** + **existing React app wrapped as PCF** for any visual/dashboard pieces

Why model-driven: this is a CRM. Accounts → Opportunities → Quotes → Orders. Model-driven gives you views, charts, business process flows, audit, and Outlook integration for free — none of which you'd want to rebuild in canvas.

### Main components

1. **Account form** (= `bc_Customer` virtual table)
2. **Opportunity form** with **Business Process Flow** (Lead → Qualified → Quoted → Won)
3. **Activity timeline** — emails (via Outlook integration), calls, notes
4. **Pipeline dashboard** — built-in MDA chart + optionally a PCF for richer viz
5. **Quote builder** — opens Sign Builder Pro PCF for line items that need a custom spec
6. **Customer 360** — embedded PCF that pulls BC sales history, AR balance, last contact

### PCF controls hosted here

- The existing Sales Hub React app, repurposed as a `CustomerDashboard` PCF on the Account form
- Sign Builder Pro PCF, reused on the Quote line form

### Dataverse touch

- Owner of `Opportunity`
- Reads/writes virtual `bc_Customer`, `bc_SalesQuote`, `bc_SalesOrder` via Power Automate flows

### Launches from Switchboard with

```
{ userEmail, role }
```

(Model-driven URL with the user's home view pinned.)

---

## Cross-app contracts

These are the rules every sub-app honors so the system stays coherent:

1. **`OnStart` reads `Param("userEmail")` and `Param("role")`** — never relies on `User().Email` alone in case the user is impersonated by Ops for support.
2. **All writes go through Dataverse**, never directly to BC. Power Automate flows in `Lumineo-Platform` own the BC writes.
3. **All sub-apps include the Canvas Component Library** so headers and nav stay consistent.
4. **Tile state in Switchboard reflects sub-app deploy status** — a `SystemConfig` Dataverse table has a row per sub-app with `enabled` and `maintenanceMessage`; tiles read it.
5. **No sub-app modifies tables it doesn't own.** If Weekly Scheduler needs to update a Job's % complete, it does it via a Dataverse rollup or a Power Automate flow owned by Project Scheduler — not a direct write.
