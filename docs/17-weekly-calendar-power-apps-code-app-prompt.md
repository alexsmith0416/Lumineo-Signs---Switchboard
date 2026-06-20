# Weekly Calendar · Power Apps Code App Build Prompt

> The Project Scheduler prototype ships inside Switchboard as the **Weekly Calendar** app.
> This file is the brief you paste into Copilot Chat, Claude Code, or Cursor Composer
> when you start the production Code App build in VSCode.

---

## Mission

Recreate the React + TypeScript prototype that lives on branch `claude/intelligent-cray-ffmS4` (folder `scheduling-app/`) of repo `alexsmith0416/Lumineo-Signs---Switchboard` as a **production Power Apps Code App** registered as **Weekly Calendar** inside the Switchboard host shell.

**Match the prototype 100%.** Every screen, interaction, animation, color, font weight, padding, border radius, focus ring, hover state, drag-and-drop behavior, cascade dialog, sub-nav, theme toggle, and keyboard shortcut in `scheduling-app/` is the spec. Where the prototype stubs (Power SDK, Business Central API, Dataverse mutations), wire the real connector. Where the prototype is hard-coded, read from Dataverse.

The deliverable is a Code App registered to Dataverse, deployable to Power Platform, that compiles clean, passes the 49 engine tests already in the prototype, and works against live BC data.

---

## Required reading (clone first, build second)

1. `scheduling-app/CLAUDE.md` — onboarding notes, brand tokens, engine contracts that **must not break**.
2. `docs/15-scheduling-app-spec.md` — the full build spec (the long-form version of this brief).
3. `docs/16-scheduling-app-starter-prompt.md` — production starter prompt that ships alongside.
4. `docs/DESIGN.md` — the Switchboard design system (light + dark tokens, Rig Sans typography, sidebar layout). **Single source of truth — no hex values in components.**
5. `scheduling-app/src/engine/` — pure-TypeScript scheduling engine. Port verbatim. 49 Vitest tests cover its behavior.
6. The user's Canvas app source `Lumineo_Signs_Project_Schedule_Hub_2.msapp` — extract with `unzip` and read `Src/Production Scheduling.pa.yaml`. The `txtJobSearch` / `galPlanningLines` / `Dropdown_Employee` / `DP_StartDate` / `Schedule` button flow is the Add Job behavior. Mirror it.

---

## Architecture (do not deviate)

```
Power Apps Code App — "Weekly Calendar"
├── React 18 + TypeScript + Vite (already in scheduling-app/)
├── Power SDK — Dataverse reads/writes, BC connectors
├── Engine (pure TS — copy unchanged from scheduling-app/src/engine/)
│   ├── types · capacity · time-walker
│   ├── cascade (push + pull-back, BFS propagation)
│   ├── conflicts · scenarios
│   └── 49 Vitest tests — all must still pass
├── Services layer (I/O boundary; async; returns engine types)
│   ├── dataverse.ts — replace prototype stubs with real Power SDK calls
│   ├── bc.ts — BC Analytics connector calls (jobs, jobPlanningLines, customers)
│   ├── planning-line-mapping.ts — keep keyword rules; ADD a Dataverse-table fallback
│   └── auto-schedule.ts — existing
├── Stores (Zustand) — factory pattern preserved
│   ├── createScheduleStore(dataSource) — production / install WK / install NEK / shipping
│   └── createScenarioStore(dataSource) — per-region scenario sandbox
└── Components — port 1:1 from scheduling-app/src/components/
```

**Engine contract — these are non-negotiable:**
1. Pure TS. No React, no Power SDK, no Dataverse imports in `engine/`. Only date-fns.
2. Immutability: `shiftTask`, `runScenario` always `cloneContext` first.
3. Effective hours = `(overrideHours ?? estimatedHours) / employee.productivityRate`.
4. Dept flow: task at flowOrder N cannot start before all flowOrder < N tasks in same job have ended.
5. Same-employee queue: never overlaps. Cascade pushes later tasks forward.
6. Locked tasks (`isLocked: true`) never move. Cascade flows around them.
7. Capacity walking: `calculateEndTime` walks day-by-day via `getDayCapacity`. Days with 0 capacity are skipped, **not zeroed**. Weekends skipped per `worksWeekends` flag.

---

## Feature surface (must match the prototype)

### Calendar surfaces
- **Production calendar** — drag-to-move, drag-to-resize, sticky resource column + dept header band, lane-allocated Gantt overlay cards, week navigation (Prev / Today / Next), 🖨 print button, Add Job button (brand red).
- **Installation calendar** — same engine; WK ↔ NEK region toggle, stacked card layout (job/customer/desc on top, crew/weather/$ on bottom), $1.1M/month regional billing goal.
- **Shipping calendar** — destination-city rows (Wichita / Dodge City / Topeka / Lawrence / Olathe), custom locations in `State - Customer` format.
- **Drag-drop on top of existing cards must stack** — forward the drop event from `.gantt-card` to the row's day strip via clientX → day index. `computeRowCards` already lane-allocates.

### Engine (port from prototype as-is)
- Push propagation BFS — only same-employee overlap or same-job downstream-dept conflict.
- Pull-back — tasks return to `preferredStart` once the slot frees up.
- Cascade-aware confirm dialog with four choices: Cancel · Move only this · Try in Sandbox · Continue.
- Bidirectional behavior verified by `cascade.test.ts > "bidirectional pull-back"` and `cascade-repro.test.ts`.

### Job placement (Canvas-mirror Add Job flow — THE focus)

Recreate the three-stage flow from `Production Scheduling.pa.yaml`. The React prototype's `BcCanvasFlow` in `scheduling-app/src/components/AddJobPanel.tsx` is the working reference. In the Power Apps Code App, swap the mock data source for the real BC connector calls:

**Stage 1 — Job search**
- Input field with placeholder "Search BC job number (e.g. J103101 or 103101)…"
- On Search (Enter or button):
  ```
  // Mirror Canvas SearchIcon3.OnSelect
  varNormalizedJobNo = Upper(If(StartsWith(input, "J"), input, "J" & input))
  varJobRecord = LookUp('jobs (microsoft/analytics/v1.0)', 'No.' = varNormalizedJobNo)
  varSellToCustomer = LookUp('customers (v2.0)', number = varJobRecord.billToCustomerNo)
  colPlanningLines = Filter('jobPlanningLines (microsoft/analytics/v1.0)', 'No.' = varNormalizedJobNo)
  ```
- Result list shows JobNo, customer display name, due date.

**Stage 2 — Planning lines (Resource only)**
- After job pick, render a gallery filtered to `Type = "Resource"` — drops Item / Cost / Text lines. No drill-down through Jobs → Job → Planning Lines required.
- Each row: description (ExtraBold 12.5pt) + estimated hours + auto-detected department chip.

**Stage 3 — Auto-resolve department + employee + date**
On line pick:
```
varSelectedPlanningLine = ThisItem
varSelectedDepartment = LookUp(
  'Planning Line Department Maps',
  Keyword in Lower(ThisItem.description),
  Department
)
```
Then surface:
- Department chip (read-only, dept-color background)
- Employee dropdown filtered to `Filter(Employees, Department.'Department Name' = varSelectedDepartment || Department.'Department Name' = "Fabrication Help")`
- Start date picker — pre-fills the clicked cell's date when invoked from a calendar cell click
- Live engine preview showing computed start → end (skips weekends + honors resource calendar)

**Schedule button** writes the planning line:
```
Patch('Production Schedule Lines', Defaults('Production Schedule Lines'), {
  JobNo, CustomerName, PlanningLineDescription,
  Department, Employee,
  EstimatedHours, ScheduledHours,
  StartDateTime: startAt8am,
  EndDateTime: calculateEndTime(...)   // ← engine, NOT Canvas's RoundUp(hrs/8)-1 days
})
```

**Improvement over the Canvas formula:** Canvas computes `EndDateTime = startDT + (RoundUp(hrs/8) - 1) days` — naïve calendar days, doesn't skip weekends. Route through the engine's `calculateEndTime` so a 16h Friday drop lands as Fri + Mon, not Fri + Sat.

### Custom (non-BC) cards
- Seven presets, all locked-by-default: PTO · Inventory · Truck Maintenance · Med Cert · DOT Physical · Crane Cert · Holiday-Shop-Closed.
- Holiday auto-applies to whole roster.
- Cards survive cascades (engine flows around `isLocked`).

### Visibility + filtering
- Show/hide departments and individual employees (persisted per user).
- Install WK ↔ NEK region toggle.
- Shipping custom locations in `State - Customer` format.

### Scenario Sandbox + Monthly Plan
- Per-region scenario stores (Production / Install WK / Install NEK / Shipping).
- Embedded read-only calendar preview reflects every staged change.
- Schedule diff + impact summary; commit applies atomically; revert discards.
- Monthly Install Plan — combined WK + NEK billing roll-up, $1.1M/month goal, one-click AI auto-fill greedily assigning ready-to-install jobs to weeks respecting per-region crew availability + dollar headroom.

### Shell & navigation
- Switchboard sidebar (248px, surface/sidebar) with brand block, MAIN (Dashboard, My Schedule), APPS (**Weekly Calendar [active]**, Weekly Scheduler, Sign Builder Pro, Job Punches, Estimating, Sales Hub, Calendar), OTHER (theme pill, Settings, Help).
- Topbar with `SWITCHBOARD · WEEKLY CALENDAR` eyebrow, ExtraBold 22pt title, search pill, user chip (32px avatar + name + UPPERCASE role).
- Sub-nav pill row inside main: Production / Installation / Shipping / Monthly Plan / Scenarios.
- Mobile: under 900px, sidebar collapses to a hamburger drawer; iOS touch-drag polyfill (`mobile-drag-drop`) is required.

---

## Design system (docs/DESIGN.md — no exceptions)

- **Tokens** are theme-scoped via `[data-theme]`. Light + dark resolutions both ship. Never hard-code a hex. Use semantic names: `--surface-raised`, `--text-dim`, `--accent-brand`, `--status-red-soft`, etc.
- **Typography**: Rig Sans family. Weights in use: Regular (400), Bold (700), ExtraBold (800), Thin (200) for the lightest sub-text. No font size below 9pt.
- **Page title** ExtraBold 22pt. **KPI values** ExtraBold 22pt. **Section captions** ExtraBold 9pt UPPERCASE tracked 0.5px.
- **Spacing scale** `2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 24 · 28 · 32`. Card padding 16. Section gap 18. Main content padding 22/28/32.
- **Radii**: pill 999, card 14, inset 12, small card 10, nav active 8, swatch 3.
- **Flat surfaces** — borders + surface contrast, not heavy shadows.
- **Status semantics**: green / amber / red, always paired with a label or `▲`/`▼` icon, never color alone.
- **Default theme on first load = light.** Persist user toggle to `localStorage`. Do not honor `prefers-color-scheme`.

---

## Dataverse data model (Lumineo Signs custom tables)

Tables to create/reuse (prefix `crfdf_`):

| Logical name | Purpose |
|---|---|
| `crfdf_productionscheduleline` | Production schedule lines |
| `crfdf_installationscheduleline` | Install schedule lines |
| `crfdf_shippingscheduleline` | Shipping schedule lines |
| `crfdf_employee1` | Employees roster |
| `crfdf_department1` | Departments with `crfdf_floworder` (Routing 1 → Steel MFG 6) |
| `crfdf_jobestimateline` | Mirror of BC Job Estimate Lines (interim) |
| `crfdf_planninglinedepartmentmap` | Keyword → Department lookup (the load-bearing wall) |
| `crfdf_employeeworkhours` | Per-employee daily capacity overrides |
| `crfdf_overtimeoverride` | Per-employee daily overtime caps |
| `crfdf_crewassignment` | Install crew + truck counts per schedule line |
| `crfdf_weathercache` | Cached OpenWeatherMap responses by ZIP |
| `crfdf_zipgeo` | BC ZIP → lat/lng for weather + map |
| `crfdf_schedulerconfig` (NEW — see additions below) | Single-row config |

Schema details are in `docs/04-dataverse-schema.md`.

---

## Connectors

- **BC Analytics v1.0** — `jobs`, `jobPlanningLines`, `customers (v2.0)`. Read-only; writes queue through Power Automate flows.
- **OpenWeatherMap** — keyed by `installZip`. Cached 6 hours in `crfdf_weathercache`.
- **Power Automate flows** — seven write operations to BC: start, end, employee, department, duration, lock, custom. Idempotent keys. See `docs/14-bc-write-operations.md`.

---

## Three additions to land before merge (recommended)

These are small in scope, high in operational value, and best built once during the port rather than retrofitted later.

1. **`crfdf_schedulerconfig` Dataverse row** — push the hard-coded constants out of code: `dayStartHour` (8), `dayEndHour` (16), `monthlyInstallGoal` ($1,100,000), per-year shop holidays. Supervisors edit it in a `Settings` page; engine reads at load. Pairs naturally with the Holiday-shop-closed custom card auto-apply.

2. **Audit log surface** — every `shiftTaskAndCommit` already returns a `moved` set. Write each delta to a `crfdf_scheduleaudit` table (line id, before/after start, before/after employee, who, when, cascade reason). Surface as a per-card "history" tab in the JobCard tooltip. The data is free — just needs a sink + a tiny UI.

3. **Right-click empty cell → Add Job** — currently the prototype opens the Add Job panel on left-click. Move it to right-click (or long-press on touch) so left-click stays free for selection and double-click for the JobCard detail panel. Cleaner mouse semantics matching the BC integration brief's Ask #1.

(Skip if you want the port to ship faster; none break the existing feature set.)

---

## File structure to mirror

```
src/
  engine/           pure TS — port unchanged from prototype
  services/         I/O boundary — Power SDK, BC, weather connectors
  hooks/            React glue (debounced search, live preview)
  store/            Zustand factories: live + scenario stores
  components/       UI; imports from store, never from services directly
  styles/           Single CSS file with the design tokens
  data/             Dev-only fixtures; production reads from services
```

When porting, copy `engine/` and the Vitest tests **verbatim**. Then port `components/` one at a time, replacing any mock-data imports with `services/` calls. The store factories already accept a `ScheduleDataSource` — swap the dataverse stub for the real Power SDK call.

---

## Acceptance criteria

- [ ] `npm run typecheck` — clean.
- [ ] `npm run test` — all 49 prototype tests pass unchanged.
- [ ] `npm run build` — production bundle compiles.
- [ ] Light + dark themes both render correctly on every screen. Default to light on first load.
- [ ] All five views in the sub-nav (Production / Installation / Shipping / Monthly Plan / Scenarios) work.
- [ ] Drag-and-drop, drag-to-resize, cascade dialog, pull-back, scenario sandbox commit/revert all match prototype behavior.
- [ ] Drop on top of an existing card stacks (forward to row's day strip via clientX).
- [ ] Canvas-mirror Add Job flow searches live BC, auto-detects department from the keyword table, filters employees by department, splits hours across 8-hour workdays skipping weekends.
- [ ] Mobile (<900px): hamburger drawer, sticky left column during horizontal scroll, iOS touch-drag works in Safari.
- [ ] Code App registers to Dataverse as **Weekly Calendar** and the host Switchboard shell loads it without console errors.

---

## Out of scope (do not build)

- Switchboard sidebar items other than Weekly Calendar (Dashboard, Sales Hub, etc. are separate apps).
- Time & Photo Capture clock-in/out flow.
- Weekly Scheduler, Sign Builder Pro, Job Punches, Estimating, Sales Hub.
- Push notifications (a separate Power Automate flow, not part of this Code App).

---

**Reference the prototype constantly.** When in doubt about a visual detail or interaction, run `npm run dev` in the prototype repo and reproduce what you see. The prototype is the contract; this brief is the map.
