# Request to infotechConsultingGroup — writable planning endpoint

**Status:** BLOCKER. The `sign365 v1.0` custom API is **read-only** for all
business entities, so the app cannot PATCH scheduling changes into BC. This is
the email asking the extension author (infotechConsultingGroup) to expose a
writable surface. Until they do, the BCPush flow's PATCH has no valid target —
see the read-only note in `BCPush_PlanningSteps.md`.

Evidence (from `…/sign365/v1.0/$metadata`): every business `EntitySet`
(`projectPlanningSteps`, `projectPlanningEntries`, `jobs`, `jobTasks`,
`projectPlanningLines`, `tripsResources`, …) carries `Insertable=false`,
`Updatable=false`, `Deletable=false`. Only `subscriptions` /
`externaleventsubscriptions` are writable. `projectPlanningEntry` also uses a
7-part composite key (tripResourceTripCode, tripResourceResourceNo,
auxiliaryIndex1–5), unaddressable for a single-row write.

---

**Subject:** sign365 API — request for a *writable* endpoint to update Project Planning schedule/assignment

**To:** [infotech BC contact]
**Cc:** [BC admin / PM]

Hi [Name],

We're building an internal Project Scheduler that plans our production and
installation work, and it already **reads** from your `sign365` custom API in
Business Central. We now need to **write** a small set of scheduling updates from
the scheduler *back* into BC's Project Planning, and we've hit a wall we're
hoping you can help with.

**What we found**

Your API's business entities are exposed **read-only**. In the metadata at
`…/UAT/api/infotechConsultingGroup/sign365/v1.0/$metadata`, every business
`EntitySet` — including `projectPlanningSteps` and `projectPlanningEntries` —
carries:

```
Insertable = false
Updatable  = false
Deletable  = false
```

So a `PATCH` against them is rejected. The only writable sets are
`subscriptions` / `externaleventsubscriptions`.

**What we need to write**

Just four fields on a planning **step** (the per-step Project Planning list —
`projectPlanningStep`, which mirrors the "Project Planning" page: Started /
Complete / Assigned To / dates):

| Field | Purpose |
|---|---|
| `startDateTime` | scheduled start we set on the board |
| `endDateTime` | scheduled end |
| `assignedTo` | the resource the step is scheduled to |
| `complete` (and `started`) | mark a step done/started |

No inserts or deletes — update only.

**What would unblock us** (either works — whichever is cleaner on your side):

1. **A writable API page** for planning steps — `Editable = true`, keyed on a
   single `systemId`, exposing the four fields above; **or**
2. **A bound OData action**, e.g.
   `projectPlanningSteps({systemId})/Microsoft.NAV.updateSchedule` taking
   `{ startDateTime, endDateTime, assignedTo, complete }` and applying it in AL.
   (This is the pattern we'd expect for controlled writes — there are currently
   no `<Action>`/`<Function>` definitions in the API.)

A couple of specifics so you can scope it:

- We'll call it **service-to-service (client-credentials OAuth)** from Power
  Automate — the same auth we already use to read. Please let us know if a
  **permission set** needs to grant write access to our Entra app, and any
  object-permission changes required.
- Please stand it up in **UAT** (`luminousneon.com/UAT`) first so we can
  validate, then promote to production.
- If a single-key handle is a problem on the underlying table, let us know the
  intended key so we can address a specific step reliably (today
  `projectPlanningEntry` uses a 7-part composite key, which we can't target for a
  write).

Happy to jump on a quick call to walk through it. What would it take to add one
of the above, and rough timing?

Thanks,
[Your name]
[Title / company]
