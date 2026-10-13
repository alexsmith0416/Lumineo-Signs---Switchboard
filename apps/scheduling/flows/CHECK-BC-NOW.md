# Check BC now — every BC pull on demand (Oct 12, 2026)

**What it does.** The Jobs list has a **Check BC now** button. One press asks
every BC pull to run right away instead of at its next scheduled time, and
lists each one's answer as it finishes:

| Line in the app | Flow | Scheduled (BCSync_Scheduler) | After it's done the app… |
|---|---|---|---|
| Shop-floor & install ticks | BCSync_TaskCompletions | every 5 min | applies the new ticks at once (Admin / Ops / Developer session; anyone else's → an open office session within 2 min), reloads statuses + steppers |
| New orders | BCSync_NewOrders | every 15 min | reloads the Jobs list |
| Descriptions | BCSync_JobDescriptions | hourly | re-reads them when a job panel opens |
| Purchase orders | BCSync_JobPOs | nightly 5:15 | re-reads the job panel POs + Warehouse |
| Sketches | BCSync_JobSketches | nightly 4:30 | reloads the Sketch column |

Install ticks are task completions too (install labor → the Install step), so
"Shop-floor & install ticks" covers both.

## How it works

- Table **`crfdf_syncrequest`** (`scripts/create-syncrequest-table.ps1`): one
  row per request — Kind, Status (Requested → Running → Done / Failed),
  Result, Requested By.
- Each flow fires when a row of its Kind is **added** (trigger filter
  `crfdf_kind eq '<kind>'`), **one run at a time**: a press during a
  scheduled run waits its turn, so nothing is copied twice. It writes Status /
  Result back (`_sync_request.py with_request`).
- **BCSync_Scheduler** (`_gen_sync_scheduler_flow.py`) runs every 5 minutes on
  the :00 / :05 marks and adds a row (Requested By = `Scheduler`) for each
  kind that's due (`SCHEDULE` in `_sync_request.py`, Central time). Each flow
  deletes its scheduler rows once done; failed ones stay in the table.
- The app (`store/bc-check-store.ts`, `services/sync-request.ts`) adds one row
  per kind, polls them every 3 s, and gives up on a request nobody picks up in
  5 minutes ("check that it's turned on"). Pressing again re-asks only the
  pulls that have finished.

## Build & import (one solution)

1. Once: `scripts/create-syncrequest-table.ps1` (done Oct 12).
2. From `flows/`: run the generators, then the build —
   `python _gen_neworders_flow.py` (and taskcompletions, jobdesc, jobpos,
   jobsketches, sync_scheduler), then `python _build_syncnow_solution.py` →
   `Downloads\BCCheckNow_1_0_0_1.zip` (solution **BCCheckNow**). The flows keep
   their workflow ids, so the import **updates** the existing flows.
3. Power Apps → Solutions → Import; bind the BC, Dataverse and SharePoint (Job
   Sketches) connection references to the existing connections.
4. The import puts the placeholder back in the four flows' BC client secret.
   Copy it back (never shown):
   `scripts/copy-bc-secret-to-flows.ps1 -Targets BCSync_NewOrders,BCSync_TaskCompletions,BCSync_JobDescriptions,BCSync_JobPOs`
   (it reads it from BCPush_PlanningSteps / BCPush_PoReceipts, which this
   import doesn't touch).
5. Make sure all five pulls are **On**, then turn **BCSync_Scheduler** On.
6. Deploy the app. Test: Jobs → **Check BC now**; within about a minute each
   line shows ✓ and its result.

⚠️ Until BCSync_Scheduler is On the pulls only run from the button — the old
timers are gone.
