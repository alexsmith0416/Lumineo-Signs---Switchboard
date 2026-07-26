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

### ⚠️ Write-path invariant (avoid the "my edit didn't take, but worked the 2nd time" bug)

Stores update **optimistically** (change the UI now, persist in the background) and,
on a write failure, **reload the board** (`loadWeek()` / `load()`) to resync — which
**erases the optimistic edit**. So a *transient* Dataverse blip (network, throttle,
gateway, stale org URL) silently reverts the user's action; redoing it usually
works. To prevent this:

- **All user-edit writes go through the retrying helpers** in
  `services/dataverse-live.ts` — `dvUpdate` / `dvCreate` / `dvDelete` (they wrap the
  SDK call in `writeWithRetry`, which retries transient failures with backoff before
  bubbling up). **Do not** call `S.UpdateRecordWithOrganization` / `CreateRecord` /
  `DeleteRecord` directly for an edit path — a transient failure there will trigger a
  board reload that discards the edit.
- Keep the store's reload-on-failure as the *last-resort* resync only (after retries
  exhausted = a real error), never the first response to a blip.
- When adding a NEW editable action (input, date picker, drag/resize, toggle), route
  its persistence through `dv*` and confirm a simulated transient failure doesn't wipe
  the optimistic change.

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

- **In progress (Jul 22, 2026) — BC write-back (scheduler → Business Central):**
  building the path to push a job task's start/end + assignee + started/complete
  back to BC's Project Planning. **Client scaffold done & committed** (not
  deployed): `services/bc-planning-sync.ts` (pure builders + tests),
  `enqueueBcPush()` in `dataverse-live.ts` writes an **outbox** row
  (`crfdf_bcpushqueue`, table created live) on every commit; assignee resolves
  from `crfdf_employee1.crfdf_no` (add/back-fill via
  `scripts/add-employee-resourceno-column.ps1`). Flow scaffolded
  (`flows/BCPush_PlanningSteps-clientdata.json` + solution packager
  `_build_pushflow_solution.py` → `BCPushReview_1_0_0_1.zip`).
  🔴 **BLOCKED:** the `sign365 v1.0` BC API is **read-only** (all business
  entitysets `Updatable=false`) — can't PATCH. **Next:** infotechConsultingGroup
  must expose a writable endpoint (editable API page keyed on `systemId`, or a
  bound `updateSchedule` action) — email drafted in
  `flows/BCPush-infotech-request.md`. Don't turn the flow on until then; outbox
  is harmless to leave. Also: app not yet redeployed with the enqueue code.
- **Last shipped (Jul 26, 2026 · pm) — deployed + committed: Demo mode + interactive tutorial.**
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
