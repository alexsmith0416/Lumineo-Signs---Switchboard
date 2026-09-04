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
  🔴 **BLOCKED — re-verified against UAT metadata Jul 31, 2026. Two walls, not one:**
  1. **Read-only.** Every business entityset in `sign365 v1.0` is annotated
     `Insertable/Updatable/Deletable = false`. Only `subscriptions` +
     `externaleventsubscriptions` are writable, and the container declares **no
     `<Action>`/`<Function>`**, so there's no action route either.
  2. **No addressable row (new finding).** `projectPlanningStep` is keyed on a
     3-part composite (`auxiliaryIndex1` Guid, `auxiliaryIndex2` String,
     `auxiliaryIndex3` Guid), no `systemId`, no `@odata.etag`. A correctly-formed
     keyed GET returns `"The supplied column ID '0' cannot be found in the
     query"` — the page is backed by a query/temp table, so **no single row
     exists for PATCH to target even if the read-only flag were flipped.**
     Flipping `Editable=true` on the current page would not be enough; they need
     an API page over the real table.
  **Next:** send the ask in `flows/BCPush-infotech-request.md` (rewritten Jul 31
  with the full evidence + both wall descriptions). Don't turn the flow on until
  then; outbox is harmless to leave. Also: app not yet redeployed with the
  enqueue code.
  **Postman:** the `Sign365 API (UAT)` collection now has a **Write-back (PATCH)**
  folder (`…/Postman/UAT/Sign365 API - with PATCH.postman_collection.json`) —
  preflight/metadata check, composite-key finder, and the 5 PATCHes ready to run
  the day it's unblocked.
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
  - **Open follow-ups:** staging cards can't be dragged back OFF a load into
    staging (one-way today); no BC auto-fill for a list (the dialog's "coming soon"
    field is still a placeholder, shared with the Job Queue).
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
