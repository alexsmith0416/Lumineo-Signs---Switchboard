# START HERE — Lumineo Scheduling Hub

**Point Claude at this file first in any new terminal.** It's the map: what this
project is, where everything lives, and exactly how to commit + deploy to the
live app. Read this, then read `apps/scheduling/CLAUDE.md` for the deep
architecture/engine detail.

---

## 1. What this project is

The **Lumineo Scheduling Hub** — a React + TypeScript **Power Apps Code App**
that replaces the old Canvas Production Scheduling app. Three calendars
(Production, Installation, Shipping) share one constraint-based scheduling
engine, plus a Scenario Sandbox for what-if planning, a Monthly Plan roll-up,
and a per-user "My Schedule" view.

- **Live app name:** Lumineo Project Scheduler
- **Linear project:** https://linear.app/lumineosigns/project/lumineo-scheduling-hub-b4e29b417bee
- **Issues:** `ALE-79`–`ALE-87`, milestones M0–M8 (status table in `apps/scheduling/CLAUDE.md`)

## 2. Where everything lives

| Thing | Path |
|-------|------|
| **Repo root** | `C:\Users\Alex\lumineo-scheduling-port` |
| **The app** (run all app commands from here) | `apps/scheduling/` |
| Deep dev notes (architecture, engine contract, brand tokens) | `apps/scheduling/CLAUDE.md` |
| App overview / what works today | `apps/scheduling/README.md` |
| Source | `apps/scheduling/src/` |
| Deploy config (appId, env, buildPath) | `apps/scheduling/power.config.json` |
| Dataverse admin one-off scripts | `apps/scheduling/scripts/*.ps1` |
| Power Automate flows | `apps/scheduling/flows/` |
| **User guide** (ship-to-users doc + in-app Help — keep updated every deploy) | `apps/scheduling/public/USER-GUIDE.html` |

> ⚠️ This working copy (`lumineo-scheduling-port`) is **not** the OneDrive
> "Lumineo Signs — Switchboard" repo. All scheduling work happens here.

### Source layout (`apps/scheduling/src/`)

```
engine/      pure TypeScript scheduling logic — imports nothing but date-fns
services/    I/O boundary (Power SDK, BC analytics) — currently mostly stubbed
             current-user.ts → user roles/access (see §5)
store/       Zustand stores; live + scenario kept independent
hooks/       React glue (debounced search, live preview math)
components/  UI (scenario/ subfolder for sandbox); imports from store, not services
styles/      lumineo.css — design tokens + component styles
data/        mock fixtures for the stubbed services
generated/   generated Dataverse model/service types
```

### ⚠️ Write-path invariant — "my edit didn't take, but worked the 2nd time"

**This bug is fixed (Aug 16, 2026) and now has TESTS holding the line. Read this
before touching any write path.**

The symptom: make a change → the board "quick loads" → the change is gone → do it
again and it sticks. Root cause was two-layered:

1. A write failed, and the store's failure handler **reloaded the board**, which
   **overwrote the optimistic edit** with pre-edit server state. A save problem
   showed up as *silently discarded work* — the worst possible framing.
2. Writes failed far more often than they should have:
   - `writeWithRetry` only inspected a **returned** `{success:false}`. The Power
     Apps host bridge (`client.executeAsync`) **REJECTS** when it isn't warm —
     which is exactly the first action after load. A rejection blew past the
     retry entirely. **This is why it was always the first action.**
   - Retry was gated on a **whitelist** of transient-looking message text; any
     unanticipated message (or an empty one) counted as permanent.
   - The invariant said "all writes go through `dv*`" but nothing enforced it —
     **36 of 58 write calls had drifted to raw `S.*RecordWithOrganization`**,
     including install-assist and roster edits.

The rules now, in force:

- **A failed write NEVER reverts the UI.** Stores call
  `persistOrReport(label, op)` / `reportWriteFailure(...)` from
  `store/write-status-store.ts`. The edit stays on screen, the failure is
  recorded with its retry, and `SaveStatus` tells the user. **Do not** add
  `catch → loadWeek()` / `catch → load()` back to any edit path.
- **Every Dataverse write goes through `dvCreate`/`dvUpdate`/`dvDelete`** in
  `services/dataverse-live.ts`. They retry on BOTH failure shapes (returned and
  thrown), 5 attempts, ~3s of backoff, and retry **anything not positively
  recognised as permanent** (`services/dv-write.ts`). Never call
  `S.*RecordWithOrganization` directly — `write-path.test.ts` fails the build if
  you do.
- Tests that enforce all of the above (don't delete them):
  - `services/write-path.test.ts` — no direct SDK writes outside the 3 helpers.
  - `services/dv-write.test.ts` — retry classification, incl. "unknown error ⇒ retry".
  - `store/optimistic-edit.test.ts` — a failing write keeps the edit on screen
    (verified to FAIL against the old reload behaviour).
- When adding a NEW editable action, persist via `persistOrReport` and add a case
  to `optimistic-edit.test.ts`.

## 3. Run it locally

```powershell
# from apps/scheduling/
npm install          # first time only
npm run dev          # Vite dev server, http://localhost:5174 (boots with mock data)
npm run typecheck    # tsc -b --noEmit
npm run build        # production build → dist/
npm run test         # vitest
```

Dev mode uses mock data and an admin stand-in user; changes persist in memory
only. Set `VITE_DATA_SOURCE=live` (or a prod build) to hit the real Power SDK.

## 4. Commit + deploy to the live app

Deploy is **build → push**. Run both from `apps/scheduling/`:

```powershell
npm run build
$env:NODE_OPTIONS="--use-system-ca"; pac code push
```

> 🔴 **Always `git commit` + `git push` every time you deploy.** A `pac code push`
> only ships the built files to the live app — it does **not** save your source
> to git. Right after every successful deploy, commit the changed source and push
> the branch so the repo matches what's live (see **Git workflow** below).

- **Why the env var:** plain `pac code push` fails with
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — bundled Node doesn't trust the local root
  CA. `--use-system-ca` fixes it. (Bash equivalent: `NODE_OPTIONS=--use-system-ca pac code push`.)
- **Auth:** deploy uses the active pac profile **`LumineoFoundation-Dev`**
  (asmith@lumineosigns.com). Check with `pac auth list`; the active one is
  marked `*`. It must point at env `Alex Smith's Environment`
  (`org8fa22efd.crm.dynamics.com`).

**Deploy target (from `power.config.json`):**
- App ID: `d954d7c6-698a-4563-8e03-f44df090778f`
- Environment ID: `484cdd3c-4409-e741-bbd5-7c210e00310e`
- Dataverse org: `org8fa22efd.crm.dynamics.com`
- Build output pushed: `dist/` (entry `index.html`)

**Share/bookmark this link** — it hides the purple Power Apps header by default
(`?hideNavBar=true`). Users can toggle the header back on in **Settings → Display**:
```
https://apps.powerapps.com/play/e/484cdd3c-4409-e741-bbd5-7c210e00310e/a/d954d7c6-698a-4563-8e03-f44df090778f?hideNavBar=true
```
The header is Power Apps player chrome (outside the app), so hiding it is a URL
param, not app CSS — the in-app toggle just reloads at the with/without-param URL.
IDs are duplicated in `src/services/power-host.ts`; keep them in sync with
`power.config.json` if the app is ever redeployed to a new environment/app id.

### Git workflow
- Branch convention: `claude/<slug>` for in-progress work.
- **Main branch for PRs:** `claude/master-power-apps-design-05pjY` (this is
  `origin/HEAD`).
- Remote: `origin` → `github.com/alexsmith0416/Lumineo-Signs---Switchboard`.
- Commit and push only when asked. If on the main branch, branch first.

### Keep the user guide current (audit at session START + on EVERY deploy)

There is a customer-facing user guide at **`apps/scheduling/public/USER-GUIDE.html`**
— a self-contained, brand-styled HTML doc (Lumineo logo + colors). It ships in
the app bundle (Vite `public/`) and is surfaced in-app under **Help** (sidebar →
Help → embedded guide + Download PDF), and is also sent to users directly. It is
the single place users learn what the app can do.

🔴 **At the START of every development session** — before doing new work — audit
the guide against the app so it never drifts:
1. `git log --oneline -25` and skim what shipped recently.
2. Compare it to the guide **body** (§4 Legend, §5 Features, §6 Walkthroughs,
   §7 Roles, §13 Glossary). If a shipped feature, a change to the job process /
   flow, a role/permission change, or any user-facing behavior is missing or
   wrong in the body, fix it this session — don't wait for the user to notice.

🔴 **Whenever a change adds, changes, or removes a user-facing feature** (a new
feature, a change to the job process/flow, a role/permission change, or any UI
affordance) update the guide in the SAME change, in this order of importance:
1. **Update the relevant BODY section(s)** — Features, Walkthroughs, Legend,
   Roles, Shortcuts, Troubleshooting, Glossary, FAQ — so the guide *describes*
   the feature. ⚠️ This is the step that gets skipped: a "What's New" row is
   **not** enough on its own — the body must actually teach the feature.
2. Add a dated row to the **"What's New"** table (§14, newest first).
3. Bump the version/date in the footer on a meaningful revision.

Treat this like updating tests: a user-facing change isn't "done" until the
guide **body** reflects it. (Pure internal/refactor changes with no user impact
don't need a guide edit.) Open the file in a browser to preview; it prints
cleanly to PDF for distribution.

### Keep the interactive tour current (significant features)

The demo sandbox (Help → **▶ Launch demo & tutorial**, and every Demo-type
login) runs a guided tour: **`src/components/DemoTutorial.tsx`**. The
*Scheduling* track covers the core board; the *Full* track walks every screen.

🔴 **When a change adds a significant user-facing feature** — a new screen,
a new toolbar button or panel, a new workflow (including ones that start
outside the app, like the BC punch screens) — **add a step to `FULL_STEPS`**
in the same change, next to the steps for the screen it lives on:
1. Spotlight the real control: give it a `data-tour="…"` attribute and point
   the step's `target` at it (`view` = the screen to open first). Use
   `placement` so the card doesn't cover what it describes.
2. For something that lives outside the app (Business Central), use an
   `image` step: put a screenshot in **`src/assets/tour/`** (crop away empty
   space), add it to `TOUR_IMAGES` in `src/assets/tour/index.ts` (embedded as a data
   URL by `assetsInlineLimit` in vite.config.ts — the Power Apps host does NOT
   serve loose image files; `?inline` doesn't work for images in this Vite)
   and set `image: { key: "<name>", alt: "…" }`.
3. Keep the body to 2–3 sentences in the guide's plain voice, then check it:
   `npm run dev` → Help → Launch demo → Full tour → step through to it.
4. If the step points at something the demo can't safely edit (the Jobs list
   is the REAL list — it's view only in the demo), say so in the step.
5. Mention the new tour coverage in the guide's "What's New" row.

Small tweaks to an existing screen don't need a step; when unsure, ask Alex.

## 5. User roles & access (code, not data)

Access is defined in **`src/services/current-user.ts`**, not in Dataverse:

- `USER_DIRECTORY` maps login email (lowercase) → `UserType`
  (`admin` / `ops` / `production` / `install-wk` / `install-nek` / `sales` / `pm`).
- `TYPE_CONFIG` sets each type's default screen, `$`-visibility, and Monthly-plan
  access. `$` values + Monthly Gameplanning are Admin/Ops only.
- Unlisted logins fall back to a derived type (shared floor account → Sales/PM
  code → else admin).
- **To add/onboard a user:** add the email to `USER_DIRECTORY`, then build + push (§4).

## 6. Pick up where I left off

At the start of a session, to reorient quickly:

```powershell
git status
git log --oneline -10
git branch --show-current
```

Then check the **Milestone status** and **Known gaps** sections at the bottom of
`apps/scheduling/CLAUDE.md` for what's done vs. still stubbed (notably: Power SDK
and BC analytics are stubbed; no test suite yet; calendar is a hand-rolled grid).

### 🔖 Next up (keep this current — it's the "where we left off" note)

> ⚠️ **Claude: update this block at the END of each session** so the next
> terminal knows exactly where to resume. Replace it with the current thread —
> what's done, what's next, any half-finished work.

- **📌 RESUME HERE (Oct 7, 2026, later) — Lifecycle + Service steppers: BUILT,
  tested, NOT deployed (guide v3.30).** Decisions (Alex, Oct 7): one production
  stepper with the lifecycle; Service jobs from BC's Job Card **Order Type**
  (SERVICE, SIGNCONT, MNTCCONT all get the Service stepper); BC write-back only
  for stages with a known BC step; backfill app-only.
  - Production stepper = `NO` New Order → `UM` Upcoming Mfg → `PU` Purchasing →
    depts → `RI` Ready for Install (install jobs) → `I` → `CP` Complete-Need
    Paperwork → `CA` Complete to Admin → `CI` Complete Invoiced
    (`production-steps.ts`; lifecycle drawn as outlined squares / tiny markers).
    Service = `SU` `SE` `SA` `SI` (`services/service-steps.ts`); service-only
    jobs (service + no dept) get no lifecycle. Same completion / override
    tables. `store/job-steps.ts jobStepsFor` = production + service, used by BC
    push / Sync to BC / backfill; `store/service-jobs-store.ts isServiceJob`.
  - BC: NO→New Order This Week, UM→Upcoming Manufacturing, PU→Job Purchasing,
    RI→Product Ready for Install Scheduling, CP→Complete-Need Paperwork,
    SE→Service. CA / CI / SU app-only (names unconfirmed; two "Survey" steps).
    Main "Production" step = departments only. 🔴 **BC job "complete" now fires
    at Complete to Admin** (`jobCompleteForBc`: every CA/SA on the steppers).
  - Status picks go through the flow (`stepsToComplete`): lifecycle stages
    before the picked stage complete; departments only when the stage is past
    production. Default flow statuses: NO New Order this week, UM Upcoming Mfg.,
    PU Purchasing (new status), RI Ready for Install (new), CP + CA
    Complete-need paperwork, CI Complete to Admin, done = Complete Invoiced (a
    saved flow with the old done status is migrated in `companyFlow`;
    `effectiveFlow` now places unnamed steps by the default order). Complete
    Invoiced is never auto-moved. A punch also ticks open lifecycle stages
    before its department.
  - Order Type pipeline — ✅ LIVE in UAT Oct 7: BC ext **v1.0.0.16** (page
    58403 `orderType`: a field captioned "Order Type" / 95294 are both empty in
    UAT, so it's the Resource whose Name = the job's **Description 2** —
    "Service Order" → SERVICE) → `crfdf_jobdesc.crfdf_ordertype` (column
    created) → **BCJobDescriptions 1.0.0.2** (imported, ran: 707 rows, 145
    service jobs — 136 SERVICE, 8 MNTCCONT, 1 SIGNCONT). Test job **J38696**.
    Probe: `scripts/bc-job-fields-probe.ps1`. Details:
    `flows/BCSync_JobDescriptions.md`.
  - **Remaining go-live:** deploy the app, then Settings → Business Central →
    **Match Steppers** right away (otherwise every job shows New Order active
    and a stepper click would push New Order This Week Started).
  - 🔧 **BCSync_JobPlanningLines fixed Oct 7** (`scripts/patch-planninglines-flow-upsert.ps1`;
    backup `flows/planninglines-clientdata-backup-20261007-013616.json`). It had
    "failed" every night since ≥ Sep 23 and was off since Oct 3: Update a row
    then ALWAYS Add a new row → ~7,400 duplicate-key failures a night (data was
    written anyway; frozen at Oct 2 once off). Now a Line_Exists condition
    (update or add) + 10 jobs at a time. Turned on + catch-up run Oct 7.
    `scripts/diagnose-flow.ps1 -FlowName <name> [-Table <logical>]` reads any
    flow's runs + failing actions (read-only; `-TokenCache` reuses a sign-in).
- **(Oct 7, 2026) — Edit any Jobs field + Tracking in the job
  panel: DEPLOYED (guide v3.29).**
  - "Edit field…" (header right-click or ✎ in Fields) on EVERY column: rename
    for everyone (`FieldOptionOverride.label`, stored with the option lists in
    crfdf_jobsview `options:<key>`; `builtinColumn` applies it in `fieldsByKey`,
    so grid / panels / job panel / Settings → Users grants follow). Single ↔
    Multi Select for plain tracking choices (`.multi`, `canToggleMulti` — not
    status / holdReason); multi saves "A, B" text (`trackValue`, `splitMulti`).
  - Custom fields change type within `compatibleTypes` groups; values are never
    rewritten — `choiceList` reads either Single/Multi shape.
  - Job panel: `TrackingFieldsSection` edits every track field in place (grant-
    aware). `.opt-picker` z-index 80 → 400 (was hidden behind slide-overs).
  - Expeditor / Date to Admin were already grid-editable; the panel was the gap.
  - Not possible by design: changing a built-in column's base type (e.g. date →
    pick-list) — each is a fixed Dataverse column.
- **(Oct 6, 2026, late) — Job flow (editable step + status order).**
  `services/job-flow.ts` (pure, 20 tests) + `store/job-flow-store.ts` +
  `components/JobFlowEditor.tsx`. Decisions (Alex, Oct 6): statuses are their
  own STAGES (step + status; a step can have several, e.g. Vinyl Cut → Vinyl
  Application); company default in Settings → **Job flow** (replaced Status
  rules — crfdf_jobsview `jobFlow`, built from `statusRules` until first saved)
  + per-job flow in the job panel (▸ Job flow; `crfdf_jobtrack.crfdf_flow`).
  - A tick completes the step's next open stage (`applyTick`); the stepper step
    completes after its last stage; progress inside a step =
    `crfdf_stagesdone`; status = first open stage. A hand-set status on a later
    stage counts the earlier ones done. The processor re-reads the job's
    tracking row first (`fetchJobTrack`).
  - 🔴 **The flow's step order IS the stepper order** — `buildDepartmentSteps`
    takes `order` (`stepOrderFor(jobNo)` / `useStepOrder`); every call site
    passes it, and async paths (`pushStepperState`, bulk sync, ticks)
    `await ensureFlowsLoaded()` first so BC's Started follows the same order.
  - Columns: `scripts/add-jobflow-columns.ps1` (crfdf_flow, crfdf_stagesdone)
    — ✅ created Oct 6; app DEPLOYED Oct 6 (guide v3.28). Next: Alex sets up the
    company flow (e.g. Vinyl Cut → Vinyl Application) and tests a two-stage tick.
  - Status rules store/section deleted; History's "moved to" uses the flow.
- **(Oct 6, 2026) — Shop-floor "Task complete" is LIVE in UAT
  + Jobs → History DEPLOYED (guide v3.25).** Full write-up:
  `apps/scheduling/flows/BCSync_TaskCompletions.md`.
  - ✅ `crfdf_taskcompletion` created (`scripts/create-taskcompletion-table.ps1`,
    re-runnable; Oct 6 added `crfdf_department` / `nextdept` / `statusfrom` /
    `statusto` + `crfdf_jobtrack.crfdf_statusauto`). BCTaskCompletions_1_0_0_1
    imported + ON (first import failed 80071151 = SolutionConcurrencyFailure —
    a publish was still running; a plain re-import worked).
  - ✅ **Verified end to end:** J26609 / 2010 Routing Labor, Clock Out tick →
    row in ~35 s → app completed Routing, next dept active, status moved.
  - ✅ **AUTO tag replaces "override"** (Alex, Oct 6): the old tag only meant
    "status set in the app, not Airtable" and could never be cleared. Now a
    punch's status move sets `statusAuto` ("Punch · name · date") → AUTO tag
    with × (`dismissAuto`); a manual status pick clears it.
    `components/jobs/ShopFloorHistory.tsx` = the tag + the **History** panel
    (button left of Refresh, `HistoryIcon.tsx`; last 30 days; filters; ✓
    Reviewed / Mark all reviewed). Failing-save case in `optimistic-edit.test.ts`.
  - ✅ **BC ext v1.0.0.13 published to UAT (Oct 6):** Clock In Project always
    shows "Currently on" + "Complete current task", greyed out (Enabled) unless
    punched in. Still to test both states on the page.
  - ✅ **BC ext v1.0.0.14 published to UAT (Oct 6):** crews use Infotech's
    *Clock In / Out Multiple Projects/Nestings* (70210/70211), so both now get a
    *Mark tasks complete* part (page 58412) — a Task complete checkbox per open
    punch, held in table 58411 "LUM Punch Tick" (labor entry line). Recorded
    when the punch closes (ICG Labor Entry OnAfterModifyEvent, DateTime Out
    set) + any leftovers on Submit of either page; Source "Multi Clock In/Out".
    ⚠️ Infotech's Multiple pages have NO integration events and their Open
    Project Punches part is Editable = false — that's why it's our own part +
    a table event. Untested: whether Clock In Multiple closes the open punches
    (either way the Submit flush records the ticks). Guide v3.26 deployed Oct 6.
  - ✅ **v1.0.0.14 verified (Oct 6):** one Clock Out Multiple submit (Tanner Rue)
    → J34707 / J32765 / J36571, one row each, "Multi Clock Out", all applied.
    ⚠️ They were applied by an Admin/Ops session still on pre-deploy code (no
    History details, no AUTO tag) — left as is (Alex: done in real life). Open
    sessions keep old code until reloaded.
  - ✅ **Outdated-build check (Oct 6, deployed):** each bundle carries its build
    time (`__APP_BUILD__`, vite.config.ts). A deployed tick-processing session
    records it in crfdf_jobsview key `appLatestBuild` when newer; a session
    whose build is older skips ticks (console warning) — `services/app-build.ts`
    (pure, tested). Old tabs from BEFORE this deploy don't have the check.
  - ✅ **Security roles checked (Oct 6): nothing to grant.**
    `scripts/grant-newtable-privileges.ps1` (dry run default, `-Apply` adds)
    mirrors each role's `crfdf_jobtrack` access onto `crfdf_jobpo` /
    `crfdf_jobdesc` / `crfdf_taskcompletion` (Read) + `crfdf_taskcompletion`
    (Write). Only 5 roles can read jobtrack — all built-in managed ones
    (System Administrator, System Customizer, Service Reader/Writer, Support
    User) — and every one already has matching access on the new tables. No
    custom role grants the app's tables, so only System Administrators (13 users
    incl. Alex + Bill Weesner, the rest mostly `#` service accounts) can use it. ⚠️ Before a non-admin uses the app, they
    need a custom role covering ALL crfdf_ tables, not just these three — re-run
    the script after creating it.
  - **Non-admin role: script READY, not applied (Oct 6).**
    `scripts/create-scheduler-user-role.ps1` builds "Lumineo Scheduler User"
    (30 tables, Organization depth, only the ops the app performs — 147
    privileges; BC/weather-fed tables read only) and with `-AssignAppUsers`
    gives it + Basic User to every non-admin crfdf_appuser login. 🔴 **Blocker:
    the app lives in a DEVELOPER environment** (`pac admin list` → Type
    Developer). Only the owner + admins get in: 29 of 32 Settings → Users logins
    aren't Dataverse users there. Non-admin rollout needs the app (+ tables +
    flows) in a Sandbox / Production environment; then run the script with
    `-Org <that env's URL>`. BC entry no 1 never reached Dataverse (only
    entry 2) — check BC if it matters.
- **(Oct 4, 2026) — Job panel by role, phase 1 DEPLOYED.**
  Clicking a card: below the stepper, `components/JobInfoSections.tsx` shows the
  ship-to address (Google Maps / Copy; `services/ship-to.ts`), install crews get
  the card day's weather, and ▸ Salesperson & Project Manager (collapsed).
  View-only users no longer get the disabled edit fields (EditJobPanel wraps
  them in `!readOnly`). Panel Target dates = the Jobs list's (`useJobRow`):
  Mfg target (Mfg Final) + Scheduled install, else Install target — the hover
  tooltip uses the same (`useJobListTargets` in `JobTargets.tsx`);
  `computeJobTargets` is only the fallback for jobs not on the list. Guide v3.17.
  - ✅ **Phase 2a — Purchase orders: DONE + DEPLOYED (Oct 4, guide v3.18).**
    ▸ Purchase orders in the card panel (all roles): PO # → BC (open → page 50,
    archived → 9347), vendor, date ordered, BC status / "Closed". Full write-up:
    `flows/BCSync_JobPOs.md`. Key facts:
    - BC ext **v1.0.0.8**: API queries 58401 `jobPurchaseOrders` / 58402
      `jobPurchaseOrderArchives` under `api/lumineo/planning/v1.0`. 🔴 The
      `QueryType = Normal` + Web Services route (v1.0.0.6/7) was NEVER exposed
      over OData — 404 for every login incl. Alex's. Don't go back to it; the
      `LumineoJobPOs` / `LumineoJobPOArchive` Web Services rows can be deleted.
    - Access: `LUM JOB PO READ` (permissionsetextension of D365 BUS FULL
      ACCESS, v1.0.0.7). The app user CAN'T self-assign `LUM PLANNING WB`
      (BC: SECURITY only hands out sets the assigner holds) — an admin with
      SUPER must do it; then the extension can go.
    - `crfdf_jobpo` (`scripts/create-jobpo-table.ps1`, run Oct 4) filled by
      **BCSync_JobPOs** (nightly 5:15 CT, solution `BCJobPOs_1_0_0_2.zip`,
      imported + ON in UAT). Open jobs only (`crfdf_bcjobs`); open beats
      archived, highest archive version wins. First run: **629 rows, verified
      exact** by `scripts/verify-jobpo-sync.ps1`. Production cutover: publish
      the ext there + switch `Bc_ApiBase` / `Bc_CompanyId`.
  - ✅ **Phase 2b — Descriptions: DONE + DEPLOYED (Oct 5, guide v3.19).**
    ▸ Field Description + ▸ Production Description (all roles), ▸ Extended
    Description (editors: EditJobPanel `showExtended={!readOnly}`). Full
    write-up: `flows/BCSync_JobDescriptions.md`. Key facts:
    - The fields are **Blobs** on Job from Infotech's "Lumineo Signs -
      Projects" ext (tableext 60200 `ICG.LMN.Job`): 60215 Field, 60214 Prod,
      60202 Extended (60219 Design & Estimating — Alex: not wanted). Found by
      downloading the Infotech symbols from `/dev/packages` (device code).
    - BC ext **v1.0.0.11**: API page 58403 `jobDescriptions` reads them by
      field number (RecordRef — no dependency on Infotech's app). 🔴 They're
      stored in BC's default **MSDos** encoding (’ = C2, ” = C4): read UTF-8,
      else MSDos. UTF-8-only threw for the whole response; a Windows fallback
      showed ’ ” as Â Ä.
    - `crfdf_jobdesc` (`scripts/create-jobdesc-table.ps1`) filled **hourly**
      by **BCSync_JobDescriptions** (`BCJobDescriptions_1_0_0_1.zip`, ON in
      UAT); writes only jobs whose BC lastModified moved; open jobs only.
      First run 707 rows, **verified exact** (`scripts/verify-jobdesc-sync.ps1`).
  - ✅ **Oct 5 — Jobs access (deployed, guide v3.22).** Everyone sees Jobs
    (`permissions.jobs`); full edit by role (`editJobs`: Admin / Dev / Ops).
    Others are view only (views store `readOnly` → never writes the SHARED
    views; filter/sort/group session-only) unless granted fields per login in
    Settings → Users → Manage users → **Jobs** button
    (`crfdf_appuser.crfdf_jobeditfields`, column created Oct 5;
    `services/job-edit-access.ts`, `jobs-grantable-fields.ts`). Grants are
    app-side: the person's Dataverse role still needs Write on the tables.
    Card panel scrolls; editors get details under one "Job Information" group.
  - **Next:** check a view-only user can read `crfdf_jobpo` / `crfdf_jobdesc`
    (new tables — their security role may need Read); then the older Next
    items below (tracking columns, lifecycle + Service steppers, BC job
    "complete" at Complete to Admin).
  - BCSync_SalesLines ship-to patch: **confirmed already applied** (script
    re-run Oct 4 changed nothing).
- **(Oct 4, 2026) — everything through `5bccbda` (Oct 2) is
  committed, pushed AND deployed** (build 00:23 Oct 2, commit 00:25). Guide v3.16.
  Shipped Sep 30 – Oct 2 (details in the commit messages):
  - **Jobs:** edit tracking columns in the list (`a573c50` — status, priority,
    hold, vendor, dates, notes…), shared views, choose / upload / remove sketches
    (SharePoint connector, `services/sharepoint.ts`; pinned via
    `crfdf_jobsketch.crfdf_pinned`; BCSync_JobSketches 1.0.0.14 skips removed
    jobs), full-size sketch viewer, Airtable-style pick-lists (`OptionPicker`,
    Edit field… reorder / recolour), editable Sales
    (`crfdf_jobtrack.crfdf_salesoverride`, never sent to BC), list shows before
    steppers load + preloads 5s after start.
  - **Monthly Plan on real data** (`services/gameplan.ts`, `hooks/useJobRows.ts`);
    mock `INSTALL_CANDIDATES` gone (the Phase 3 Gameplanning item is done).
  - **Install board loads in ~1.5s** (batched BC crew read, shared region read).
  - **Display:** compact sidebar, hide weekend (right-click a day header;
    "Sat–Sun Hidden" tag by the week date), day value on hover
    (`services/day-values.ts`), WK/NEK toggle inside the stats bar.
  - Job Queue "From BC steps" header colours (shared).
  - Untracked `flows/saleslines-clientdata-backup-*.json` are pre-patch flow
    backups — deliberately not committed.
  - **Next:** any tracking columns still read-only (check expeditor / date to
    Admin), the lifecycle + Service steppers, BC job "complete" at Complete to
    Admin. User-side items from Sep 30 below are still open unless Alex says so.
- **(Sep 30, 2026) — Jobs list stages 1–4 shipped.** Next:
  editing the other tracking columns (vendor, expeditor, date to Admin…), the
  lifecycle + Service steppers, BC job "complete" at Complete to Admin.
  - **New orders flow (built Sep 30, UAT):** `flows/BCSync_NewOrders.md` —
    every 15 min, jobs whose BC *New Order This Week* step is Started (and
    not yet on the Jobs list) get a jobtrack row (status "New Order this
    week") and their bcjob row + planning lines filled from BC at once.
    Zip `Downloads\BCNewOrders_1_0_0_2.zip`; **user to import, turn on, test
    in UAT**. Switches to Production with the cutover (below).
  - **Location fix:** `scripts/patch-saleslines-flow-shipto.ps1` makes the
    nightly BCSync_SalesLines write the Sales Order's ship-to city / state /
    address (BCSync_Jobs writes the bill-to customer's) — ✅ applied (checked Oct 4).
  - **Stage 4 (done): custom fields** — `services/custom-fields.ts` (12 types
    incl. Formula Date = base date ± days / working days / weeks),
    `store/custom-field-store.ts`, `components/jobs/CustomFieldDialogs.tsx`
    (Add fields / Edit field), `CustomValueEditor.tsx` (inline grid + panel).
    Defs in `crfdf_jobfield` (config JSON), values in
    `crfdf_jobtrack.crfdf_customvalues` (JSON; saves re-read + merge one key).
    Values ride on each row under the `cf_…` key (`withCustomFields`), so
    filter / sort / group just work; saved views keep `cf_` keys.
    Schema: `scripts/create-customfield-schema.ps1` (run Sep 30).
  - **Stage 1 (done):** Name = BC ship-to (fallback: SharePoint customer
    folder; `crfdf_jobtrack.crfdf_jobname` manual rename). Sales initials /
    Region from `services/sales-pm.ts` (NEK = QTOTTA, SPOPPELREITER,
    VBAUMGARTNER, JLYLE; rest WK). Location = ship-to city, state. Value =
    `crfdf_bcjob.crfdf_salesorderamount` (BCSync_SalesLines patched by
    `scripts/patch-saleslines-flow-order.ps1`: order total, order salesperson,
    ship-to name → order customer name fallback); Remaining Balance column.
    Frozen Job # column above the steppers.
  - **Stage 2 (done):** editable Current Status (`services/job-status.ts`):
    complete statuses complete every step, Installation statuses complete
    production; hold in/out stamps Date to/off Hold (`crfdf_priorholddays`
    keeps earlier holds). DIP (from release) / DOH / Actual DIP. "Match
    steppers" backfill dialog — **user hasn't run it yet**; then Sync to BC.
  - **Stage 3 (done):** `services/lead-times.ts` + `crfdf_leadtimerule`
    (Settings → Lead times). Mfg Target / Install Target (7 / 10 wk default),
    Mfg Final = Mfg Modified (in-app override, else Airtable Mfg Final) if
    different, else target. `computeJobTargets` takes a `lead` now (cards too).
    Jobs release date = in-app override, else BC `crfdf_releasedate`.
  - **Stepper:** Material Cut (MC → BC "Substrate Cut/Prep", editor-added)
    and Crating (CR → BC "Crating", auto from crating-labor planning lines,
    `planning-line-mapping.stepInfoFromLines`).

- **(Sep 29, 2026) — Job Tracking (replacing Airtable). Phase 1
  data is IN; next is the Jobs view.**
  Goal: track every job from order → production → install → invoice inside the
  Project Scheduler, replacing the Airtable "LNI Production Schedule / WK
  Expeditor" list, with the stepper replacing Airtable's "/" (needed) and "X"
  (done) department columns and everything flowing to BC Project Planning.
  - **Where the Airtable app lives:** `C:\Users\Alex\Documents\LNI-ProductionSchedule`
    (Code App `4ed31b48-…`). Good Airtable-style grid (React 19, @tanstack/react-virtual,
    grouping / filters / 15 views / inline edit) BUT it shows a baked-in CSV snapshot
    (`src/data/staticRecords.ts`, 730 rows) and **saves nothing**; its Dataverse +
    BC code is unused (and its BC path reads a client secret from `VITE_` vars —
    never ship that). We PORT its grid UI; its data layer is not reused.
  - ⚠️ `C:\Users\Alex\Lumineo-Signs---Switchboard\production-scheduling-app` is an
    OLD copy of this scheduler, not the Airtable app. Its power.config.json had the
    LIVE app id — cleared Sep 29 (`appId: ""`, renamed "old copy - do not use") so a
    push there can't overwrite production. That edit is **uncommitted in the
    Switchboard repo**.
  - **Decisions (Alex, Sep 29):**
    - TWO steppers per job: **Production** (lifecycle) and **Service** (service /
      contract orders → BC "Service" step): Survey → Service → Complete to Admin →
      Complete Invoiced.
    - Production lifecycle: New Order → Upcoming Mfg → Purchasing → **Material Cut
      (NEW dept, BC Substrate Cut/Prep)** → Steel/Metal Fab → Routing → Paint →
      Vinyl (**Plex/Application folds into Vinyl**; BC Face Production NOT mapped —
      too broad) → Assembly → Ready for Install → Install → Complete-Need Paperwork
      → **Complete to Admin** (production team's last step) → **Complete Invoiced**
      (Admin's step; the true end).
    - **BC job-level "complete" moves to Complete to Admin** (today it fires when
      the last production dept completes — change in Phase 2).
    - Current Status = derived from the stepper's active stage, with a **manual
      override** for odd cases (Morton – National, Billboards…; may need extra BC
      tiles).
    - **Hold** = flag + reason + Date to Hold / Date off Hold → **DIP = days open −
      days on hold**. **UL Sign** = filterable checkbox. **Routing Hrs dropped.**
    - **Expeditor date** = when the expeditor finished review and passed the job to
      the dept head.
  - ✅ **Done (Sep 29):**
    - Table **`crfdf_jobtrack`** (Job Tracking, 31 cols, keyed by job no; dates as
      YYYY-MM-DD text) — `scripts/create-jobtrack-table.ps1`.
    - Column **`crfdf_jobschedule.crfdf_productioncompletedate`** added (was never
      created; the app's production-complete override now works).
    - **Airtable imported** (`scripts/plan-airtable-import.py` → review CSV + plan;
      `scripts/apply-airtable-import.ps1` — dry-run default, only fills gaps, never
      overwrites). 611 rows → **601 jobs**: 601 jobtrack rows, 42 new + 30 filled
      jobschedule dates (red date / Mfg Target Modified), **307 "needed" overrides +
      110 completions** (stamped "Airtable import"). Totals now: jobtrack 601,
      jobschedule 748, overrides 334, completions 217. Import writes did NOT push to
      BC — BC catches up when a job's stepper is next touched.
    - "(Steel Copy)" / "(Paint Copy)" Airtable rows = a job in two depts at once →
      imported as extra ACTIVE depts. Same job with a production + a service order
      → one job (both steppers). 4 merge conflicts (J35548, J36572, J39571 order
      dates; J39712 sales VB|JS) — newest order won. 26 jobs aren't in the BC job
      sync (crfdf_bcjob) — imported anyway, flag them in the view.
    - Material Cut is stored under stepper key **`MC`** but the stepper doesn't show
      it yet (not in `DEPT_FLOW`).
  - ✅ **Jobs view BUILT (Sep 29) — NOT yet deployed.** Sidebar **Jobs** (Admin /
    Ops / Developer while in preview; `permissions.monthly`). Read-only.
    - Rows = every open BC job (`crfdf_bcjobs`, all 1,389 are status Open) ∪
      `crfdf_jobtrack` (26 tracked jobs not in the sync show a "not in BC" tag);
      untracked BC jobs show status "Not tracked yet" + their own view.
    - `services/job-tracking.ts` (join, `currentStatus` = override → active hold →
      Airtable carry-over, `daysInProcess` = order→today minus hold days; 13 tests),
      `store/job-tracking-store.ts`, `components/jobs/` — `jobs-fields.ts` (columns,
      badge colours, views incl. **WK Expeditor** = the Airtable columns),
      `jobs-grid-state.ts` (search / and-or filters / sort by status tier / nested
      groups; 9 tests), `JobsGrid.tsx` (@tanstack/react-virtual, sticky header +
      first column, resizable columns, collapsible groups, Stepper column via
      `useJobSteps`), `JobsPanels.tsx` (Filter / Sort / Group), `JobsView.tsx`
      (per-view prefs in localStorage). Dev uses synthetic `data/mock-job-tracking.ts`
      (no real customers in the repo). Guide v3.12 §5.17.
    - The Stepper column is empty in dev (no BC planning lines); live it lazy-loads
      per visible row.
  - ✅ **Deployed Sep 29 + wired into the scheduler.** One system, not two:
    - Stepper column + job panel use the SAME stepper stores as the boards
      (`useJobSteps`, `ProductionStepperSection`) → complete / reopen / Set active
      from Jobs writes the same rows and queues the same BC state push
      (`store/bc-stepper-push.ts`).
    - Dates (red / release / sched. install / production-complete override) come
      from the SHARED `useJobScheduleStore`; the job panel embeds the boards'
      `JobSchedulePanel` (Install Dates) → edits show on boards + Jobs at once.
      `job-tracking-store` now holds only raw BC jobs + jobtrack rows; the join
      happens in `JobsView` at render time.
    - Row click → `JobsJobPanel`: tracking facts, **where the job sits on the
      boards** (`jobPlacements(jobNo)` in dataverse-live: production lines, install
      cards, shipment loads), stepper, targets, Install Dates, job tasks.
    - 🔴 **Rule for Phase 2+: never give Jobs its own copy of shared state.** New
      editable job fields go through a shared store + `persistOrReport`; anything
      BC should see goes through the existing push paths (`enqueueBcPush`,
      `pushStepperState`, schedule pushes) so boards, Jobs and BC stay in step.
  - ✅ **Sep 29 feedback round (Alex):** (1) column widths are ONE shared set,
    saved per device (`lumineo.jobs.colWidths.v1`) and used by every view;
    (2) the sticky header stays above the stepper (tbody is its own stacking layer —
    stepper nodes use z-index); (3) **editable views** like the Airtable app —
    `jobs-view-layout.ts` (pure, 7 tests: add / rename / duplicate / delete views,
    drag views across sections, add / rename / delete / drag sections, per-view
    columns) + `JobsViewList.tsx` + a **Fields** panel (show / hide / search / drag
    order); saved per device (`lumineo.jobs.layout.v1`), prefs keyed by view id;
    (4) **stepper speed**: ONE paged read of all BC resource planning lines
    (`allJobStepInfo`, 5,035 rows > the 5,000 page cap → new `listAll` follows
    `@odata.nextLink`/`$skiptoken`) primes `useJobSteps`' cache before rows draw,
    instead of one request per visible row; (5) **Value** = the calendar's
    `cardMoneyValue` rule: BC remaining balance, else the largest
    `crfdf_invoiceamount` on the job's production cards (`jobInvoiceAmounts`).
    Views are per device (like the old app); moving them to Dataverse to share
    across users is an open option.
  - ✅ **Sync to BC + Job Queue step groups (Sep 29, built).**
    - **Sync to BC** (Jobs toolbar, editors): `services/bc-full-sync.ts` (pure,
      4 tests) plans the whole desired BC state for every TRACKED job — `state`
      rows from the stepper (active dept = Started → BC tiles) + `schedule` rows
      only for steps with calendar cards — and DIFFS against the newest outbox
      row per (kind, job, step) (`fetchLastPushes`: pending + synced) so re-runs
      are small. `store/bc-full-sync-run.ts` + `BcSyncDialog` (plan → confirm →
      queue with progress; `enqueueBcPushes`, 6 at a time). Same builders as the
      live pushes. The flow runs **10 rows at once** (Sep 29, Alex) —
      `runtimeConfiguration.concurrency.runs` in `_gen_planningsteps_flow.py`;
      Newer_Push still supersedes an older row for the same (job, step). Rows
      for one step that start in the same instant can land either way round — a
      later edit or Sync to BC corrects it.
    - **Job Queue "From BC steps"**: `services/step-queue.ts` (pure, 5 tests) +
      `store/step-queue-store.ts` + `StepGroupsSection` in `JobQueuePanel`. Read-
      only groups per BC step (Fabrication, Routing, Painting, Vinyl, Final
      Assembly; install boards: Ready for Install by region) of tracked jobs whose
      stepper has that dept ACTIVE. Cards carry the step's BC planning lines
      (tasks + hours); drop → normal card via `placeQueueItem`
      (`findStepQueueItem`), item stays (tagged Scheduled). Scheduled =
      `scheduledSteps()` (all boards, all dates) ∪ the current board.
    - One cached planning-line read (`allPlanningLines`) now feeds the Jobs
      steppers AND the queue.
  - **Next:** compare Jobs against Airtable with Alex, then Phase 2 (editing the
    tracking fields, lifecycle + Service steppers, BC job "complete" at Complete to
    Admin).
  - **Phase 2:** editing; lifecycle + Service steppers (new keys incl. MC, holds, DIP);
    BC write-back for the new stages (non-dept BC steps: New Order This Week,
    Upcoming Manufacturing, Job Purchasing, Substrate Cut/Prep, Product Ready for
    Install Scheduling, Install-Waiting on Product, Complete-Need Paperwork);
    move BC job "complete" to Complete to Admin. **Phase 3:** Mfg/Install targets →
    Monthly Gameplanning (replace mock `INSTALL_CANDIDATES`) + scheduling.
    **Phase 4:** retire Airtable.
- **LIVE (Sep 29, 2026) — Billing periods (fiscal months).** Table
  `crfdf_billingperiod` created, app deployed; cut-off dates still to be entered.
  - Each month has a **billing cut-off date** + **goal** in Settings → Billing
    periods (Admin / Developer / Ops only — `canEditBillingPeriods`). A job bills
    in the month its install **ENDS** in; it must end the day BEFORE the cut-off,
    so the cut-off day rolls to the next month (Alex, Sep 29). Window for month
    M = [cut-off(M−1), cut-off(M)). No cut-off → calendar month; no goal → $1.1M.
  - `services/billing-periods.ts` (pure, 14 tests), `store/billing-period-store.ts`
    (optimistic, `persistOrReport`; failing-save case in `optimistic-edit.test.ts`),
    `components/BillingPeriodsSection.tsx`, Dataverse `crfdf_billingperiod`
    (month / cutoff as `YYYY-MM-DD` TEXT so no TZ shift / decimal goal).
    `WeekSummary` "Billing · <Mon>" and `MonthlyPlanView` now use periods + the
    period's goal; `MONTHLY_INSTALL_GOAL` is gone. Guide v3.11.
  - ⚠️ The board's month stat only sees the loaded week's cards (pre-existing
    limit) — a job whose last install is in another week isn't counted there.
  - **Next:** Alex enters the real cut-offs + goals in Settings → Billing periods.
- **📌 RESUME HERE (Sep 28, 2026) — BC step write-back is LIVE against UAT.**
  App deployed, BCPush_PlanningSteps imported + ON. Verified on J33138: a Metal
  Fab card move created BC's Fabrication row (Central times, Chris Owen 1030,
  Started untouched); reopen → complete on Routing left Routing Started +
  Complete and Fabrication Started (Metal Fab active); Painting / Vinyl /
  Install untouched ("nothing to set"). One old-shape `completion` row for
  J33138 Routing (4:00 AM) is still `pending` — ignored by the flow, harmless.
  **Next:** watch real traffic for a few days (queue rows `failed`?), ask the
  team to reload the app, then plan the PRODUCTION cutover (list below).
  Previous status, kept for context: Our AL page works in UAT; the app + flow are rewired to
  it. Full design: `apps/scheduling/flows/BCPush_PlanningSteps.md`.
  - 🔴 **Started ≠ "scheduled" and ≠ "physically started" (Alex, Sep 28).** In BC,
    Started = *listed in that department's queue* — BC's department tiles show
    steps Started and not Complete. It mirrors the stepper's **active**
    department(s) (several allowed); completing one makes the next active and
    Started. Built as `"state"` pushes: every stepper change restates Started /
    Complete for all the job's mapped BC steps (`store/bc-stepper-push.ts`,
    `bcStepStates`). Folded Fabrication is Complete only when Steel AND Metal Fab
    (AND Fab Help) are. Un-active → un-Started. Stepper beats ICG's Activate
    Next Step. The flow skips a row when a newer one exists for the same
    job + step + kind (trigger order isn't FIFO — J33138 Routing reopen/complete
    landed backwards), and sends only flags that differ. Flow JSON is now
    GENERATED by `flows/_gen_planningsteps_flow.py`.
  - **Decisions (Alex, Sep 28):** dept → BC step = Steel MFG / Metal Fab /
    Fabrication Help → Fabrication, Routing → Routing, Paint → Painting,
    Vinyl / Graphics → Vinyl, Assembly → Final Assembly, Install → Install.
    Scheduling does **not** set BC Started (completion does). Missing step rows
    are **created**. The pre-rewire backlog is **retired**, not replayed.
  - 🔴 **The old outbox shape was unusable**: `crfdf_planningstep` held BC
    planning-LINE text ("Cabinet Metal Labor"), never a catalogue step, and each
    row was one card. Now one row = one (job, step) with the **whole** window
    (min start → max end over every card of the job for that step, read from
    Dataverse at enqueue, on create/update/delete). Assignee only when every
    card names the same person. `bc-planning-sync.ts` + `dataverse-live.ts`;
    272 tests green.
  - **Assignees (Sep 28):** production roster `crfdf_no` is complete — Len Cook
    → 1143, Aiden Haskill → 1152 set by `scripts/set-employee-resourceno.ps1`
    (names deliberately left as-is). Install crew resolve by NAME against
    `crfdf_appuser` (first name + last initial, installer preferred on a tie):
    18/25 resolve; Danny (= Daniel Keller 1100), Richie, Jarrod L, Bryan don't.
    `AppUser-EmployeeList.xlsx` matches `crfdf_appuser` except Kevin Barnhart,
    listed twice in BC (1207 + 5038; the app uses 5038).
  - AL **v1.0.0.3** (compiled, NOT yet published): page allows **insert** —
    POST `{Project_No, Step_Description, Sched_*}`; the page resolves the step
    by name and copies Code / Planning Area / sort / indent from the catalogue.
    `LUM PLANNING WB` now RIM. ✅ **Create verified in UAT (Sep 28):** J31949 /
    Painting → HTTP 201, catalogue fields identical to J13231's Painting row,
    Central times right; unknown step, ambiguous "Survey", and changing an
    existing row's Project_No are all rejected. 🧹 **Test row in UAT:
    J31949 / Painting — delete it by hand in BC if still there.**
    🔴 **ICG's validation of `Assigned To` sets Started = true** (even when
    clearing it). v1.0.0.4 (compiled, NOT yet published) makes `Assigned_To` a
    page variable that validates through ICG and restores Started/Complete,
    like `Sched_*` — ✅ verified. It ALSO sets the start to NOW on a row with no
    start; v1.0.0.5 (compiled) restores the dates + Duration too.
    🔴 **Completing needs a BC User Setup row for the flow's user.** ICG's
    `Complete` validation does `User Setup.Get(UserId)` (ICG adds
    `ICG.IPP.ResourceNoFilter` to User Setup) → *"The User Setup does not exist.
    User ID='POWERAPPS PERMISSIONS'"*. Fix: add a User Setup line for
    `POWERAPPS PERMISSIONS` (UAT now; **prod at cutover too**). Don't bypass ICG's
    Complete logic — it can activate the next step.
    ✅ **Added in UAT Sep 28** (typed in — the User ID lookup hides app users).
    Complete / re-open verified; no sibling steps changed. Re-open now also
    blanks Completed_Date (ICG leaves it). Completed By stays blank (Alex chose
    not to fill it). **All five write paths proven in UAT** — update dates,
    update assignee, create, complete, re-open.
  - Flow rewritten (`BCPush_PlanningSteps-clientdata.json`): GET job rows →
    match `Step_Description` → PATCH `(Project_No='…',Code=<guid>)` or POST;
    concurrency 1; `Sched_*` only, never raw dates.
  - **Next, in order:** (1) ✅ done — v1.0.0.5 published + all paths verified;
    (2) ✅ done Sep 28 — 187 old rows (115 schedule + 72 completion) now
    `superseded`; the 1 `job` row is still pending for BCPush_JobCompletion; (3) ✅ deployed Sep 28 + USER-GUIDE v3.9 (§5.4 BC Project Planning mirror) — the app now queues per-step `pending` rows; nothing drains them until the flow is on;
    (4) build + import the solution, turn the flow on, move one card, check BC.
- **Sep 22, 2026 — BC Planning Step write-back. The permission wall is
  DOWN; the target table was WRONG.** Two things changed today: every BC
  permission blocker is resolved and the "no addressable row" wall is genuinely
  cleared — but probing proved we were aiming all of it at the **step catalogue**
  rather than the per-job schedule. Read the 🔴 block before writing anything.
  - ✅ **PERMISSIONS: DONE (Sep 22).** `asmith@lumineosigns.com` was granted
    **SECURITY** by the admin. The Entra Application Card **"PowerApps
    Permissions"** (client ID `34a4de23-4db0-48d9-a941-285c9c2f9b5d`) now carries
    `D365 BUS FULL ACCESS`, `ICG.IPS.ADMIN`, `ICG.IPS.GENERAL`,
    `ICG.PROJECTPLANNING`, `ICG.PROJPLANNING.ADM`, `ICG.SGPN365`, `LOGIN`,
    `SECURITY` — all System scope, Company blank (all companies). State was set
    `Disabled` → lines edited → `Enabled` → **Grant Consent**.
    - `ICG.IPS.GENERAL` cleared the HTTP 403 on table 71442000
      (`ICG.IPS.ProjectSchedulerSetup`). Confirmed: TEST 1 now passes.
    - `ICG.PROJPLANNING.ADM` was required and **is a strict superset** of
      `ICG.PROJECTPLANNING`: it grants Read/Insert/**Modify**/Delete on
      **71441976 AND 71441977**, where `ICG.PROJECTPLANNING` grants only **Read**
      on 71441976. That read-only line was the write gap. Exports of both sets
      are in `~/Downloads/ICG.* (System) - Permissions.xlsx`.
    - 🧹 **Cleanup owed (not yet done):** `SECURITY` on the *app card* lets the
      service principal assign permission sets to users — it was only ever needed
      on Alex's **user**, not the app. Remove it. `ICG.PROJECTPLANNING` is now
      redundant next to `ICG.PROJPLANNING.ADM`; same for `ICG.IPS.GENERAL` vs
      `ICG.IPS.ADMIN` (verify ADMIN is a true superset before dropping GENERAL).
    - ⚠️ Editing the card requires State `Disabled` first. The `BCSync_*` read
      flows share that client ID and fail for the duration — schedule the window.
  - ✅ **The sign365 "no addressable row" wall is DOWN on our own page.**
    `LumineoPlanningSteps` (published over page 71441976) keys on **`Code`**, type
    **`Edm.Guid`**, and a keyed GET returns ONE row **with an `@odata.etag`**.
    - 🔴 **The key literal must be UNQUOTED.**
      `LumineoPlanningSteps(7dbf996c-d2e6-47e1-a161-34f505198438)` → OK.
      `LumineoPlanningSteps('7dbf996c-…')` → `"Error in query syntax"`.
      `LumineoPlanningSteps(Code=7dbf996c-…)` also OK. The quoted form is what
      made this look like the same wall as sign365. It isn't.
    - 🔴 **`scripts/bc-odata-step-probe.ps1` TEST 3 reports a FALSE NEGATIVE.** It
      only looks for a literal `SystemId` property and bails with "No SystemId on
      the row" — our page exposes `Code` instead. Ignore that line, or fix the
      script to fall back to the `$metadata` `<Key>`.
    - Every field we need is exposed and typed: `Assigned_To`, `Start_Date`,
      `Start_Time`, `End_Date`, `End_Time`, `Due_Date`, `Duration`, `Started`,
      `Complete`, `Completed_Date`, `Completed_By`, `Quick_Notes`.
  - 🔴 **WRONG TABLE — this overturns the Sep 16 "corrected standing theory".**
    That note claimed Page Inspection proved 71441976 was an ordinary per-job
    table with real primary keys. The keys are real; the **rows are not per-job**.
    Table **71441976 `ICG.IPP.ProjectPlanningStep` is the step CATALOGUE** — the
    company's 35 standard workflow stages, shared by every job. Evidence:
    - Exactly **35 rows**, one per stage name (Sales, Sketch, Sketch Review,
      Estimating, … Vinyl, Final Assembly, Crating, Install, Service,
      Complete-Need Paperwork), every one `SystemCreatedAt` 2026-08-24 in a single
      batch. Two "Survey" rows — the production and install phases.
    - **Every row has zeroed schedule fields**: `Start_Date` `0001-01-01`,
      `Started` false, `Assigned_To` `""`, `Complete` false.
    - Same GUID, different data: sign365's `projectPlanningSteps` reports
      "Vinyl Install Only" as `started: true`, `startDate: 2024-03-13`; our page's
      row `851226ac-c820-4fe8-8588-097870ce9c5d` for the same step is all zeros.
      **Our page is not reading the row that holds the schedule.**
    - `auxiliaryIndex1`/`3`/`5` on `projectPlanningEntries` is the **step-type**
      GUID, **shared across jobs** — not a row handle. 13 distinct jobs (J32865,
      J35067, J35160, J35481, J36528, J36732, J36808, J36812, J37094, J37613,
      J37648, J37865, J37905) all carry `aux1 = 851226ac-…` = catalogue row
      "Vinyl Install Only". Over 500 rows pulled: **1 distinct aux1**.
    - All four published planning services return the **identical** 35 rows —
      ours plus Infotech's own `Job_Card_ExcelICGIPPProjectPlanningSubform`,
      `Job_ListICGPPIProjectPlanningSubform`,
      `Job_Card_ExcelICGPPIProjectPlanningSubform`. So this is not our page being
      built wrong; these subforms inherit job context from the parent page and
      carry none of it over OData.
    - ⛔ **DO NOT PATCH `LumineoPlanningSteps`.** Setting `Start_Date` or
      `Assigned_To` on `851226ac-…` rewrites the template shared by all 13+ jobs
      using that step, and schedules none of them. `bc-odata-step-probe.ps1
      -Write` defaults to `-Field assignedTo` on row 1 (`Sales`) — it does restore
      the value, but it writes to the catalogue and **would have reported
      success**, sending the next session on to rewire the flow.
  - ⚠️ **The flow's resolve filter may never have worked.**
    `BCPush_PlanningSteps-clientdata.json` `Build_Filter` builds
    `projectPlanningEntries?$filter=auxiliaryIndex4 eq '<jobno>'`. Run live today
    that returns `"The supplied column ID '0' cannot be found in the query"`.
    Unfiltered `$top=N` works fine. Verify this before assuming the resolve step
    is sound — it is the same error class that made us think the step page had no
    addressable row.
  - 🔴 **ALL FOUR ICG.IPP PAGES ARE EXHAUSTED (Sep 22).** Every Infotech page was
    published as a web service in UAT and probed. **None exposes per-job planning
    rows.** Do not re-try these:

    | Page | Service published | What it actually is |
    |---|---|---|
    | 71441976 `ICG.IPP.ProjectPlanningSteps` | `LumineoPlanningSteps` | catalogue list — the 35 rows |
    | 71441977 `ICG.IPP.ProjPlanningStepCard` | `LumineoPlanningStepCard` | catalogue **card** — same 35 `Code` GUIDs |
    | 71441978 `ICG.IPP.ProjectPlanningSubform` | (Infotech's own `Job_*` services) | catalogue via a **temp source** — 35 zeroed rows |
    | 71441979 `ICG.IPP.ProjectPlanningAct` | `LumineoPlanningAct` | **not OData-exposable** — 404 + absent from `$metadata` even with `Published = 1`; by its name a Role Center activities cue part |

    - `LumineoPlanningStepCard` proved the catalogue reading beyond doubt: its
      fields are step-type **configuration** — `Due_Date_Calculation`,
      `ActivateNextStepDescription`, `Successor_Link_Step`, `ShowOnScheduler`,
      `Power_Automate_Trigger_Url`, `PlanningAreaDescription` — keyed on the same
      `Code` GUIDs. No job, no schedule.
    - ⚠️ Page IDs and table IDs are numbered **independently**. Page 71441977 is
      the Step *Card* over table 71441976, NOT a page over table 71441977. This
      tripped us up; don't infer a page's source table from its object ID.
    - ✅ **CONFIRMED by Page Inspection (Sep 22), on a real job's planning
      steps.** The subform is `ICG.IPP.ProjectPlanningSubform` (71441978,
      **ListPart**) with Source Table `ICG.IPP.ProjectPlanningStep` (**71441976**)
      — the same table we read. Three readings settle it:
      1. **The record is NOT temporary.** (The earlier temp-source theory was
         wrong. Recorded because it is the obvious guess and someone will make it
         again.)
      2. **No field on the table references a job.** This is the decisive one: a
         per-job schedule table must carry a job reference, and this one has none.
         So 71441976 cannot hold per-job planning rows — independent of row
         counts or page filters.
      3. Page and Table stay the same wherever you click in the section.
    - ⛔ **This also kills the "our page is just filtered" alternative.** A
      page-level `SourceTableView` filter would explain `$count = 35` over a large
      table — but with no job field on the table, there is nothing to filter *by*
      and nothing per-job to find. Don't re-open this.
    - **So the mechanism is:** the subform lists the real 35 catalogue rows and
      surfaces per-job values (dates, assignee, complete) as **FlowFields or
      code-populated columns** sourced from another table and keyed by the parent
      job. Over OData there is no parent job, so those columns return
      `0001-01-01` / `""` / `false`. Every observation in this block has that one
      explanation.
  - 📊 **Useful side-finding: the BC-side source of our production stepper.** The
    35 steps carry `PlanningAreaDescription` ∈ {Sales (9), Production (15),
    Installation/Service (11)}, and exactly **9 have `ShowOnScheduler = true`**:
    Routing, Fabrication, Painting, Assembly Wiring, Face Production, Vinyl,
    Final Assembly, Final Inspection, Crating. That is our production department
    list, maintained in BC. Worth reconciling against `production-steps.ts`
    independently of the write-back thread.
    `Power_Automate_Trigger_Url` exists per step but is **empty on all 35** — an
    unused vendor hook for BC→flow notification. Outbound only, so it is not a
    write path, but it could replace some `BCSync_*` polling later.
  - ✅ **TARGET IDENTIFIED (Sep 22) — table 71441977 `ICG.IPP.ProjectPlanning`.**
    BC → `Table Information` record counts settled it:

    | Table | Records | Verdict |
    |---|---|---|
    | 71441976 `ICG.IPP.ProjectPlanningStep` | **35** | catalogue; **matches our OData `$count` exactly, so our page is unfiltered** |
    | 71441977 `ICG.IPP.ProjectPlanning` | **8,147** | ⭐ **the per-job table — the write target** |
    | 71441979 `ICG.IPP.ProjPlanTripResource` | 495 | trip/resource rows (sign365's `tripResource*` fields) |

    **8,147 ÷ 35 ≈ 232.8** — one row per (job × step) across ~233 jobs. That
    arithmetic is the confirmation; don't re-litigate it.
    - **Why no Infotech page exists over it:** the subform's per-job columns are
      almost certainly **FlowFields on the catalogue row** that look up into
      71441977 filtered by the parent job. That is how the UI shows per-job data
      while every OData route returns blanks — and why publishing more Infotech
      pages will never help.
    - ✅ **We already hold Read/Insert/Modify/Delete on 71441977** via
      `ICG.PROJPLANNING.ADM`. No further permission ask is needed for the write.
  - ⏳ **STATUS (Sep 25): AL project scaffolded, waiting on a BC permission.**
    `bc/lumineo-planning-ext/` exists (template `HelloWorld.al` removed, publisher
    `Lumineo Signs`, no `.al` objects yet) with `.vscode/launch.json` → sandbox
    `UAT`, tenant `fe0182fa-…`. Sign-in works; `AL: Download Symbols` fails
    Forbidden on *TableData 2000000206 Published Application* for Alex's **user**.
    Admin emailed Sep 25 to add **`EXTEN. MGT. - ADMIN`** (Company blank) to
    `asmith@lumineosigns.com` in UAT. (The old name `D365 EXTENSION MGT` doesn't
    exist in this BC version — typing it gives an "Aggregate Permission Set" error.)
    Once granted: download symbols → add ICG Project Planning dependency to
    `app.json` → download again → read 71441977's field names from `.alpackages`.
  - ✅ **Sep 28: symbols downloaded, page written + compiles clean.** Grant
    landed; UAT is **BC 28** (`app.json` application 28.0.0.0 / runtime 17.0 —
    29.0 gave "No published package"). Dependency: **Infotech Project Planning**
    `dde7ba4d-60fc-48d6-9f2e-ab535dc7b886` v28.0.84.0 (prod must be ≥ this).
    - **71441977 schema (from symbols):** PK **`Project No.` + `Code`** (Code =
      catalogue step GUID). Writable: `Start DateTime`, `End DateTime`,
      `Due DateTime` (+ `Start Date 2`/`Start Time`, `End Date`/`End Time`,
      `Due Date 2`/`Due Time` pairs), `Duration`, `Assigned To`, `Started`,
      `Complete`, `Completed Date`, `Completed By`, `Quick Notes`. Old
      `Start Date`/`Due Date` are **obsoleted** by Infotech — don't use them.
    - 🔴 **`Assigned To` / `Completed By` are Resource No. (Code[20], Type=Person)**,
      not names — the flow needs an employee → Resource No. mapping.
    - `src/LumineoProjectPlanning.Page.al` — page **58400** (50100 collided with Infotech Role Center KPIs), publish as service
      **`LumineoProjectPlanning`**; key `(Project_No='J…',Code=<guid unquoted>)`.
      Exposes `Step_Description` (looked up from the catalogue) so the flow can
      resolve by name — step GUIDs differ per environment.
    - `src/LumineoPlanningWriteBack.PermissionSet.al` — **`LUM PLANNING WB`** (58400),
      page X + RM on 71441977; assign to the app card.
    - ✅ **Published to UAT + probed (Sep 28)** — `scripts/bc-odata-planning-probe.ps1`
      (read-only): **8,147 rows**, J31949 returns real dates/assignee, keyed GET
      `(Project_No='J…',Code=<guid>)` returns one row **with an etag**. PATCH
      works with the existing service principal. (Took `EXTEN. MGT. - ADMIN` +
      Company-blank on Alex's `D365 BASIC`/`D365 BUS FULL ACCESS` to publish —
      install runs in EVERY company; page ID 50100 collided, now 58400.)
    - 🔴 **Rows are SPARSE — not 35 per job.** J31949 has 5 rows (only steps that
      were touched). 8,147 ≠ 233 × 35; that arithmetic was coincidence. Scheduling
      an untouched step needs an INSERT — page is `InsertAllowed = false`; open
      question whether/how ICG creates rows (don't bypass hidden setup).
    - 🔴 **Time zones — write test (`bc-odata-planning-write-test.ps1`, J31949
      "Upcoming Manufacturing", restored).** `<X> DateTime` is UTC; the
      `Date 2`/`Date` + `Time` pair is the **writing session's local time**, and
      ICG's OnValidate converts between them in the SESSION time zone. A human in
      Central writes 07:00 → 12:00Z. **Our service principal's session is UTC**, so
      whichever side we write, the pair lands in UTC — 5 h off for anyone reading
      the Time fields in BC. Fix needs AL on our side (set both sides explicitly
      with a fixed Central conversion), not a flow change.
      ✅ **Built + verified in UAT (Sep 28, v1.0.0.1; v1.0.0.2 adds Duration):**
      the page now exposes **`Sched_Start` / `Sched_End`** (UTC in) as the ONLY
      writable dates. They validate the UTC DateTime through ICG, set
      `Duration` = End − Start themselves (ICG only derives it in the PAIR's
      OnValidate, which this path skips — v1.0.0.1 left it 0), then pin the pair to **Central wall-clock** via System App
      `Time Zone`.GetTimezoneOffset(instant, 'Central Standard Time') — DST-aware,
      independent of the session zone — and put back Started/Complete. All raw
      date/time fields are read-only on the page. **The flow writes only
      `Sched_Start`/`Sched_End`** (+ Assigned_To etc.). Verify with
      `bc-odata-planning-write-test.ps1` after F5 — it covers CDT, CST, and the
      UTC/Central date boundary.
    - 🔴 **Writing `Start DateTime` sets `Started = true`** (writing the pair does
      not). A schedule push must not mark steps started.
    - `Duration` is derived (End − Start) — never write it. BC does NOT enforce
      start ≤ end (Fabrication on J31949 has negative duration).
    - ⚠️ **Bulk PATCHes are order-sensitive**: blanking the start while `Started`
      is true sets start = NOW. Clear `Started` first, then DateTime, then the
      pair. The write-test restore does it one field at a time for this reason.
    - ⚠️ PowerShell `ConvertFrom-Json` reinterprets DateTimes — use
      `-DateKind String` when checking what BC actually stored.
  - 📌 **RESUME HERE — build an AL page over 71441977.** This is now the plan, not
    a fork: no Infotech page exposes the table, and the sign365 API entities stay
    `Updatable=false` regardless of permissions (that is a page property, not a
    rights problem). A BC **Query** object won't do either — queries are read-only.
    1. **Stand up an AL project against UAT** (VS Code + AL Language extension) and
       run **`AL: Download Symbols`**. This is the prerequisite for everything
       below, and it also hands us two things we do not otherwise have:
       - the **exact field names** of table 71441977 (needed for the page and for
         the flow's field mapping — we have never seen them);
       - the **dependency block** for `app.json` (ICG Project Planning's app id,
         name, publisher, version), required to reference another extension's
         table. Get it from BC → **Extension Management** → Project Planning.
    2. **Write a List page** over `SourceTable = "ICG.IPP.ProjectPlanning"` with
       `ModifyAllowed = true`, `InsertAllowed = false`, `DeleteAllowed = false`.
       Expose the job reference, the step link, start/end, assignee,
       started/complete — **and `SystemId`**, so rows are addressable without
       relying on a GUID primary key the way the catalogue page did.
    3. **Publish the extension to UAT**, then publish the page as a web service
       (same pattern as `LumineoPlanningSteps`), and re-probe: expect **~8,147
       rows**, **real dates**, and **a job identifier** — the three things every
       page so far has failed.
    4. **Rewire the flow** once the probe comes back clean. Today it resolves
       through sign365 and PATCHes `projectPlanningEntries(<systemId>)`; base URL
       and row addressing move to the OData form
       `…/ODataV4/Company('Luminous%20Neon')/<service>(<key>)`.
       **Auth is unchanged** — same registration, same `.default` scope.
       ⚠️ If the key ends up a GUID, remember the literal is **unquoted**.
    5. **Drain the backlog.** `kind:"schedule"` outbox rows have queued with no
       consumer since Sep 14 — the first real end-to-end test, and it will fire in
       volume.
  - 📨 **Send `flows/BCPush-infotech-request.md` in parallel — it is still NOT
    sent.** Our own AL page is a workaround, not the durable fix: writing to
    another extension's table **skips ICG's own page logic** (table triggers still
    fire) and an ICG upgrade can change the schema under us. A vendor-sanctioned
    writable API page remains the answer we actually want. Their three broken
    PATCH samples are worth reporting whatever route we take.
  - **Files:** probe → `scripts/bc-odata-step-probe.ps1`; internal permission ask
    → `flows/BC-permission-request.md` (**GRANTED — ask is closed**); vendor ask →
    `flows/BCPush-infotech-request.md` (**still NOT sent**).

- **🏭 PRODUCTION CUTOVER — what must be repeated in prod once this works in UAT.**
  Everything above was done against **UAT**. None of it travels automatically:
  BC permissions and published web services are **per-environment** and are not
  carried by a Power Platform solution. Read alongside
  `flows/BC-ENVIRONMENT-SWITCH.md`, which covers the BCSync *read* flows; this
  list is the *write-back* additions.
  1. **Confirm the prod client ID.** The Entra Application Card in production may
     be a different registration than UAT's `34a4de23-4db0-48d9-a941-285c9c2f9b5d`.
     Check before assuming — the whole permission list hangs off it.
  2. **Re-do the permission sets on the prod app card**, same procedure and the
     same outage caveat: State `Disabled` → add **`ICG.IPS.GENERAL`** and
     **`ICG.PROJPLANNING.ADM`** → State `Enabled` → **Grant Consent**. Needs
     SUPER or SECURITY in *production* BC — confirm Alex's grant covers prod, or
     route it through the admin again. **Do not** copy `SECURITY` onto the prod
     app card; that was our UAT over-grant.
  3. **Re-publish the web service page(s)** in prod under the *same Service
     Names*, so flow URLs need no per-environment edit beyond the base.
     **Partly done already (Sep 22):** `LumineoPlanningSteps` was already live in
     Production, and `LumineoPlanningAct` + `LumineoPlanningStepCard` were
     published there before UAT. ⚠️ All three are now known to be **catalogue**
     pages that cannot carry per-job data — so once the real write target is
     settled, **unpublish these from Production** rather than leaving three unused
     services behind. Publishing a page grants no access on its own (the calling
     principal still needs BC permissions, which Production's app card does not
     have), so nothing is currently exposed.
  3a. **Point the BC flows at Production.** `BCPush_PlanningSteps` and
     `BCSync_NewOrders` both call page 58400 (`Bc_ODataBase` → the
     `/Production/ODataV4` base); `BCSync_NewOrders` also reads through the BC
     connector (`Bc_Environment` → `PRODUCTION`). See
     `flows/BCSync_NewOrders.md`.
  3b. 🔴 **Deploy the AL extension to Production — this is new and is NOT the same
     as a sandbox publish.** Direct publish from VS Code works against a sandbox
     (UAT); **Production requires uploading the built `.app` as a per-tenant
     extension** via **Extension Management → Upload Extension**, and it must be
     built against the same ICG Project Planning dependency version that
     Production runs. Check the ICG version in both environments before building —
     a version mismatch is the likeliest cutover failure. Keep the `.app` and its
     source in the repo so the deployed artifact is reproducible.
     ⚠️ An ICG upgrade in Production can change table 71441977's schema under the
     extension; re-validate after any Infotech update.
     ⚠️ **The developer's own BC USER needs `EXTEN. MGT. - ADMIN`** (Company blank;
     the old `D365 EXTENSION MGT` name no longer exists in our BC version)
     to download symbols, publish from VS Code, or upload the `.app`. Without it
     `AL: Download Symbols` fails with *"IndirectRead on TableData 2000000206
     Published Application"* (hit in UAT Sep 25). This is on the user, not the
     Entra app card — the app card grants don't apply to a VS Code sign-in.
  3c. **Add a User Setup line for the flow's BC user** (`POWERAPPS PERMISSIONS`
     in UAT — confirm the prod user's name). Without it, completing a step
     fails in ICG's validation.
  4. **Repoint the push flows.** `Bc_ApiBase` contains `/UAT/` and must become the
     prod environment name; **`Bc_CompanyId` will likely differ** (UAT is
     `4738bfb5-a06d-ec11-bf27-000d3a132a9e` — confirm prod). `Bc_Tenant`
     (`fe0182fa-d183-46ab-8493-9e8ea9c3d0b8`) is unchanged. Prefer moving these
     to **Dataverse environment variables** per `BC-ENVIRONMENT-SWITCH.md` rather
     than editing each flow.
  5. 🔴 **Do not hardcode any step GUID.** The catalogue `Code` values are
     per-environment; `851226ac-…` is a UAT value and means nothing in prod.
     Whatever the final resolve step is, it must look the step up by name/job at
     run time.
  6. 🔴 **Move the client secret to Key Vault before prod.** It is currently
     injected from `$env:BC_CLIENT_SECRET` into the staged solution copy. Needs a
     vault, an SP grant, and an extra flow step — see `flows/BCPush_JobCompletion.md`.
  7. **Re-run the probe against prod** before enabling anything, then turn the
     flows on **one at a time** and validate against a single real job.
  8. **Expect to iterate on permissions** — BC reports missing table permissions
     one at a time, so a fresh 403 naming a different table is progress.
- **Last shipped (Sep 16, 2026 · latest) — deployed + committed: weather chips fixed.**
  Symptom: install cards showed no weather, or July's conditions. `WeatherCache_Refresh`
  was healthy (ran every 6h, forecasts for all 66 job ZIPs) — the bug was the READ.
  The flow upserts one row per ZIP per day and **never deletes**, so
  `lum_weathercaches` reached **6,244 rows**; `weatherByZip()` did one un-paged
  `list()` and Dataverse caps a page at **5000**, silently dropping the current days.
  - Fix: server-side `lum_date ge <today − 14d>` + `orderby lum_date desc`
    (`weatherFilter`, `buildWeatherMap` in `dataverse-live.ts`, 4 tests in
    `weather-cache.test.ts`). The legacy **dateless** fallback is gone — those rows
    stopped updating in July and could only ever show stale weather.
  - 🔴 **Every other `list()` in `dataverse-live.ts` is also un-paged** — any table
    that grows past 5000 rows will truncate the same silent way. Filter or page it.
  - **Open follow-up:** add a delete-old-rows step to `WeatherCache_Refresh`; the
    table still grows ~66 rows/day. Harmless to the app now, just untidy.
  - Diagnosis tip: `pac env fetch --xml "<fetch aggregate='true'>…"` uses the
    active pac profile — no device-code sign-in needed for read-only Dataverse checks.
- **In progress (Sep 14, 2026) — BC write-back (scheduler → Business Central).**
  **Update Sep 16: the app side is now DEPLOYED** — completing a job's last
  department enqueues the `kind:"job"` row live. Remaining work is the flow
  import/validation (next steps (b) + (d) below).
  Goal: push a job task's start/end + assignee + started/complete back to BC's
  Project Planning. **Half of it now works.**
  - ✅ **SHIPPED THIS SESSION (not yet deployed): job-level completion.** Infotech's
    **Sep 11, 2026** collection (`…/Postman/UAT/NEW 9.11.26/`) made `jobs` and
    `projectPlanningLines` writable. `job` is keyed on `no`, so `jobs('J32865')`
    addresses one row — no resolve, no composite key. Completing the LAST
    department on the production stepper now enqueues a `kind:"job"` outbox row
    and `flows/BCPush_JobCompletion-clientdata.json` PATCHes
    `{complete, icgSgpCompletionDate}`. Reopening reverses it.
    **`status` deliberately NOT written** (posting/billing consequences).
    ✅ **No Dataverse script** — `crfdf_kind` is a plain string column, so the new
    kind reuses the existing outbox table (same trick as shipping's `kind:"shipping"`).
    Pure logic + 8 tests in `bc-planning-sync.ts` (`allStepsComplete`, `buildJobPush`);
    transition-only firing lives in `job-dept-completion-store.ts`. 254 tests green.
    Guide → **v3.7**.
  - 🔴 **STILL BLOCKED: the per-step schedule push** (start/end/assignee). Re-verified
    against live UAT `$metadata` Sep 14: `projectPlanningSteps` +
    `projectPlanningEntries` are **still** `Updatable=false`, still no addressable
    row (keyed GET → `"The supplied column ID '0' cannot be found in the query"`,
    no ETag), still no `<Action>`/`<Function>`. `projectPlanningLine` — the one that
    DID open — has no `assignedTo`, no start/end, no `started`/`complete`; it's
    quantity/cost data. So `"schedule"`/`"completion"` outbox rows keep queuing
    harmlessly with nothing draining them.
  - ⚠️ **Their two PATCH samples are both broken** — worth telling them:
    `jobs(<guid>)` fails (`"Error in query syntax"` — key is the job-no string);
    its body sets `orderedBy`, which appears **0 times** in the metadata; and
    `projectPlanningLines('26200')` uses a **non-unique key** — `no` is the G/L
    account no. and **14,030 rows share it**, with the keyed GET silently returning
    the first. That set is now `Deletable=true` too. Documented in the request doc.
  - ✅ **Write permission CONFIRMED (Sep 14) — `scripts/bc-uat-write-proof.ps1` run
    against `J25036`.** PATCH `jobs('J25036')` accepted + persisted on re-read, then
    restored. The existing read credentials already carry write, so **nothing is
    needed from Infotech for the job flow.** The same run pinned BC's own wording for
    the other three findings: step PATCH → `BadRequest_MethodNotImplemented`
    *"Entity does not support modifying data."*; `jobs(<guid>)` → *"Error in query
    syntax"*; `orderedBy` → *"The property 'orderedBy' does not exist on type
    'Microsoft.NAV.job'."*
  - ✅ **Packed into the solution (Sep 14).** `_build_pushflow_solution.py` now emits
    BOTH flows → **`BCPushReview_1_0_0_2.zip`** (Downloads, outside the repo).
    New flow GUID `30905c4a-f9b4-4424-91e6-b0046a3216b4`, registered as a
    `<Workflow>` + `<RootComponent type="29">`, sharing the existing
    `new_sharedcommondataserviceforapps_bcpush` connection reference. Packed with
    **`pac solution pack`** — staging is now the pac unpacked-SOURCE layout
    (`Other/Solution.xml`, `Other/Customizations.xml`, `Workflows/`), not the flat
    in-zip layout the old script wrote, so it round-trips with `pac solution unpack`.
    🔴 **No unpacked solution is kept in the repo — the script IS the source of
    truth and rmtrees its staging dir each run. Edit the script, not the staged copy.**
    The secret is injected from `$env:BC_CLIENT_SECRET` into the staged copy only;
    without it the build still succeeds with a placeholder.
  - **Next:** (a) send `flows/BCPush-infotech-request.md` (rewritten Sep 14 — narrowed
    ask + the three sample defects, with BC's exact error text); (b) import the zip,
    map the connection ref, turn on **only** BCPush_JobCompletion, validate on UAT;
    (c) redeploy the app (the enqueue code has never been pushed) and run one real
    job end to end — the enqueue path is live-only, so dev can't exercise it;
    (d) before production, move the secret to a Key Vault-backed environment
    variable (needs a vault + SP grant + an extra flow step — see BCPush_JobCompletion.md).
  **Postman:** `…/Postman/UAT/Sign365 API - with PATCH.postman_collection.json` still
  holds the older hand-built write-back folder; Infotech's own is in `NEW 9.11.26/`.
- **Last shipped (Sep 4, 2026 · latest) — deployed + committed: Shipping "Staging"
  kanban.** A master board of user-named, color-coded lists under
  the week's day columns, holding projects that are built and waiting for a truck.
  Drag a card onto a day (new load) or onto an existing load → it becomes a load
  item, the load editor opens, and the card leaves staging.
  - ✅ **No Dataverse work needed.** It reuses the existing job-queue tables with a
    new `kind` value `"shipping"` (`crfdf_kind` is a plain string column), so there
    is no script to run and it works live immediately. A staged card carries only
    jobNo / customer / description — the scheduling-shaped columns (hours,
    department, crew, ZIP) stay 0/empty. **Nothing is smuggled**: stop location,
    Deliver/Pickup and loading notes are per-run decisions, which is exactly why the
    load editor opens on drop.
  - `shipping/stage.ts` — pure mapping + drag bookkeeping (`stageItemFromJob`,
    `shipmentItemFromStage`, `reorderGroupIds`, `findStagedItem`, `stagedCount`).
    17 tests. `shipmentItemFromStage` maps a blank job no to **null**, not `""` —
    that's what the load editor's "+ Job #" empty state and the printed sheet test.
  - `ShippingStageBoard.tsx` — the board. `ShippingBoard.tsx` owns the drop targets
    (it owns the loads store + editor); new `DayColumn` sub-component so a drop
    highlight doesn't re-render all seven days.
  - 🔴 **`DND_SHIP_STAGE` must stay lowercase** (`text/shipstageid`) — the HTML5 drag
    store lowercases type keys, so a mixed-case constant silently never matches in
    `dataTransfer.types`. Deliberately distinct from the calendar queue's
    `text/queueitemid` so the two drag systems can't accept each other's cards.
  - **Also fixed in passing: `loads-store` now writes through `persistOrReport`**
    (was `.catch(console.error)`, i.e. silent). This became load-bearing: a dropped
    card leaves staging immediately, so a silently-failed load write would have
    looked exactly like lost work. Now it surfaces in `SaveStatus`.
  - `GroupDialog` extracted from `JobQueuePanel` → shared `QueueGroupDialog.tsx`
    with a `noun` prop ("list" for shipping, "group" for the calendar queues).
  - ⚠️ The staging edit button needed its **own** style — `.job-queue__icon-btn` is
    white-on-translucent-white for the navy queue header and is invisible on the
    light staging bar. Use `.ship-stage__icon-btn`.
  - Verified in-browser end to end (drop on day, drop on existing load, cross-list
    drag, within-list reorder, list add/recolor/reorder/delete, week paging leaves
    the board untouched, dark mode). 213 tests green. Guide → **v3.4**, new **§5.16**.
  - **Open follow-ups:** no BC auto-fill for a list (the dialog's "coming soon"
    field is still a placeholder, shared with the Job Queue).
- **Last shipped (Sep 4, 2026 · latest) — deployed + committed: a lent employee's
  install work now shows on the PRODUCTION board, + shipment loads on production
  people. Also fixes the "assist sticks to every future week" bug.**
  - **Why:** most of the company reads the Install board to see what's going out;
    a production employee reads Production to see their own week. A lent person's
    install work existed only on Install, so their production row was a grey
    "Installation" block with no idea what the work was.
  - 🔴 **The assist week-scoping BUG (user-reported, confirmed):** an assist is a
    one-week loan but is stored as an ordinary `crfdf_installationemployees` row,
    and the install `loadEmployees()` returned **every** assist row with no week
    filter — so a lent person sat on the install roster forever. Only the
    *fillers* were week-scoped. Fixed via `hiddenInstallEmployeeIds`, unioned into
    the CalendarView's `hiddenEmployeeIds` (the VisibilityMenu still shows only the
    user's own hidden set). **A wrong-week row with cards that week still shows**,
    so pre-existing work can never be orphaned into an invisible row.
  - **Mirroring** (`services/assist-mirror.ts`, pure, 24 tests): install cards are
    re-homed onto the lent person's production row with `mirrorOf: "installation"`
    + `mirrorHalf`. Render-only — **never persisted, never in an engine context**
    (the assist day already blocks capacity; counting the card again would
    double-book). Read-only on production: `readOnly || !!line.mirrorOf`, and
    copy/duplicate/split/delete are all withheld.
  - Confirmed design decisions (user chose): a full lent day **still blocks**
    production scheduling; an AM/PM day leaves the other half open; mirrors are
    **read-only** on production; shipment-load region is **always WK**.
  - **Shipment load on a production employee:** the Add panel's "Shipment load"
    picker now shows on Production too. `services/lend-shipment.ts` creates the
    card on the **WK install board** and lends the person for that day (reusing
    their existing assist row for that week rather than making a second one), so
    it mirrors back to production for free. One-way: an install employee on a load
    never appears on production. No `Install` badge on shipment cards — the blue
    🚚 card already reads as a load.
  - 🔴 **Dev mode couldn't exercise ANY of this** (assist store returned [] and the
    install-card cache was never populated by the mock source), so it was live-only
    and unverifiable — the same trap that hid the multi-week-job bug. Added
    `data/mock-assist.ts` (mutable, so runtime lends work), made the mock install
    source publish to the card cache on load AND on create/update/delete like the
    live one, resolved its assist roster **at call time** (an import-time list
    never shows a runtime lend), and moved `hydrateInstallCards()` out of the
    `if (!LIVE) return` guard in `App.tsx` — the Production mirror and the Shipping
    "Scheduled" badge both read that cache and can't wait for the Install board to
    be opened first.
  - Verified in-browser end to end: badges + dashed cards on production, full day
    blocked / AM day still addable, filler text suppressed behind a mirrored card,
    lent rows vanish next week (both hand-lent and shipment-created), and the
    shipment round trip Production → Install → mirrored back. 246 tests green.
    Guide → **v3.6** (§5.10 rewritten).
  - **Open follow-ups:** a NEK shipment run must be moved by hand on the install
    board (region is hardcoded WK by choice); mirrors are one-way (no editing from
    production, by choice).
- **Earlier (Sep 4, 2026) — deployed + committed: drag a project back OFF a
  load into staging, and staging lists 1.5x wider.**
  - **The round trip closes.** Drag a load item by its ⠿ grip out of the load
    editor onto a staging list → it leaves the load and comes back as a staged
    card. `stageItemFromShipmentItem` is the inverse of `shipmentItemFromStage`;
    per-run fields (location / kind / loaded / notes) are deliberately dropped.
  - 🔴 **The trick that makes it possible:** the load editor is a full-screen
    `.slide-over` scrim (z-index 100), so staging underneath can't normally get
    the drop. On item dragstart, `ShippingBoard` sets `itemDragging` →
    `.slide-over--drag-through` puts `pointer-events: none` on the scrim (panel
    re-enabled to `auto`) and lightens the dim. **No z-index games** — with
    pointer-events off, hit-testing falls through regardless of stacking.
    Verified with `elementFromPoint` mid-drag: it resolves inside `.ship-stage`.
  - **One gesture, two drops.** The same grip drag can land inside the panel
    (reorder, uses `dragIdx` state) or on a staging list (uses the new
    `DND_LOAD_ITEM` dataTransfer key). Where you release decides. Both verified.
  - `DND_LOAD_ITEM` = `text/loaditemid`, lowercase for the same reason as
    `DND_SHIP_STAGE`. A load item is only addressable as (load, item), so the ids
    travel joined by `|` via `encodeLoadItemRef` / `decodeLoadItemRef` (both UUIDs,
    never contain the separator; malformed payloads decode to null).
  - ⚠️ **Playwright cannot drive this drag** — the row is only `draggable` while
    the grip is held (`armed`), which needs a React re-render between mousedown and
    dragstart, so `dragTo` fails. Verified instead by dispatching real `DragEvent`s
    with a `DataTransfer` via `browser_evaluate`. Same limitation as the left-edge
    resize handle. If you touch this, test it that way (or by hand).
  - Lists widened 240px → **360px** (collapsed 190 → 285, `+ Add list` 190 → 285).
  - 222 tests green. Guide → **v3.5**.
- **Earlier (Aug 16, 2026) — deployed + committed: THE "my edit didn't
  take the first time" BUG IS FIXED.** Full write-up in the **Write-path invariant**
  section above — read that before touching a write path. Short version: the host
  bridge *rejects* when cold (first action after load) and `writeWithRetry` only
  looked at *returned* failures, so it never retried; then `catch → loadWeek()`
  reloaded the board and erased the optimistic edit. Retry now covers thrown +
  returned, classification is inverted (retry unless positively permanent), all 55
  writes go through `dv*`, no store reverts on failure, and `SaveStatus` surfaces a
  failure with a retry. Three tests enforce it. Guide → v3.3.
  - ⚠️ **Couldn't repro the live failure from here** (needs the deployed host), so
    this fixes the whole class rather than one error string. If it ever recurs the
    banner shows the real message and the console logs each retry — **get that
    message**, it names the actual cause.
- **Earlier (Aug 16, 2026) — deployed + committed: user-defined tick-box
  columns on a load's printed shipping list.** The sheet's two hardcoded columns
  (Loaded/Order) are now a picked set.
  - `shipping/print-columns.ts` — pure library/selection logic (normalize,
    case-insensitive add/remove/toggle, `visibleCheckColumns` orders by the
    library so the sheet doesn't reshuffle with click order + drops selections
    whose option was deleted). No-ops return the input **by identity** so the
    store can skip a write. 17 tests.
  - `PrintColumnsPicker.tsx` — multi-select on the print preview. 🔴 **Lives
    OUTSIDE `.load-print__sheet` on purpose** — `printMarkup` copies that
    element's `outerHTML` into the print window, so anything inside it goes to
    paper. New `.load-print__stack` wraps bar + sheet.
  - **Persistence: `settings-store` → localStorage** (`lumineo.settings.
    printCheckOptions` / `.printCheckColumns`), i.e. **per device, applies to
    every printed load**. Deliberate — no Dataverse table to create. ⚠️ Not
    shared across users; moving it to Dataverse is the open upgrade if the team
    wants one list. Per-load (rather than global) selection is the other option.
  - **Capped at 6** — each tick column costs Notes width (259px @2, 205px @4,
    142px @6). Tick headers tightened to 9px/slim padding (+78px back at 4).
    **Open offer: switch the sheet to landscape past ~4 columns** — buys far
    more than tuning. Cap is `MAX_CHECK_COLUMNS`.
  - Verified in-browser incl. survival of a full reload. Guide → **v3.2**.
- **Earlier (Aug 13, 2026) — deployed + committed: shipping load items —
  reorder, editable job #, richer print sheet.**
  - **Reorder** — `reorderItems` (pure, in `shipping/types.ts`) + `moveItem` in
    `loads-store.ts`; drag the new ⠿ grip in `LoadEditorPanel` or focus it and
    press ↑/↓. Rows are only `draggable` **while the grip is held** so the text
    fields inside stay selectable. Order flows to the printed sheet and the
    install board's `ShipmentItemsPanel` for free (both render `load.items` in
    array order). ✅ **No Dataverse script needed** — `crfdf_sortorder` already
    existed and was already read back sorted; only the write side was missing
    (`updateItemSortRecords`, writes just the rows that shifted).
  - ⚠️ Reordering an **auto-named** load can rename it — `defaultLoadName` lists
    stops in item order. Deliberate (name follows the route); typing a name
    still overrides it.
  - **Editable job #** — the job number on an item is now a button:
    pick a BC result (customer + description follow the job; location/notes/
    loaded stay), type a number + **Enter** for a job BC search can't reach yet,
    or **Clear** to detach. `JobSearch` gained `onCommitText`/`onCancel`/
    `autoFocus`/`placeholder`.
  - **Print sheet** — two tick columns (**Loaded**, **Order**) and Notes pinned
    at **35%** so write-in space doesn't depend on what's typed (63px → 259px
    when empty). Description floored at 22% or the wider Notes column wrapped it
    to 5 lines. Not done (offer stands): a min row height for real write space.
  - **Also:** shipment writes now go through the retrying `dv*` helpers (were
    calling the SDK directly, against the write-path invariant) — a reorder
    rewrites several rows at once, so a blip mid-reorder would half-apply the
    saved order.
  - Verified in-browser end to end (drag, keyboard, all 4 job-# paths, print).
    Tests: `shipping/reorder-items.test.ts` (8). 160 green. Guide → **v3.1** —
    incl. a **new §5.15** documenting the Shipping board (it had never been
    documented; only the read-only truck-card popup was).
- **Earlier (Aug 1, 2026) — deployed + committed: Settings toggle for the
  day-hours hover readout.** `showDayHours` in `settings-store.ts` (localStorage
  `lumineo.settings.showDayHours`, default ON), a switch in
  `SettingsScreen` → Display, read in `EmployeeRow`. When off, the row's
  `onMouseMove`/`onMouseLeave` handlers are `undefined` rather than tracking the
  hovered day and discarding it — no per-mousemove work at all. Only kills the
  `.day-hours-tip` pill; the job-card hover preview is a separate feature and is
  untouched. Guide → v3.0.
- **Earlier (Jul 31, 2026) — deployed + committed: manual weekend scheduling.**
  A card placed on a Sat/Sun didn't stay: a 4h job on Sat Aug 1 reported End =
  Mon Aug 3 (hours rolled to Monday) and drew smeared across Sat–Sun.
  - **Root cause:** `getDayCapacity` returns 0 on weekends unless
    `worksWeekends`, and `calculateEndTime` skips zero-capacity days — so the
    hours walked past the weekend even though the START was pinned there. The
    weekend cells were already clickable/droppable; only the engine refused.
  - **Rule added — "a day you explicitly put a card on is a working day."**
    `capacity.ts`: new `hasManualWorkOn(empId, date, schedule)` (a non-blockout
    card STARTING that day) + a `{ manual }` opt on `getDayCapacity`. Derived
    from `startDateTime`, so it needs **no new column and survives reload**.
    A PTO/block-out card never opens a day.
  - `calculateEndTime` passes `manual: sameCalendarDay(cursor, start)` — the
    card's OWN start day always counts (this also covers drafts/previews not yet
    in `ctx.schedule`). Later days get no pass: a long Saturday job resumes
    Monday, never eats Sunday.
  - 🔴 **AUTO still refuses weekends**: explicit `isWeekend` guard added in
    `firstOpenSlot` that deliberately ignores the manual escape — someone on a
    Saturday isn't an invitation to pack more on. `nextWorkStart` intentionally
    stays capacity-based so same-day resequencing ON a Saturday works.
  - Falls out for free: `dayLoad` hover reads "4h of 8h · 4h open" (was 0h),
    WeekSummary capacity picks up the day (440h → 448h), and `computeRowCards`
    already left weekend-START cards unclipped, so the card now draws on
    Saturday only.
  - Tests: `engine/weekend-work.test.ts` (12). 152 green. Guide → v2.9.
- **Earlier (Jul 30, 2026) — deployed + committed: split a job card into sections.**
  Schedule a task in chunks (work it, switch jobs, come back) WITHOUT re-booking
  its estimate. Right-click a card → **Split into sections…**.
  - **Model:** `estimatedHours` stays the untouched **pot** on every part; each
    part's slice is an explicit `overrideHours`; parts link via new
    `splitGroupId` (`crfdf_splitgroup`, text 100 — run
    `scripts/add-scheduleline-splitgroup-column.ps1`). 🔴 **Column not created
    yet** — the app degrades gracefully (guarded like `scheduleSpanCol`; falls
    back to grouping by same job+task+**employee**, which deliberately does NOT
    swallow the crew-duplicate case). Run the script to make the link explicit
    so a part dragged to another person stays in the pot.
  - **Pure logic:** `services/split-hours.ts` — `potFor`, `splitSiblings`,
    `taskCommitment`, `splitPartLabels`, `evenSplit`, `isSplittable`.
    22 tests in `split-hours.test.ts`.
  - **Placement:** `store.splitScheduleLine(lineId, partHours[])` — part 1 stays
    put and shrinks; each later part goes to `firstOpenSlot` after the previous
    one, ctx rebuilt per part so they pack around existing work. Undo/redo +
    per-line write queue wired.
  - **UI:** `SplitCardPanel.tsx` (portal dialog, per-part hours, over-estimate
    warning), `1/2` badge on cards (`splitPartLabels`, one pass per render),
    and a pot readout under the hours fields in `EditJobPanel`
    (`HoursPotNote`).
  - **Re-add is hours-aware:** creating a card for a task that's already partly
    scheduled shows "8h of this task is already scheduled on <who> (<dates>)"
    and pre-fills Modified labor hours with the **remainder**. Over-pot is
    allowed but flagged red (user's call).
  - Also fixed in passing: the install-card CREATE retry rebuilt nothing (it
    resent the same payload after dropping a column, so it failed identically);
    production `createScheduleLine` had no drop-and-retry at all.
  - Verified in-browser end to end (split → 1/2 + 2/2 cards, pot note, remaining
    pre-fill). Guide → v2.8. 140 tests green.
- **Earlier (Jul 30, 2026) — deployed + committed: multi-week jobs now render on the following week.**
  Reported bug: a task scheduled across a week boundary stopped at Friday and was
  missing from the next week's board (its end date said otherwise).
  - **Root cause:** both live sources loaded a week with a *starts-in-this-week*
    filter (`crfdf_startdatetime ge Mon and le Sun`), so a line that started the
    prior week was never returned for the later week. The grid already handled it
    (`computeRowCards` clips to col 0 + `overflowLeft` ◂ arrow) — the data just
    never arrived. **Dev/mock mode returns all lines unfiltered, which is why this
    only reproduced live.**
  - **Fix:** new `services/week-window.ts` — `overlapsWindow()` (pure) +
    `scheduleLineWindowFilter()` (OData). Production board queries the overlap
    window; installation board's client-side subset uses `overlapsWindow`. The
    OData filter is two *parenthesized* clauses (not the tighter
    `start le to and end ge from`) so null-end rows still match as before —
    unparenthesized, `and` binds tighter and the query widens to every row.
  - **Also fixed by the same change:** those carried-over hours were missing from
    the ENGINE context for week 2, so capacity saw Monday as free and
    auto-schedule could double-book. `getHoursUsedOnDay`/`dayLoad` pro-rate by
    business-hour overlap, so they now count correctly.
  - `WeekSummary` Scheduled/utilization switched to summing
    `dayLoad(emp, day).scheduled` — a spanning job now loads on both weeks, so
    full-hours attribution would double-count it. Bonus: the week total now
    equals the sum of the per-day hover readouts.
  - Tests: `services/week-window.test.ts` (10). 118 green. Guide → v2.7.
  - Verified in-browser (dev): 56h job on Mon Jul 27 → renders on the week of
    Aug 3, col 0, Mon–Tue, `gantt-card--overflow-left`. ⚠️ The OData half is
    unit-tested but only fully provable against live Dataverse — worth a spot
    check on a real multi-week job on the deployed board.
- **Earlier (Jul 26, 2026) — deployed + committed: no-auto-move edits + smarter auto-schedule.**
  Fixes two reported bugs: (a) auto-scheduling multiple jobs piled them onto Monday /
  filled the week; (b) editing one card stretched/moved another.
  - **Auto-schedule placement** rewritten: `placeDraft` (case B employee-no-start &
    case C auto-pick) now uses new **`firstOpenSlot(from, emp, ctx, ignoreLineId)`**
    in `time-walker.ts` — capacity-aware: first work day under 8h (efficiency-scaled),
    positioned after used hours, then `calculateEndTime` bleeds into later days;
    skips full days/weekends; appends after existing work (never overlaps).
    Replaced the old time-gap `findEarliestEmployeeSlot` (now dead, still exported
    via `_internal`). Tests: `engine/first-open-slot.test.ts` (6).
  - **Edits never touch other cards:** default **`cascadeEnabled` → false**
    (`settings-store.ts`). Off = move/resize/hours change only that card, no dialog,
    and `loadWeek` skips `settleSchedule`. Also loadWeek normalize now computes each
    card's end with **ignoreOccupancy when cascade off** (a card owns its own hours →
    stable reload, no cross-card stretch). Auto-cascade is opt-in in Settings.
  - Guide → v2.1. 101 tests green.
- **Also (Jul 26, 2026 · latest) — deployed + committed:** auto-scheduled INSTALL
  jobs stay single-day. `placeDraft` gained a `singleDay` flag that clamps the
  placed end to the start's calendar day; passed `true` for installation from
  `EditJobPanel` (isInstall) and `scheduleBatch` (`dataSource.kind`). Manual
  drag-resize still spans. Install crews stay 100% (no efficiency editor — by
  design, installs are day-based). Test: `services/schedule-draft.test.ts`.
  Guide → v2.2.
- **Also (Jul 26, 2026 · latest) — deployed + committed:** two auto-schedule fixes.
  1. **PTO/block-out cards now block capacity.** `capacity.ts`: a "block-out"
     custom card (isCustom, NOT a group `grp:v1:` or shipment) makes every day it
     covers unavailable — including days covered only by its visual `spanDays`
     (root cause: a PTO stretched via spanDays kept its real end on day 1, so
     only that day blocked). `getHoursUsedOnDay`/`coverageEndKey`/`effectiveHoursOnDay`
     updated; fixture now passes `spanDays`. Tests in capacity + first-open-slot.
  2. **Batch "Schedule from" date.** `placeDraft` gained `earliestStart` floor;
     `scheduleBatch(items, store, earliestStart)` threads it; `BatchListPanel` has
     a "Schedule from" date input (blank = next opening) → future-week batches.
     Tests in `services/schedule-draft.test.ts`.
  Guide → v2.3. 108 tests green.
- **Also (Jul 26, 2026 · latest) — deployed + committed:** per-day scheduled-hours
  **hover readout**. Hovering a person's day shows "Xh of Yh · Zh open" (red when
  over, "PTO/off" when blocked). New `dayLoad(employee, date, ctx)` in
  `capacity.ts` (separates real job hours from the block-out sentinel). `EmployeeRow`
  tracks the hovered day via `dayIndexFromClientX` (works over cards) and renders a
  `.day-hours-tip` pill; `scheduleCtx` (the store context) passed down from
  `CalendarView`. Guide → v2.5.
- **Also (Jul 27, 2026) — deployed + committed:** connect a Job Queue group to the
  batch (Multiple-jobs) list + edit staged jobs.
  - `batch-schedule.ts` `batchItemFromQueueItem(item)` converts a QueueItem →
    BatchItem (draft via `lineFromQueueItem`, employee/start null = auto).
  - **Load from queue**: a group dropdown in both `AddJobPanel` (Multiple mode
    entry point — needed since the empty list was otherwise unreachable) and
    `BatchListPanel`. Parent calendars read the right queue store
    (`useProductionQueueStore` / region-based install) and append via a shared
    `loadGroupIntoBatch`.
  - **Click-to-edit a staged job**: `BatchListPanel` rows are clickable →
    `onEditItem` opens `EditJobPanel` in create+batch mode seeded from the item
    (`batchItemId` + `seedEmployeeId`/`seedStart`); "Update in list" replaces the
    row by id. Fills the gap that queue-adds can't set employee/start/hours.
  - Guide → v2.6.
- **Also (Jul 26, 2026 · latest) — deployed + committed:** clicking a person's day
  cell now pre-fills BOTH the employee AND the clicked Start date in the create
  panel (Production + Installation). `EditJobPanel` create mode seeds `startDate`
  from `line.startDateTime` only when `line.employeeId` is set (the cell-click
  signal); toolbar +Add Job stays blank. Guide → v2.4.
- **Earlier (Jul 26, 2026 · late) — deployed + committed: employee hours/efficiency, routing-labor flow fix, cell-click employee pre-fill.**
  - **Employee hours/day + time-efficiency%** (Production): right-click a name →
    edit `Hours / day` + `Time efficiency (%)`. Efficiency moved from job-side to
    **capacity-side**: `capacity.ts` `getDayCapacity` now `*= productivityRate`;
    `effectiveHours` returns raw hours (no `/rate`); `useLivePreview` matched.
    `ResourceAdminInput` + `applyResourceInput` + live `employeeRecord`
    (`crfdf_standardhoursperday` / `crfdf_productivityrate`) persist it. All 100%
    today → no behavior change until set. Install crews NOT wired (hardcoded, no
    columns) — could add later. Tests in `capacity.test.ts`.
  - **Routing-labor fix — ⚠️ FLOW, needs a separate deploy step (NOT in `pac code
    push`).** Root cause was NOT app code (2010 passes `isProductionResource`); it
    was the Power Automate `BCSync_JobPlanningLines` "Filter resource lines" step
    excluding `jobTaskNo == 2010`, which wrongly dropped routing labor whose task#
    is 2010. Fixed the filter in
    `flows/BCSync_JobPlanningLines-*.json` (+ `-clientdata-backup.json`) to keep
    ALL Resource-type + Billable lines; bumped `_build_solution.py` →
    `BCSyncReview_1_0_0_6.zip`. 🔴 **TO GO LIVE:** in Power Automate edit that
    flow's filter to `@or(equals(lineType,'Billable'), equals(jobType,'Resource'))`
    (or import the new zip), then **Run it once** so previously-dropped routing
    lines sync into `crfdf_bcplanninglines`.
  - **Cell-click pre-selects employee:** `EditJobPanel` create mode seeds employee
    from the draft (`line.employeeId`) — clicking a person's day cell pre-selects
    them; toolbar +Add Job stays blank.
  - Guide → v2.0.
- **Earlier (Jul 26, 2026 · eve) — deployed + committed: Unified job add (Phase 1) + Batch scheduling (Phase 2).**
  Goal: ONE way to add jobs everywhere. Progress so far:
  - **Phase 1 — unified single-job add.** Add Job (BC) is now two steps: search +
    task-select (`AddJobPanel`, **Auto mode removed** — was broken) → **Continue →**
    hands a draft to the **edit panel in "create" mode** (`EditJobPanel` `mode="create"`),
    pre-filled (task text, summed hours, target dates via `useJobTargets`, stepper via
    `useJobSteps`; employee/start/end blank). Footer = **Schedule** (employee+start set)
    or **Auto Schedule** (either blank). Placement via new `services/schedule-draft.ts`
    `placeDraft()` (Schedule / next-open-slot for a chosen employee / proposeSchedule
    least-loaded when no employee). Wired via `onConfigure`+`createDraft` in
    Production/InstallationCalendar.
  - **Phase 2 — batch scheduling.** `AddJobPanel` Single/Multiple toggle. Multiple →
    create panel button becomes **Add to list** → `BatchListPanel` (drag-reorder +
    sort by release/prod-complete/install/hours) → **Schedule N jobs** places
    top-to-bottom via `services/batch-schedule.ts` `scheduleBatch()` (rebuilds ctx per
    item so auto packs around prior placements). `BatchItem` type there.
  - **Phase 3 — one way everywhere (DONE, deployed).** The **Job Queue** add and
    **group-card** add now open the SAME `AddJobPanel` (new `bcOnly` prop hides the
    Custom/Group tabs; custom `confirmLabel`). `onConfigure(draft)` → queue:
    `queueItemFromDraft` (`JobQueuePanel`, gets the board schedule store via a new
    `scheduleStore` prop from `CalendarView`); group: `addFromDraft` → GroupMember
    (`GroupCardBody`). `AddJobPanel` now **portals to `document.body`** (zIndex 300)
    to escape the queue's `transform` + stacking. Deleted the orphaned
    `JobTaskChooser` + its CSS. Verified queue + group adds in-browser.
  - Phase 4 (routing-labor) — user says it's working; SKIP.
  - **Unified-add goal COMPLETE (Phases 1–3).** One add flow: board, batch, queue,
    group. Guide → v1.8.
- **Earlier (Jul 26, 2026 · pm) — deployed + committed: Demo mode + interactive tutorial.**
  - **Isolated demo sandbox:** entering demo swaps every board store to a fresh
    in-memory source (`store.setDataSource` / `resetDataSource`) loaded with ~4
    weeks of tiled test jobs (`src/demo/demo-data.ts`). All edits local; never
    touch Dataverse. Orchestrated by `src/store/demo-store.ts` (`enterDemo` /
    `exitDemo`, tutorial phase/track/step). `DemoBanner` shows while active.
  - **Two ways in:** (1) "▶ Launch demo & tutorial" CTA on `HelpScreen` (everyone;
    `App` passes `onLaunchDemo`). (2) A new **`demo` UserType** — assign an email →
    `"demo"` in `USER_DIRECTORY`/Dataverse; they boot **locked** into the sandbox
    (`isDemoUser` in `current-user.ts`; `App` calls `enterDemo({locked:true})`).
  - **Tutorial:** `DemoTutorial.tsx` — welcome card (Scheduling tour / Full tour /
    Skip) + coach-marks (spotlight ring via box-shadow, tooltip, Back/Next/Skip).
    Targets via `data-tour` attrs on Sidebar items, `.calendar-toolbar__nav`
    (`calendar-nav`), and `.calendar-toolbar__add` (`add-job`); job-card steps
    target `.gantt-card`. Steps navigate screens via `onNavigate`.
  - Verified end-to-end in-browser (Playwright). Guide → v1.4.
  - Possible follow-ups: add real trainee email(s) as `demo`; hand-craft more
    varied demo jobs (currently tiled repeats); swap scenario/monthly stores too
    if a demo user should see demo data there (they read the board stores today).
- **Earlier (Jul 26, 2026) — deployed + committed:** three calendar changes.
  1. **Same-day card reordering ("resequence the day")** — on Production &
     Installation, drag a card up/down within its own day to set the order the
     person works them (top = first). Native-DnD drop resolves to a reorder when
     the dragged card is already on that person+day (`buildReorder` in
     `CalendarView.tsx`, blue insertion line); commits via new
     `store.resequenceDay` → `engine/cascade.ts` `diffResequence`. **Key design:**
     it does a SCOPED chain-pack of only the listed cards (NOT global
     `settleSchedule`) — the first version re-settled the whole board and shoved
     unrelated downstream jobs weeks out (the "fills the week / other job
     disappears" bug). No new Dataverse column (order rides on `startDateTime`).
     New `nextWorkStart` helper in `time-walker.ts` snaps a chained start to a
     real work slot. Tests: `engine/resequence.test.ts`.
  2. **Resize can now SHRINK and sticks** — a manual right-edge span (`spanDays`)
     is now authoritative in `computeRowCards` (was `Math.max(natural, span)`, so
     it could never go below the hours-derived length). `onSpan` stores the exact
     value incl. 1-day. Still visual-only; user adjusts hours separately.
  3. **Current-time line spans full board** — wrapped grid content in
     `.calendar-grid__inner` (content-sized positioned ancestor) so the overlay
     is full schedule height, not viewport height.
  Also: dragging a card (move/resize/reorder) now suppresses its hover preview
  (`suppressTooltip` on `JobCard`). Guide bumped to v1.3.
- **Last shipped (Jul 22, 2026):** Shipment "view all items" popup
  (`ShipmentItemsPanel`) — each load line is now its own **card** (job # +
  Delivery/Pickup badge, bold customer, description, labeled delivery/pickup
  location + notes) instead of run-together inline spans. New `.ship-item*` CSS.
  Verified live on the Olathe Load.
- **Earlier (Jul 22, 2026):** Job cards get a **left-edge drag handle** that
  changes the **start date** (mirrors the right-edge resize). Slides the card's
  start to another day (snapped to whole days, clamped within the visible week),
  keeping duration; commits via the existing `tryShiftWithConfirm` move path
  (cascade prompt included). New `startMoveLeft` + `movePreview` in
  `CalendarView.tsx`'s `GanttCard`; `.resize-handle--left` CSS already existed.
  Verified: new build renders with no regression. NOTE — couldn't auto-drive the
  7px handle drag through the cross-origin iframe; logic is a faithful mirror of
  the working right handle + reuses the proven move commit path.
- **Earlier (Jul 22, 2026):** Production stepper now shows on **job-card
  hover previews** (Production + Installation cards + group-card job pills),
  read-only. New `hooks/useJobSteps.ts` (shared completion+override stores,
  caches the per-job planning-line lookup); `JobTooltip` + `MemberDetailBody`
  render `<DepartmentStepper size="sm">`. Verified live on a production card.
- **Earlier (Jul 22, 2026):** Editable production stepper (feedback note).
  Any signed-in user can now complete a department: click node → yellow-orange
  glow → blue **Complete** button below (was Admin/Ops/Dev direct-toggle).
  Editors get **Edit** (add a missing dept/Install), red **Delete** (remove a
  node), and **Set active** (extra active depts → multiple active at once).
  Overrides persist per job in a new **`crfdf_jobdeptoverride`** table (`included`
  + `active`). New `services` fns + `store/job-dept-override-store.ts`;
  `production-steps.ts` applies overrides; `DepartmentStepper` gains a selected
  (glow) state; `ProductionStepperSection.tsx` rewritten. Deployed + committed.
  - ✅ **Table created + persistence confirmed live** (user ran
    `create-jobdeptoverride-table.ps1`; a Paint "Set active" override on J37329
    survived reload). Completions use `crfdf_jobdeptcompletion`; editor
    add/remove/active use `crfdf_jobdeptoverride`.
- **Earlier (Jul 21):** Shipping board polish (feedback notes) —
  (a) per-day **"+ Add load"** buttons are now solid red/white (were a faint
  dashed ghost); (b) shipping outlines (`.ship-col`, `.load-card`) use
  `--grid-line` instead of the near-invisible `--border` so columns read in light
  mode; (c) the toolbar row (Prev/Today/Next/Week of/Add Load) is
  vertically centered above the grid via `.calendar-toolbar--ship` (12px
  padding-top → balanced 12/12, matching Production/Install, which get their top
  gap from the WeekSummary the Shipping board lacks). All in
  `styles/lumineo.css` + `ShippingBoard.tsx`. Verified live.
- **Earlier (Jul 21):** Group-card interaction upgrades (from a
  handwritten feedback note; verified live):
  1. **Add-a-job task picking** — adding a BC job to a group no longer dumps all
     its planning lines. The tasks list as checkboxes (none pre-checked); the
     member stores only the chosen tasks + summed hours (`GroupCardBody.tsx`).
     Jobs with no BC lines still add whole.
  2. **Member pill = standard job card** — hover shows a job-card-style preview,
     click opens a detail popover (dept header, customer, tasks, hours) with
     *Open Project* + *Open SharePoint Folder* links. Shared `MemberDetailBody`
     in `JobCard.tsx`.
  - The note's "Whole Department / multi-select can't pick individual tasks" item
    is covered by the earlier Add-Job radio/checkbox fix (same panel/code path);
    single-select verified live, multi uses the identical handler.
- **Earlier (Jul 21):** Two live-app fixes found during the group-card
  create-then-reload click-test (both verified end-to-end on the deployed app):
  1. **Group cards vanished on reload** when placed on a busy person. They DID
     persist to Dataverse (row + `grp:v1:` payload intact — confirmed by direct
     query), but the cascade only treated `isLocked` as immovable, not
     `isCustom`. So `settleSchedule` on reload queued the container like a BC task
     and pushed it past the person's jobs, off the visible week. Fix: `isCustom`
     cards are now immovable in the cascade (`engine/cascade.ts`, +
     `settle.test.ts` regression). Verified: the test card now renders on reload.
  2. **Add Job → Single/Multi task list** had no visible selection affordance
     (only a ~9/255 background shade) → looked like all tasks were preselected.
     Added a radio (Single/Auto) / checkbox (Multi) marker + clear selected style
     (`components/AddJobPanel.tsx`). Verified: clicking a task fills its radio and
     enables Schedule.
  - Diagnostics used (kept in `scripts/`, device-code, read-only):
    `query-persist-test-card.ps1`, `query-emp-dept-map.ps1`,
    `check-desc-column-lengths.ps1`.
- **Earlier (Jul 21):** Group-card payload cap + member-add guard. Verified the
  `grp:v1:` JSON round-trips through both live sources (`crfdf_notes` on install
  cards, `crfdf_planninglinedescription` on production lines), both **Memo/2000**
  on the live org. Added `GROUP_PAYLOAD_LIMIT` + `groupPayloadFits()`
  (`services/group-card.ts`) + a guard in `GroupCardBody.tsx` refusing an
  overflowing member add.
- **Earlier (Jul 21):** Grouped job cards — an on-board container card holding a
  list of BC jobs as pills, with a title + optional description, auto-coloring to
  its department, and move/resize. Replaced the old Fill-in Jobs feature. Model: a
  custom ScheduleLine whose `planningLineDescription` holds a JSON payload behind
  the `grp:v1:` sentinel (`services/group-card.ts`); UI in `GroupCardBody.tsx` /
  `GroupPanel.tsx`, AddJobPanel "Group Card" kind, JobCard `isGroup` branch.
- **Earlier (Jul 20):** Automatic multi-day card un-stacking + content-hugging
  height (`useDayColumnWidth` / lane measurer in `CalendarView.tsx`).
- **Next:** _(nothing queued — ask the user what to pick up.)_

---

*Keep this file current when the deploy flow, paths, or app identity change.*
