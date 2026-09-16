# BCPush_JobCompletion — mark a BC job complete from the production stepper

> ✅ **This one is NOT blocked.** It's the first scheduler → BC write path that
> actually works. Infotech's Sep 11, 2026 update made `jobs` writable, and
> `job` is keyed on `no`, so `jobs('J32865')` addresses a single row directly.
> No resolve step, no composite key, no ETag problem.
>
> Its sibling `BCPush_PlanningSteps` (start/end/assignee per step) is **still
> blocked** — see `BCPush-infotech-request.md`.

## What it does

When the production stepper's **last** department is completed, the job is done.
The app drops an outbox row of `crfdf_kind = "job"`; this flow PATCHes the BC
job. Re-opening a completed department fires the inverse push.

```
stepper: last dept → Complete
   → crfdf_bcpushqueue row  { kind:"job", jobno:"J32865", complete:true,
                              enddatetime:<completion date>, status:"pending" }
   → this flow
   → PATCH …/companies({id})/jobs('J32865')
        { "complete": true, "icgSgpCompletionDate": "2026-09-14" }
   → row status → "synced"
```

## Fields written

| BC field | Source | Notes |
|---|---|---|
| `complete` | `crfdf_complete` | true when every included stepper step is done |
| `icgSgpCompletionDate` | `crfdf_enddatetime`, formatted `yyyy-MM-dd` | `0001-01-01` (BC's blank date) when re-opening |

**`status` is deliberately NOT written.** Flipping a BC job to `Completed` has
posting/billing consequences that belong to whoever runs BC, not to a board
click. If the team wants it, it's one more property in the `Patch_Job` body —
ask first.

## Why no Dataverse script is needed

`crfdf_kind` on `crfdf_bcpushqueue` is a plain string column, so the new `"job"`
kind reuses the existing outbox table as-is — same trick as the shipping
staging kanban's `kind: "shipping"`. `crfdf_complete` and `crfdf_enddatetime`
already exist. **Nothing to run.**

## Trigger scoping

The trigger fires when a row is **added, or when its `crfdf_status` changes**
(message 4 + `filteringattributes = crfdf_status`). Two reasons:

- **Retry:** set a `failed` row's Status back to `pending` and it re-runs.
- **Hand-made rows:** the maker-portal grid saves a new row as soon as the first
  cell is typed, so a create-only trigger saw it half-blank and skipped it forever
  (seen Sep 16, 2026). Editing Status afterwards now picks it up.

No loop: the flow's own `synced`/`failed` write re-fires it, but the
`status = "pending"` condition makes that run a no-op. Edits to any other
column don't fire it at all.

The flow shares the outbox table with `BCPush_PlanningSteps`, so its condition
is three-way: `status = "pending"` **and** `kind = "job"` **and** a non-empty
job no. The planning-step rows keep queuing untouched — if that flow is ever
unblocked, the two drain independently without racing.

## Deploy

Not a `pac code push` artifact — flows deploy separately.

**There is no unpacked solution kept in the repo.**
`_build_pushflow_solution.py` authors `Solution.xml` + `Customizations.xml` and
packs the zip; it is the source of truth, and it `rmtree`s its staging folder on
every run — so don't hand-edit the staged or unpacked copy, edit the script.

```powershell
# from flows/ — secret is injected into the STAGED copy only, never the repo
$env:BC_CLIENT_SECRET="<secret>"; python _build_pushflow_solution.py
```

Produces **`C:\Users\Alex\Downloads\BCPushReview_1_0_0_2.zip`** (outside the
repo, so a secret-bearing zip can't be committed) containing both push flows:

| Flow | Workflow GUID | State on import |
|---|---|---|
| `BCPush_PlanningSteps` | `0c5c184d-9e8c-4b0c-a781-56954c629083` | leave **OFF** — blocked |
| `BCPush_JobCompletion` | `30905c4a-f9b4-4424-91e6-b0046a3216b4` | turn **ON** |

Both are registered as `<Workflow>` elements in `Customizations.xml` and as
`<RootComponent type="29">` in `Solution.xml`, and share one
`new_sharedcommondataserviceforapps_bcpush` connection reference, which the
solution itself creates. (As of Sep 16, 2026 **nothing from this solution is in
the environment yet** — no flow, no connection reference.)

`BCPush_PlanningSteps` is listed in `IMPORT_OFF`, so it imports **switched off**;
`BCPush_JobCompletion` imports on. A flow imported ON would fire on every new
schedule/completion row and mark it failed.

Then:

1. Maker portal → **Solutions → Import solution** → the zip.
2. Map the connection reference to your Dataverse connection.
3. Confirm `Bc_ClientId` (pre-filled) and `Bc_ClientSecret`.
4. `Bc_ApiBase` defaults to **UAT**. Validate there first, then switch the host
   segment to production — see `BC-ENVIRONMENT-SWITCH.md`.
5. Turn on **only** `BCPush_JobCompletion`.

✅ **Write permission already confirmed (Sep 14, 2026)** — a PATCH to
`jobs('J25036')` from this app registration was accepted and persisted on
re-read. Nothing to request from Infotech for this flow.

### The secret

Three options, worst to best:

1. **Fill it in the flow editor after import.** Build without
   `BC_CLIENT_SECRET`; the parameter stays a placeholder. Nothing sensitive
   ever leaves the maker portal. Fine for a one-off.
2. **Inject at build time** (`$env:BC_CLIENT_SECRET=…`). Convenient for
   repeated imports, but the secret is then sitting in plaintext inside a zip
   in `Downloads` — delete it after importing.
3. **Key Vault option (preferred, not yet set up).** Replace the
   `Bc_ClientSecret` parameter with a **secret-type environment variable**
   backed by Key Vault, and read it in the flow before `Patch_Job`. This needs
   infrastructure that doesn't exist yet: a Key Vault holding the secret, the
   Dataverse service principal granted `get` on it, and an
   `<environmentvariabledefinition>` of type Secret added to the solution. The
   flow also gains a step, since `authentication.secret` needs a runtime value
   rather than a definition parameter. Worth doing before this goes to
   production; options 1–2 are fine for UAT validation.

## Verifying

`scripts/bc-job-status.ps1 -JobNo J25036` is **read-only**: prints a BC job's
`complete`, `icgSgpCompletionDate` and `status`. Run it before and after a test
push.

`scripts/bc-uat-write-proof.ps1` proves the PATCH path end to end against
`J25036` ("TEST OPPORTUNITY INFOTECH - do not use") and restores the value it
changed. Run it before turning the flow on.

After a real run, check the outbox row: `crfdf_status` should read `synced`,
and `crfdf_statusmessage` names the job and the flag it wrote. A failure writes
`failed` plus the HTTP status and the first 300 chars of BC's response.

## Known gaps

- **Job numbers with an apostrophe would break the URI.** BC job numbers are
  alphanumeric (`J32865`, `26200`) so this doesn't occur in practice; the flow
  doesn't OData-escape the key.
- **No de-dupe.** Completing, re-opening and re-completing a job enqueues three
  rows. They apply in order and converge on the right answer, so this is noise
  rather than a correctness problem.
- The push fires on the **transition** only — toggling an already-complete
  job's other departments doesn't re-push.
