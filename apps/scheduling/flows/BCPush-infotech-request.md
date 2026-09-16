# Request to infotechConsultingGroup — writable planning-STEP endpoint

**Status:** STILL BLOCKED, but the ask is now much smaller.
**Last verified:** Sep 14, 2026, against live UAT `$metadata` and the
`Sign365 API` collection Infotech sent on **Sep 11, 2026**
(`…/Postman/UAT/NEW 9.11.26/Sign365 API.postman_collection.json`).

Infotech's Sep 11 update **does** add write capability to the `sign365` API —
that's real progress and it retires the "the API is read-only, full stop"
finding from Jul 31. But it opened write on **`jobs`** and
**`projectPlanningLines`**, and neither of those carries the scheduling fields
we need. The two entities that do — `projectPlanningSteps` and
`projectPlanningEntries` — are **unchanged and still read-only**.

Re-verify any of this with `scripts/bc-uat-write-proof.ps1`.

---

## 1. What changed (good news)

Live UAT `$metadata` capability annotations, Sep 14 2026:

| Entity set | Insertable | Updatable | Deletable |
|---|---|---|---|
| `jobs` | **true** | **true** | **true** |
| `projectPlanningLines` | **true** | **true** | **true** |
| `projectPlanningSteps` | false | false | false |
| `projectPlanningEntries` | false | false | false |
| `tripsResources`, `jobTasks`, `projectDetails`, `jobLedgerEntries`, `jobCostAndSales`, `jobOutstandingPurchaseLines`, `jobReceivedNotInvoicedPurchaseLines`, `dimensionSetEntries`, `companies` | false | false | false |
| `subscriptions`, `externaleventsubscriptions` | true | true | true |

Two things this proves that we could not prove in July:

1. **Write can be switched on in this API.** It is not a platform limitation.
2. **A page can be re-keyed to a single-part key.** `projectPlanningLine` is
   now keyed on a single `no` rather than a composite — so the "composite key,
   no `SystemId`" shape of the step page is changeable too.

`jobs` in particular is now correctly addressable: its key is `no` (the job
number), and `GET …/jobs('J25036')` resolves a single row.

**✅ Write is confirmed working end to end (Sep 14, 2026).** A PATCH to
`jobs('J25036')` from our existing Entra app registration
(`34a4de23-4db0-48d9-a941-285c9c2f9b5d`, client-credentials OAuth) was accepted
and persisted on re-read:

```
PATCH …/jobs('J25036')   {"description":"WRITE-TEST 2026-09-14 20:54"}
→ accepted; re-read returns the new value.   (value restored afterwards)
```

So **no permission-set change is needed on our side** — the existing read
credentials already carry write. That removes one unknown from the ask below.

## 2. What still blocks us

**The fields we need live only on the step/entry entities, and both are still
read-only.**

`projectPlanningLine` — now writable — exposes only budget/cost data:

```
no, jobTaskNo, lineType, planningDate, plannedDeliveryDate, documentNo, type,
description, quantity, qtytoAssemble, unitCost, totalCost, unitPrice,
lineAmount, qtytoTransfertoJournal, invoicedAmountLCY, totalPrice, lineNo
```

No `assignedTo`. No start/end date-time. No `started` / `complete`.

The four things we write live here:

| Field | `projectPlanningStep` | `projectPlanningEntry` |
|---|---|---|
| start | `startDate` | `startDateTime` |
| end | `endDate` + `endTime` | `endDateTime` |
| assignee | `assignedTo` | `assignedTo` |
| started / done | `started`, `complete` | `complete` |

A PATCH against a step is refused outright (Sep 14, 2026):

```
PATCH …/projectPlanningSteps(auxiliaryIndex1=…,auxiliaryIndex2='39653.2',auxiliaryIndex3=…)

{ "error": { "code": "BadRequest_MethodNotImplemented",
  "message": "Entity does not support modifying data." } }
```

**Wall #2 is also unchanged.** A correctly-formed keyed GET against a real step
row still fails:

```
GET …/projectPlanningSteps(auxiliaryIndex1=851226ac-c820-4fe8-8588-097870ce9c5d,
                           auxiliaryIndex2='39653.2',
                           auxiliaryIndex3=851226ac-c820-4fe8-8588-097870ce9c5d)

{ "error": { "code": "Unknown",
  "message": "The supplied column ID '0' cannot be found in the query." } }
```

Step rows still carry no `@odata.etag`. The container still declares **no
`<Action>` and no `<Function>`**, so there is still no action-based route.

So: flipping `Editable = true` on the current step page remains insufficient on
its own — there is still no single addressable row for `PATCH` to target.

## 3. Three defects in the Sep 11 samples

Both new PATCH requests in the shipped collection fail as written. Worth
reporting back regardless of our project — especially #3.

**1. `Update Project` — wrong key type.** The sample URL is
`jobs(31ff7c4f-2817-f111-8405-7ced8dd80187)`. The `job` key is `no`, a string
job number, not a GUID. That URL returns:

```
{ "error": { "code": "BadRequest_NotFound",
  "message": "Bad Request - Error in query syntax." } }
```

The working form is `jobs('J25036')`.

**2. `Update Project` — field does not exist.** The sample body is
`{"orderedBy":"yipee"}`. The string `orderedBy` appears **zero times** in the
entire `sign365 v1.0` `$metadata`. BC agrees:

```
{ "error": { "code": "BadRequest",
  "message": "The property 'orderedBy' does not exist on type
              'Microsoft.NAV.job'." } }
```

**3. 🔴 `Update Project Planning Lines` — the key is not unique.** This one is
a data-integrity risk, not just a broken sample. The request PATCHes
`projectPlanningLines('26200')`. `projectPlanningLine` is keyed on `no`, but on
a planning line `no` is the **G/L account / resource number**, not a line
identifier. In UAT:

```
no      lineNo  jobTaskNo  description
41010    30000  1001       Replace Cabinet
41010    40000  1001       Replace Cabinet
26200    10000  1020       DOWN PAYMENTS
26200    10000  1020       DOWN PAYMENTS     <- same no AND same lineNo
```

**14,030 rows share `no = '26200'`.** The keyed GET does not error — it
silently returns the first match. So that PATCH writes to an arbitrary row out
of 14,030, non-deterministically, with no way for the caller to say which one it
meant. The set is now `Deletable = true` as well, so the same ambiguity applies
to DELETE.

Uniqueness needs project no + `jobTaskNo` + `lineNo` (or a `SystemId`).

## 4. What we need

Unchanged from July, and now narrower: **do for `projectPlanningSteps` what you
already did for `projectPlanningLines` — but with a key that is actually
unique.**

Update only. No inserts, no deletes. Four fields:

| Field | Purpose |
|---|---|
| start (date + time) | scheduled start we set on the board |
| end (date + time) | scheduled end |
| `assignedTo` | resource no. the step is scheduled to |
| `started` / `complete` | mark a step started or done |

Either shape works for us — `projectPlanningStep` (`startDate`/`endDate`/
`endTime`/`assignedTo`/`started`/`complete`) or `projectPlanningEntry`
(`startDateTime`/`endDateTime`/`assignedTo`/`complete`).

---

## Email draft

**Subject:** sign365 API — the Sep 11 write access is on the wrong two entities (+ a key bug worth a look)

**To:** [infotech BC contact]
**Cc:** [BC admin / PM]

Hi [Name],

Thanks for the updated collection on Sep 11 — the write access is a big step
and it clears the main thing we were stuck on. I've confirmed writes work end to
end: a PATCH to `jobs('J25036')` from our existing app registration was accepted
and persisted, so the credentials and permissions are all fine on our side.

Checking it against UAT `$metadata` on Sep 14, though, it doesn't quite reach our
case yet — and I found something in one of the samples I think you'll want to
know about regardless of us.

**1. The write access landed on `jobs` and `projectPlanningLines`, but we need
the planning *steps*.**

Our scheduler writes four things back: scheduled **start**, **end**, the
**assigned resource**, and **started/complete**. Those fields don't exist on
`projectPlanningLine` (it's quantity/cost/planningDate). They exist on
`projectPlanningStep` and `projectPlanningEntry` — and both of those are still
annotated `Insertable=false, Updatable=false, Deletable=false`. A PATCH against
a step returns *"Entity does not support modifying data."*

Could you extend the same treatment you gave `projectPlanningLines` to
`projectPlanningSteps`? Update-only is fine — we never insert or delete.

**2. The step rows still aren't individually addressable.**

Separately from the read-only flag: a correctly-formed keyed GET on a step
still returns

> The supplied column ID '0' cannot be found in the query.

and step rows carry no ETag. That's the same result we reported in July, and it
suggests the page is over a query/temp source rather than a persisted table — so
setting `Editable = true` alone probably won't be enough. A single stable
handle (a `SystemId`, or any unique key you'd prefer we address) would solve it.
There are also still no `<Action>`/`<Function>` definitions in the container, in
case an AL action is easier on your side than a writable page.

**3. 🔴 Worth checking independently of our project: the planning-line PATCH key
isn't unique.**

The `Update Project Planning Lines` sample PATCHes
`projectPlanningLines('26200')`. `projectPlanningLine` is keyed on `no`, but `no`
there is the G/L account / resource number — **14,030 rows in UAT share
`no = '26200'`**, including rows with an identical `lineNo`. The keyed GET
doesn't error; it silently returns the first match. So as it stands that PATCH
(and DELETE, now that the set is deletable) will hit an arbitrary row, and the
caller can't express which one it meant. Adding project no + `jobTaskNo` +
`lineNo` to the key — or exposing `SystemId` — would fix it.

**Two smaller things in the same request, so they don't trip anyone up:**
`Update Project` uses `jobs(31ff7c4f-…-7ced8dd80187)`, but the `job` key is the
job number string, so that URL returns *"Bad Request - Error in query syntax"* —
`jobs('J25036')` works. And its body sets `orderedBy`, which doesn't appear
anywhere in the `sign365 v1.0` metadata.

**Scoping notes, same as before:**

- We call this **service-to-service (client-credentials OAuth)** from Power
  Automate — same auth we already use to read, and as above it already has
  write, so **nothing is needed on the permission side**.
- **UAT first** (`luminousneon.com/UAT`) so we can validate, then promote.
- If a single-key handle is awkward on the underlying table, just tell us the
  intended key and we'll address rows that way — we only need *some* stable
  single-row handle.

Our side is finished and waiting: the scheduler already queues every change to
an outbox and the Power Automate flow that PATCHes BC is built — it's pointed at
nothing until one of the above exists. Happy to jump on a call. What would it
take, and rough timing?

Thanks,
[Your name]
[Title / company]
