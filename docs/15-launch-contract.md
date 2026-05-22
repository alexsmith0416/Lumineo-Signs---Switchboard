# 15 — Switchboard ↔ Sub-App Launch Contract

## Purpose

Switchboard launches every sub-app via `Launch()` with a small set of URL parameters plus a JSON `context` blob. This doc defines the **wire format** so each sub-app team can build against a stable contract without coordinating ad-hoc with the shell team.

> Scope: this doc covers app-to-app *launch* only. Cross-app deep-linking from Teams/email is treated as a special case of Switchboard launch (Switchboard receives the deep-link, resolves it, then `Launch()`s the sub-app).

## Design rules

1. **Canvas `Launch()` URL params are size-limited.** Browser URL length budget is conservatively ~2,000 chars across all params. Keep params small — IDs and short strings only. Large payloads belong in Dataverse, not the URL.
2. **`userEmail` is canonical.** Sub-apps read `Param("userEmail")` and never trust `User().Email` directly — Operations can launch a sub-app *as* another user for support (see Impersonation below).
3. **`context` is JSON-encoded text**, ≤1,500 chars after `EncodeUrl()`. Anything larger goes through `lum_LaunchContext` (see Large-context fallback).
4. **All sub-apps must boot cleanly with only the required params present.** Optional params are progressive enhancement.
5. **Schema is versioned.** Every `context` carries `schemaVersion: 1`; bump when adding required fields.

## URL parameter surface

These five params are the entire vocabulary. No sub-app may invent its own params; everything app-specific rides in `context`.

| Param | Type | Required | Notes |
|---|---|---|---|
| `userEmail` | string (UPN) | ✅ | The acting user. Canonical identity. |
| `role` | enum | ✅ | One of `Operations`, `Sales`, `Production`, `Installation`, `Shipping`. The user's *effective* role for this session. |
| `context` | string (URL-encoded JSON) | optional | App-specific launch payload — see per-app schemas below. |
| `contextRef` | string (GUID) | optional | When `context` exceeds the URL budget, Switchboard writes it to `lum_LaunchContext` and passes the row id here instead. |
| `returnTo` | string | optional | Where the sub-app should send the user on exit. Format: `switchboard://home` (default) or `switchboard://app/<appKey>?…` for chained launches. |

### Example launch URLs

```
# Minimal — Switchboard hands off to Project Scheduler with no context
https://apps.powerapps.com/play/.../ProjectScheduler?
  userEmail=alex@lumineo.com&
  role=Operations

# Deep-link — open a specific job
https://apps.powerapps.com/play/.../ProjectScheduler?
  userEmail=alex@lumineo.com&
  role=Operations&
  context=%7B%22schemaVersion%22%3A1%2C%22action%22%3A%22openJob%22%2C%22jobId%22%3A%22a3f...%22%7D

# Large context via contextRef
https://apps.powerapps.com/play/.../TimePhotoCapture?
  userEmail=alex@lumineo.com&
  role=Installation&
  contextRef=4f8b3c20-…
```

## The `context` envelope

Every `context` object follows the same outer shape:

```jsonc
{
  "schemaVersion": 1,
  "action": "<intent>",            // app-specific verb — see per-app schemas
  "...":   "<intent payload>"      // app-specific fields
}
```

`action` lets a sub-app branch its cold-boot logic; without it the sub-app shows its default landing screen (e.g. "My week" for Weekly Scheduler, "My day" for Time & Photo).

## Large-context fallback (`lum_LaunchContext`)

When `JSON(context)` would exceed ~1,500 chars URL-encoded, Switchboard writes the object to a Dataverse row and passes the row id as `contextRef`. The sub-app reads it back on cold-boot and the shell deletes the row (or lets a daily flow GC anything older than 24h).

```
lum_LaunchContext
├─ id (PK)
├─ createdBy → UserProfile
├─ targetApp (string — e.g. "ProjectScheduler")
├─ payload (json, ≤32 KB)
├─ createdAt (datetime)
└─ consumedAt (datetime, nullable — set by sub-app after read)
```

Cold-boot pseudocode the sub-app runs:

```powerfx
// Sub-app OnStart
Set(gblUserEmail, Param("userEmail"));
Set(gblRole, Param("role"));
Set(gblReturnTo, Coalesce(Param("returnTo"), "switchboard://home"));

If(
  !IsBlank(Param("contextRef")),
    Set(gblCtx,
      ParseJSON(
        LookUp('lum_LaunchContext', id = Param("contextRef")).payload
      )
    );
    Patch('lum_LaunchContext',
      LookUp('lum_LaunchContext', id = Param("contextRef")),
      { consumedAt: Now() }
    ),
  !IsBlank(Param("context")),
    Set(gblCtx, ParseJSON(Param("context"))),
  Set(gblCtx, Blank())
);
```

## Impersonation

Operations role can launch a sub-app **as** another user (for example, to reproduce a bug). Switchboard signals this by setting `context.impersonatedBy`:

```jsonc
{
  "schemaVersion": 1,
  "action": "openTask",
  "taskId": "...",
  "impersonatedBy": "ops-admin@lumineo.com"   // present only when active
}
```

- `userEmail` carries the *impersonated* user (whose data the sub-app should show).
- `context.impersonatedBy` carries the *real* logged-in user (for audit).
- Sub-apps must display an "Impersonating <name>" banner whenever `impersonatedBy` is set, and write audit rows (`TimeEntry`, `Photo`, etc.) with `createdBy = impersonatedBy` even though the data filter uses `userEmail`.

## Return path

`returnTo` is the URI the sub-app navigates to on user exit (back button, X, "done"). Three forms:

| Form | Meaning |
|---|---|
| `switchboard://home` | Return to the user's role home screen (default). |
| `switchboard://app/<appKey>?context=...` | Chain to another sub-app (e.g. Project Scheduler → Sign Builder Pro for a spec edit, then back here). |
| absolute https URL | External handoff (rare — Teams deep link, customer portal). |

Sub-apps implement return as:

```powerfx
// On user exit
Launch(gblReturnTo)
```

Switchboard's `OnStart` parses incoming `switchboard://` URIs and renders the appropriate screen.

---

## Per-sub-app `context` schemas

Each sub-app defines the **`action`** values it understands and the fields each action carries. Anything not listed here is unsupported — the sub-app should ignore unknown actions and land on its default screen.

### Project Scheduler

| `action` | Required | Optional | Cold-boot behavior |
|---|---|---|---|
| _(none)_ | — | — | Land on Job list, filtered to "Open" |
| `openJob` | `jobId` | `tab` (`overview`\|`tasks`\|`specs`\|`files`\|`bc`) | Open Job detail, selected tab |
| `newJob` | — | `fromOpportunityId` | Open New Job wizard, prefill if opp supplied |
| `openCalendar` | — | `weekStart` (ISO date) | Calendar/Gantt view, scrolled to weekStart |

### Weekly Scheduler

| `action` | Required | Optional | Cold-boot behavior |
|---|---|---|---|
| _(none)_ | — | — | Employees: My week. Ops/Sales: Dept view (default = Production) |
| `openWeek` | — | `weekStart`, `deptFilter` | Week view scrolled to weekStart, filtered to deptFilter |
| `openTask` | `taskId` | — | Open task detail flyout |
| `assignTask` | `taskId`, `assignTo` (userEmail) | — | Open task with assignment dialog primed |

`deptFilter` values: `Production`, `Installation`, `Shipping`, `All`. For Employees, the shell forces `deptFilter` to their dept regardless of any supplied value.

### Sign Builder Pro

| `action` | Required | Optional | Cold-boot behavior |
|---|---|---|---|
| _(none)_ | — | — | Spec list, filtered to "My in-progress" |
| `openSpec` | `specId` | `mode` (`view`\|`edit`\|`approve`) | Open Builder PCF at that spec |
| `newSpec` | — | `jobId` or `opportunityId` | Open Builder PCF, fresh spec linked to jobId/opp |
| `approveQueue` | — | — | Ops-only: list of specs awaiting approval |

### Time & Photo Capture

| `action` | Required | Optional | Cold-boot behavior |
|---|---|---|---|
| _(none)_ | — | — | My day screen |
| `clockIn` | `taskId` | — | Open clock-in confirmation primed for that task |
| `capturePhoto` | — | `relatedTo`, `relatedId` | Open camera, pre-link the resulting Photo |
| `opsView` | — | `userFilter` (email), `dateFilter` (ISO date) | Ops-only admin timeline |

Optional context hint specific to T&P:

```jsonc
{
  "schemaVersion": 1,
  "todaysTaskIds": ["a3f...", "b1e..."]   // pre-warm the My day cache
}
```

The sub-app may use `todaysTaskIds` to render the My day screen instantly without a Dataverse roundtrip; if absent, it queries `Task` on cold-boot.

### Sales Hub (Model-Driven)

Model-driven apps accept a different URL shape (`?pagetype=entityrecord&etn=…&id=…`), so Switchboard translates the launch contract into MDA URL params:

| `action` | Translation |
|---|---|
| _(none)_ | Home dashboard |
| `openCustomer` (requires `customerId`) | `?pagetype=entityrecord&etn=account&id=<customerId>` |
| `openOpportunity` (requires `opportunityId`) | `?pagetype=entityrecord&etn=lum_opportunity&id=<opportunityId>` |
| `newOpportunity` (optional `customerId`) | `?pagetype=entityrecord&etn=lum_opportunity&data=...` |

`userEmail`, `role`, and `returnTo` are still passed but Sales Hub primarily uses the MDA session for identity. Sub-app reads `Param("returnTo")` from inside an embedded PCF to wire its back button.

---

## Default `context` values per role

Switchboard fills these in by default when the user taps a tile (versus a deep link). The user can override by tapping a specific Job/Task/Spot first.

| Tile tapped | Role | Default `context` |
|---|---|---|
| Project Scheduler | Operations | `{ action: "openCalendar", weekStart: <Monday of this week> }` |
| Weekly Scheduler | Production / Installation / Shipping | `{ action: "openWeek", weekStart: <Monday>, deptFilter: <role> }` |
| Weekly Scheduler | Operations | `{ action: "openWeek", weekStart: <Monday> }` |
| Sign Builder Pro | Sales | `{ action: "approveQueue" }` (only if any awaiting; else default) |
| Time & Photo | Production / Installation | `{ todaysTaskIds: <today's task ids for this user> }` |
| Sales Hub | Sales | _(none — MDA home dashboard)_ |

## Validation

Switchboard validates before calling `Launch()`. If validation fails, surface an inline error on the tile and don't navigate:

1. `userEmail` is a valid UPN format (`<local>@<domain>`)
2. `role` is one of the five enum values
3. Encoded `context` ≤1,500 chars; otherwise route via `contextRef`
4. `action` (if present) is one this app supports; otherwise drop the entire `context` and launch with default
5. Required fields for that `action` are non-empty

Sub-apps re-validate on cold-boot and ignore malformed context (falling back to default screen).

## Audit & telemetry

Every launch writes one row to `lum_LaunchLog`:

```
lum_LaunchLog
├─ id (PK)
├─ userEmail (string)
├─ impersonatedBy (string, nullable)
├─ role (string)
├─ targetApp (string)
├─ action (string, nullable)
├─ contextSize (int — chars)
├─ usedContextRef (bool)
├─ launchedAt (datetime)
└─ source (string — "tile" | "deep-link" | "chain" | "notification")
```

A daily Power Automate flow rolls these up into `KpiSnapshot` rows so Ops can see most-used tiles per role.

## Schema versioning

`schemaVersion` lives at the top of `context`. Bump rules:

- **No version bump** for adding a new optional field that defaults gracefully when absent.
- **No version bump** for adding a new `action` value (sub-apps already ignore unknown actions).
- **Bump to v2** when changing the *meaning* of an existing field, removing a field, or changing the envelope shape.

When a sub-app sees an unknown `schemaVersion`, it logs and falls back to its default screen.

## Implementation references

### Switchboard side — building a launch

```powerfx
// Helper component: lncLaunchSubApp
With(
  {
    ctxJson: JSON({
      schemaVersion: 1,
      action: "openJob",
      jobId: ThisItem.id
    }),
    base: LookUp(SubAppRegistry, appKey = "ProjectScheduler").url
  },
  If(
    Len(EncodeUrl(ctxJson)) > 1500,
      With(
        { ref: Patch('lum_LaunchContext', Defaults('lum_LaunchContext'),
              { targetApp: "ProjectScheduler", payload: ctxJson, createdBy: gblUser.id })
        },
        Launch(base, {
          userEmail: gblUser.email,
          role: gblUser.role,
          contextRef: ref.id,
          returnTo: "switchboard://home"
        })
      ),
      Launch(base, {
        userEmail: gblUser.email,
        role: gblUser.role,
        context: ctxJson,
        returnTo: "switchboard://home"
      })
  )
);
```

### Sub-app side — cold-boot parse

Already shown above under [Large-context fallback](#large-context-fallback-lum_launchcontext). Every Canvas sub-app's `App.OnStart` runs that block.

### PCF controls

When a sub-app hosts a PCF (Weekly Scheduler, Sign Builder Pro), the canvas wrapper passes the parsed context down to the PCF as input properties:

```typescript
// PCF manifest declares these inputs (already in doc 07)
// userEmail: SingleLine.Text
// role: SingleLine.Text
// action: SingleLine.Text
// contextJson: Multiple   // entire context blob, PCF parses
```

The PCF re-parses `contextJson` on `updateView` and branches on `action`.

## Open questions

These should be confirmed once one sub-app actually ships its launch handler:

1. **Tab persistence across return** — when user goes Switchboard → ProjectScheduler.openJob → Sign Builder Pro → returns, should we land back on the *same job tab* they left? Likely yes — add `returnContext` round-tripping.
2. **Mobile deep-link prefix** — does Power Apps mobile honor a custom `switchboard://` URI, or do we need https URLs throughout? Verify on iOS + Android during the Platform foundation phase.
3. **Notification-originated launches** — push notifications (birthday, job assigned) need to land in a sub-app at the right record. Confirm the notification payload carries the same `context` shape so the click-through is a straight `Launch()`.
