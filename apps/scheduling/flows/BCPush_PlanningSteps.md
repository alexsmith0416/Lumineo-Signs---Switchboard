# BCPush_PlanningSteps — write the board's step schedule back to Business Central

> **Rewired Sep 28, 2026 — not yet imported or run end to end.** The sign365
> API route this flow used to target was a dead end (its planning entities are
> read-only and have no addressable row). It now writes to **our own** BC web
> service, `LumineoProjectPlanning` — page 58400 in the AL extension at
> `bc/lumineo-planning-ext`, over Infotech's per-job table
> `ICG.IPP.ProjectPlanning` (71441977). The page was proven in UAT with
> `scripts/bc-odata-planning-probe.ps1` (read) and
> `scripts/bc-odata-planning-write-test.ps1` (write + restore).

This is the **write-back half** of the BC integration. The `BCSync_*` flows are
read-only (BC → Dataverse); this flow and `BCPush_JobCompletion` are the only
paths that write **app → BC**.

## Why an outbox, not a direct call

The Code App's only connector is Dataverse — it can't call BC from the browser
(CORS, and nowhere to hold BC's OAuth secret). So the app drops a **pending**
row into `crfdf_bcpushqueue` and this flow drains it. Durable, retriable, and
no new connector in the Code App.

## What one outbox row means

One row = one **(job, BC catalogue step)**, not one card.

| Outbox column (`crfdf_…`) | Meaning |
|---|---|
| `kind` | `schedule` or `state` (`job` rows belong to `BCPush_JobCompletion`; `completion` is the retired pre-Sep-28 shape and is ignored) |
| `jobno` | BC job no → `Project_No` |
| `planningstep` | BC **catalogue step name** (`Fabrication`) → matched on `Step_Description` |
| `startdatetime` / `enddatetime` | the step's **whole** window, UTC: earliest start → latest end over every card of the job that maps to the step |
| `assignedto` | BC resource no — set only when every card on the step names the same person; blank = leave BC's assignee alone |
| `started` / `complete` | `state` pushes only — the step's whole Started/Complete, from the stepper |
| `deptkey`, `sourcelineid` | traceability |

The app computes the window at enqueue time by reading **all** of the job's
cards for that step from Dataverse (`pushProductionStep` / `pushInstallStep` in
`services/dataverse-live.ts`), on every card create, move, resize, reassign and
delete. So each row is the step's complete current state — idempotent, and a
later row always supersedes an earlier one. When the last card of a step is
deleted nothing is pushed: BC keeps its last dates rather than being cleared.

#### Started / Complete — the stepper is the source of truth (agreed Sep 28, 2026)

In BC, **Started means "listed in this department's queue"**: the department
tiles show steps that are Started and not Complete. It does not mean someone has
physically begun. So Started mirrors the production stepper's **active**
department(s), which can be several at once:

- Any stepper change — complete, re-open, Set active, editor add/remove —
  queues a `state` row for **every** BC step the stepper includes
  (`store/bc-stepper-push.ts`), because one click moves several steps
  (completing Metal Fab makes Paint active → Painting becomes Started).
- **Complete** = every included department mapped to the step is done
  (Fabrication waits for Steel AND Metal Fab). **Started** = complete, or any
  of its departments active. A department that stops being active without
  finishing is un-Started. `bcStepStates` in `bc-planning-sync.ts`.
- BC's own "Activate Next Step" doesn't win: every push restates all the
  job's mapped steps.
- Departments the stepper doesn't include are never touched.

## App department → BC step (agreed Sep 28, 2026)

| App department | BC catalogue step |
|---|---|
| Steel MFG, Metal Fab, Fabrication Help | Fabrication |
| Routing | Routing |
| Paint | Painting |
| Vinyl / Graphics | Vinyl |
| Assembly | Final Assembly |
| Install (install board) | Install |

`BC_STEP_FOR_KEY` / `bcStepForDepartmentName` in `services/bc-planning-sync.ts`.
BC's Assembly Wiring, Face Production, Final Inspection and Crating are never
written. Shipment-load cards on the install board don't count toward Install.

## Flow steps

1. **Trigger** — Dataverse row added/modified on `crfdf_bcpushqueue`
   (filtering on `crfdf_status`), concurrency 1. Acts only on
   `status = pending`, `kind ∈ {schedule, state}`, and a non-empty
   `planningstep`.
1b. **Skip stale rows** — if a NEWER row exists for the same job + step + kind
   (`createdon gt` this one), mark this one `superseded` and stop. Each row
   carries the step's whole current state, so only the newest matters — and the
   trigger does NOT deliver rows strictly in order (Sep 28: a quick
   reopen-then-complete on Routing landed complete-first).
2. **Get the job's rows** —
   `GET …/ODataV4/Company('Luminous Neon')/LumineoProjectPlanning?$filter=Project_No eq '<job>'`
   (a job has at most ~35).
3. **Match the step** by `Step_Description`. Step GUIDs (`Code`) differ per BC
   environment, so they're never stored or hardcoded — always resolved here.
4. **Build the body**
   - `schedule` → `{ Sched_Start, Sched_End }` (+ `Assigned_To` when set).
     **Never `Started`** — scheduling is not starting.
   - `state` → only the flags that **differ** from the BC row: `Started`,
     `Complete`, and on a re-open `Completed_Date: 0001-01-01T00:00:00Z` (ICG
     sets Completed Date on complete but never clears it; re-sending
     Complete=true would re-stamp it). Nothing differs → `already matches`. Completing needs a BC
     **User Setup** line for the flow's user (`POWERAPPS PERMISSIONS`), or ICG's
     validation fails; Completed By stays blank (that line has no resource).
     Completing a step with no start date makes ICG set the start to now.
5. **Row exists** → `PATCH …/LumineoProjectPlanning(Project_No='<job>',Code=<guid>)`
   with `If-Match: *`. The GUID literal is **unquoted**.
   **No row** → `POST …/LumineoProjectPlanning` with the body plus
   `Project_No` + `Step_Description`; the page looks the step up in the
   catalogue and copies Code / Planning Area / sort order / indentation.
   A re-open (`complete = false`) with no row is a no-op.
6. **Status** — `synced` + `updated <step>` / `created <step>`, or `failed` +
   BC's error message.

### Why `Sched_Start` / `Sched_End`, never the raw date fields

The BC table stores each moment twice: `<X> DateTime` in UTC and a Date + Time
pair in the **writer's session** time zone, converted by Infotech's validation.
This flow's service principal runs in UTC, so writing either raw side leaves the
pair 5–6 h off for people reading it in BC, and validating `Start DateTime`
flips `Started` to true. `Sched_*` set the UTC value, pin the pair to Central
wall-clock time (DST-aware), set `Duration`, and preserve Started/Complete. The
raw fields are read-only on the page.

## Auth

Same app registration as `BCPush_JobCompletion` (client credentials,
`https://api.businesscentral.dynamics.com/.default`). Its BC app card already
holds `ICG.PROJPLANNING.ADM`; the extension's `LUM PLANNING WB` permission set
is the narrower replacement (assign with Company = Luminous Neon).

## Before turning it on

1. Republish the extension (v1.0.0.3 adds create) and test a create on a job
   that lacks one of the mapped steps.
2. Retire the old backlog: `scripts/retire-bcpush-backlog.ps1` (dry run), then
   `-Apply`. Rows queued before the rewire use the old per-card, planning-line
   shape and must not be drained.
3. Deploy the app (the new enqueue code is live-only).
4. Build the solution (`_build_pushflow_solution.py`), import, map the
   connection reference, turn the flow on, and move one card on one job.
   Check the row in BC.

## Known limits

- Install crews (`crfdf_InstallationEmployees`) have no BC resource no column.
  Their short roster names ("Doug", "Justin F") are resolved against the
  app-user directory by first name + last initial (`resourceNoByName`). As of
  Sep 28, 18 of 25 roster rows resolve; unresolved: placeholders (Priority WIP
  Projects, Additional Jobs, Misc Jobs), people with no login (Richie, Jarrod L,
  Bryan), and "Danny" (logs in as Daniel Keller, 1100). Unresolved → no
  assignee sent.
- A card moved to a different job or department recomputes only its new step;
  the old one keeps its last window until something else touches it.
- No backfill: steps nobody edits after go-live keep whatever BC has.
