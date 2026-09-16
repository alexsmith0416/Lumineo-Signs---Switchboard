# BCPush_PlanningSteps — write scheduler changes back to Business Central

> 🔴 **STILL BLOCKED — re-verified 2026-09-14** against live UAT `$metadata`
> after Infotech's Sep 11 collection update.
>
> The API is **no longer read-only across the board**: `jobs` and
> `projectPlanningLines` are now `Insertable/Updatable/Deletable = true`. But
> **the two entities this flow needs are unchanged** —
> `projectPlanningSteps` and `projectPlanningEntries` are still
> `Insertable=false / Updatable=false / Deletable=false`, and
> `projectPlanningLine` carries none of the fields we write (no `assignedTo`,
> no start/end, no `started`/`complete` — it's quantity/cost data).
>
> A keyed GET on a step also still fails with *"The supplied column ID '0'
> cannot be found in the query"*, and step rows have no ETag — so there is
> still no addressable single row for PATCH to target, and still no
> `<Action>`/`<Function>` in the container.
>
> **Do not turn this flow on.** Evidence + the narrowed ask are in
> `BCPush-infotech-request.md`; re-verify with
> `scripts/bc-uat-write-proof.ps1`. The app-side outbox is harmless to keep
> running (it only records intended pushes). `projectPlanningEntry` also uses a
> 7-part composite key, so its URI below is a placeholder pending the writable
> surface.

This is the **write-back half** of the BC integration. The existing `BCSync_*`
flows are read-only (BC → Dataverse). This flow is the only path that writes
**app → BC**, PATCHing the `sign365` `projectPlanningEntries` custom API when the
scheduler moves/resizes a job task or a department is marked started/complete.

## Why an outbox, not a direct call

The Lumineo Project Scheduler is a Power Apps **Code App** whose only connector
is Dataverse — it cannot call the BC API from the browser (CORS + no place to
hold BC's OAuth secret). So the app drops a **pending row** into the
`crfdf_bcpushqueue` outbox table (see `scripts/create-bcpushqueue-table.ps1`),
and this flow drains it. This keeps the write durable and retriable, and needs
zero new connector wiring in the Code App.

> Upgrade path for *inline* feedback: once this is proven, the same PATCH logic
> can be re-triggered by a **PowerApps (V2)** request trigger and added to the
> Code App as a data source (`pac code add-data-source`) so the app awaits a
> synced/failed response per commit. The outbox flow can stay as the durable
> fallback / catch-all.

## Trigger

**When a row is added** (Dataverse) → table `crfdf_bcpushqueue`
(`crfdf_bcpushqueues`), optionally filter `crfdf_status eq 'pending'`.

## Outbox row → BC field mapping

| Outbox column (`crfdf_…`) | Meaning | BC `projectPlanningEntries` field |
|---|---|---|
| `jobno` | BC project/job no | `projectNo` / `auxiliaryIndex4` (join) |
| `planningstep` | step description | `planningStepDescription` (join) |
| `deptkey` | app department id | (completion resolution only) |
| `startdatetime` | scheduled start | `startDateTime` |
| `enddatetime` | scheduled end | `endDateTime` |
| `assignedto` | BC resource no (resolved in-app) | `assignedTo` *(passed straight through)* |
| `assignedtoname` | display name | `assignedToName` |
| `complete` | dept complete flag | `complete` |
| `started` | on the board | (started flag, if the API exposes one) |
| `kind` | `schedule` \| `completion` | which fields to send |

## Steps

1. **Resolve the target entry.** GET the API filtered to the job + step:
   ```
   GET .../sign365/v1.0/companies({companyId})/projectPlanningEntries
       ?$filter=auxiliaryIndex4 eq '{jobno}' and planningStepDescription eq '{planningstep}'
   ```
   - `kind = "schedule"` → expect one entry; take its key (`auxiliaryIndex1` /
     `systemId`).
   - `kind = "completion"` with an empty `planningstep` → filter by job only and
     select every entry whose resource band maps to `deptkey`, then PATCH each.
2. **PATCH it** by systemId:
   ```
   PATCH .../projectPlanningEntries({systemId})
   If-Match: *
   { "startDateTime": …, "endDateTime": …, "assignedTo": …, "complete": … }
   ```
   Send only the fields relevant to `kind` (schedule → times + assignee;
   completion → `complete`).
3. **Assignee.** `crfdf_assignedto` already holds the BC resource no (the app
   resolves it from `crfdf_employee1.crfdf_no` at enqueue time), so the schedule
   PATCH passes it straight to `assignedTo` — no lookup needed. It's included in
   the body only when non-empty, so a team/unmapped line never clears BC's value.
4. **Write status back.** UPDATE the outbox row: `crfdf_status` = `synced` or
   `failed`, `crfdf_statusmessage` = the BC systemId (on success) or the error
   body (on failure). The app reads this to show a synced ✓ / failed ⚠ chip.

## Auth

Reuse the Postman app registration (the one already proven to PATCH the sign365
API in UAT). In Power Automate use an **HTTP with Microsoft Entra ID (preauthorized)**
action or a **custom connector** built from the API's metadata. Point at the
**UAT** company id `4738bfb5-a06d-ec11-bf27-000d3a132a9e` while testing; switch
to production when promoted.

## Open items before go-live

- Confirm the entry key really is `auxiliaryIndex1` (the GET in step 1 should
  round-trip it) and that PATCH accepts `startDateTime` / `endDateTime` /
  `assignedTo` / `complete` (per the Postman write test).
- Assignee resource no lives on `crfdf_employee1.crfdf_no` (run
  `scripts/add-employee-resourceno-column.ps1` to add + back-fill it from
  `crfdf_appuser`). Install-board employees (`crfdf_InstallationEmployees`) aren't
  cached yet, so install pushes send no assignee until they get a `crfdf_no` too.
- Granularity: one app department can map to several BC steps — decide whether a
  completion PATCHes the primary labor step or all matching steps.
