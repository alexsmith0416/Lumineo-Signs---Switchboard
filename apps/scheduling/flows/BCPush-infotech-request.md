# Request to infotechConsultingGroup — writable planning endpoint

**Status:** BLOCKER — **confirmed against UAT metadata on Jul 31, 2026.** The
`sign365 v1.0` custom API is read-only for every business entity, so the app
cannot PATCH scheduling changes into BC. This is the email asking the extension
author to expose a writable surface. Until they do, the BCPush flow's PATCH has
no valid target — see the read-only note in `BCPush_PlanningSteps.md`.

Verified with the **Write-back (PATCH)** folder in the `Sign365 API (UAT)`
Postman collection (`…/Postman/UAT/Sign365 API - with PATCH.postman_collection.json`):
request `00 Preflight` reads `$metadata`, `02` attempts a keyed GET.

## Evidence (UAT, Jul 31 2026)

**1. Every business entity set is read-only.** From
`…/UAT/api/infotechConsultingGroup/sign365/v1.0/$metadata`, each set carries
`Org.OData.Capabilities.V1.*` annotations of:

```xml
<EntitySet Name="projectPlanningSteps" EntityType="Microsoft.NAV.projectPlanningStep">
  <Annotation Term="Org.OData.Capabilities.V1.DeleteRestrictions"><Record>
    <PropertyValue Property="Deletable" Bool="false"/></Record></Annotation>
  <Annotation Term="Org.OData.Capabilities.V1.InsertRestrictions"><Record>
    <PropertyValue Property="Insertable" Bool="false"/></Record></Annotation>
  <Annotation Term="Org.OData.Capabilities.V1.UpdateRestrictions"><Record>
    <PropertyValue Property="Updatable" Bool="false"/></Record></Annotation>
</EntitySet>
```

Same for `companies`, `jobs`, `jobTasks`, `jobLedgerEntries`, `jobCostAndSales`,
`jobOutstandingPurchaseLines`, `jobReceivedNotInvoicedPurchaseLines`,
`dimensionSetEntries`, `projectDetails`, `projectPlanningLines`,
`projectPlanningEntries`, `projectPlanningSteps`, `tripsResources`.

The **only** writable sets in the service are `subscriptions` and
`externaleventsubscriptions` (`Insertable`/`Updatable`/`Deletable` all `true`).

**2. There are no bound actions.** The `EntityContainer` declares only
`EntitySet` elements — no `<Action>` or `<Function>`. So there is no
`…/Microsoft.NAV.someAction` escape hatch today either.

**3. The rows have no addressable single-row handle.** `projectPlanningStep` is
keyed on a **3-part composite**, with no `SystemId` and no `@odata.etag` on the
returned rows:

```xml
<EntityType Name="projectPlanningStep">
  <Key>
    <PropertyRef Name="auxiliaryIndex1"/>   <!-- Edm.Guid            -->
    <PropertyRef Name="auxiliaryIndex2"/>   <!-- Edm.String, len 20  -->
    <PropertyRef Name="auxiliaryIndex3"/>   <!-- Edm.Guid            -->
  </Key>
```

Addressing a row by that key — the correct OData form, GUIDs bare and the string
quoted:

```
GET …/projectPlanningSteps(auxiliaryIndex1=851226ac-c820-4fe8-8588-097870ce9c5d,
                           auxiliaryIndex2='39653.2',
                           auxiliaryIndex3=851226ac-c820-4fe8-8588-097870ce9c5d)
```

returns:

```json
{ "error": { "code": "Unknown",
  "message": "The supplied column ID '0' cannot be found in the query." } }
```

**This is the important one.** It is not a 404 — the key parsed, and BC then
failed to fetch the row. That error is what BC returns when a keyed lookup is
attempted against a page whose source isn't a persisted, key-addressable table
(a query object, or a temporary source table populated in code). The rows exist
only as a computed list.

So flipping `Editable = true` on the current page would **not** be sufficient:
without an addressable single row there is nothing for `PATCH` to target. A new
API page over the real underlying table is needed.

`projectPlanningEntry` has the same problem in a worse form — a **7-part** key
(`tripResourceTripCode`, `tripResourceResourceNo`, `auxiliaryIndex1`–`5`).

**4. What we'd write.** For reference, `projectPlanningEntry` already exposes
almost exactly the field shape we want (`assignedTo`, `startDateTime`,
`endDateTime`, `dueDateTime`, `complete`, `projectNo`), while
`projectPlanningStep` splits them (`startDate`, `endDate`, `endTime`,
`assignedTo`, `started`, `complete`). Either shape works for us.

---

**Subject:** sign365 API — request for a *writable* endpoint to update Project Planning schedule/assignment

**To:** [infotech BC contact]
**Cc:** [BC admin / PM]

Hi [Name],

We're building an internal Project Scheduler that plans our production and
installation work, and it already **reads** from your `sign365` custom API in
Business Central. We now need to **write** a small set of scheduling updates from
the scheduler *back* into BC's Project Planning, and we've hit two walls we're
hoping you can help with.

**What we found**

We checked this against UAT
(`…/UAT/api/infotechConsultingGroup/sign365/v1.0/$metadata`) on 31 Jul 2026.

1. **Everything is read-only.** Every business `EntitySet` — including
   `projectPlanningSteps` and `projectPlanningEntries` — is annotated
   `Insertable=false`, `Updatable=false`, `Deletable=false`. The only writable
   sets in the whole service are `subscriptions` and
   `externaleventsubscriptions`. There are also no `<Action>`/`<Function>`
   definitions in the container, so there's no action-based route either.

2. **The rows can't be addressed individually.** `projectPlanningStep` is keyed
   on a three-part composite (`auxiliaryIndex1` GUID, `auxiliaryIndex2` string,
   `auxiliaryIndex3` GUID) with no `SystemId` and no ETag. When we request a
   single row by that key, BC returns:

   > The supplied column ID '0' cannot be found in the query.

   which suggests the page is backed by a query or a temporary source table
   rather than a persisted, key-addressable one. We mention it because it means
   simply setting `Editable = true` on the existing page probably won't be
   enough on its own.

**What we need to write**

Only four things, on the planning **step** (the per-step Project Planning list
that mirrors the "Project Planning" page). No inserts, no deletes — update only.

| Field | Purpose |
|---|---|
| start (date + time) | scheduled start we set on the board |
| end (date + time) | scheduled end |
| `assignedTo` | the resource the step is scheduled to (resource no.) |
| `started` / `complete` | mark a step started or done |

**What would unblock us** (whichever is cleaner on your side):

1. **A writable API page over the underlying table** — `Editable = true`, keyed
   on a single `SystemId`, exposing the four fields above; **or**
2. **A bound OData action**, e.g.
   `…/updateSchedule` taking
   `{ startDateTime, endDateTime, assignedTo, started, complete }` and applying
   it in AL — which also lets you keep validation on your side.

A couple of specifics so you can scope it:

- We'll call it **service-to-service (client-credentials OAuth)** from Power
  Automate — the same auth we already use to read. Please let us know if a
  **permission set** needs to grant write access to our Entra app
  (`34a4de23-4db0-48d9-a941-285c9c2f9b5d`), and any object-permission changes.
- Please stand it up in **UAT** (`luminousneon.com/UAT`) first so we can
  validate, then promote to production.
- If a single-key handle is awkward on the underlying table, tell us the
  intended key and we'll address rows that way — we just need *some* stable
  single-row handle.

We have the client side finished and waiting: the scheduler already queues each
change to an outbox, and a Power Automate flow is built to PATCH BC — it's
pointed at nothing until one of the above exists. Happy to jump on a quick call
to walk through it. What would it take, and rough timing?

Thanks,
[Your name]
[Title / company]
