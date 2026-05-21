# 10 — Crew & Truck Indicator Specification

A subtle visual badge on every job card that reads at a glance: **"2M 1T"** = 2 Men + 1 Truck, **"4M 2T"** = 4 Men + 2 Trucks. Sourced from the Estimate's Project Purchasing lines in Business Central (or a manual override on the Task).

Linear tracking: `Switchboard — Master Power Apps Shell` → *Phase 4* + `Platform Foundation` → *Phase 1a* (CrewAssignment table) + *Phase 1c* (bc_PurchaseLine virtual table)

---

## Visual

A tiny chip rendered before the weather chip on each Installation/Production job card.

```
┌─────────────────────────────────────────────────┐
│ J-2026-0142  Reynolds Storefront     2M  1T 🌤️68° │
│ 12300 SE Stark, Portland · 9:00 AM              │
└─────────────────────────────────────────────────┘
```

Variants:

```
2M 1T    →   2 men, 1 truck       (standard install)
4M 2T    →   4 men, 2 trucks      (large install)
1M       →   1 man, no truck      (survey, small job)
6M 3T 1C →   6 men, 3 trucks, 1 crane  (special equip)
```

Optional equipment codes (C = Crane, L = Lift, B = Bucket) extend the syntax without breaking the visual rhythm.

### Display rules

- Always rendered as a single inline chip with monospaced text
- Color-coded background by total crew size:
  - 1-2 people → green (light)
  - 3-4 people → blue
  - 5+ people → orange
- Tap → flyout showing the source breakdown (which BC PurchaseLine items resolved to what)

---

## Where it comes from

### Primary source — BC Project Purchasing lines

When Sales builds an Estimate, line items like "Crew — 2 men" or "Truck Rental — 1 day" land in the Project Purchasing module of Business Central. These are the items that flow into the job's planned cost.

Each Item in BC carries a custom field (or a UDF) categorizing it:

| BC Item field | Values | Used for |
|---|---|---|
| `lumCrewType` | `Person` \| `Truck` \| `Crane` \| `Lift` \| `Bucket` | tells the indicator what to count |
| `lumCrewMultiplier` | int (default 1) | "Crew x4" item counts as 4 people in one line |

### Resolution logic

```
For a given Job/Task:
    1. Find linked bc_SalesOrder → bc_Project
    2. List bc_PurchaseLine rows for that project where lumCrewType is set
    3. Sum lumCrewMultiplier × quantity, grouped by lumCrewType
    4. Render: "{sumPerson}M {sumTruck}T [{sumCrane}C ...]"
```

### Manual override — `CrewAssignment` table

For one-off changes ("the install was 3M 1T on paper but we sent a 4th person"), Ops can override the auto-calculated value via a Dataverse `CrewAssignment` row attached to the Task. If a manual row exists, it wins.

---

## Data model — `CrewAssignment`

```
CrewAssignment
├─ id (PK)
├─ taskId → Task
├─ persons (int)
├─ trucks (int)
├─ cranes (int, optional)
├─ lifts (int, optional)
├─ buckets (int, optional)
├─ source (Auto-BC | Manual)
├─ overrideReason (text — required if source=Manual)
├─ assignedPersons (collection → UserProfile, optional — who specifically)
├─ assignedTrucks (collection → fleet vehicle, optional)
├─ computedAt (datetime)
└─ updatedBy → UserProfile
```

A nightly Power Automate flow `RecomputeCrewAssignments` walks open Tasks, hits BC PurchaseLines, and refreshes the `Auto-BC` rows. Manual rows are untouched.

---

## Component — `lcl_CrewTruckBadge`

Input properties:
- `taskId` (string) — used to find the right CrewAssignment row
- `mode` ("compact" | "detail")

Behavior:
- Reads the matching `CrewAssignment` row
- Renders the compact chip per the visual rules above
- Tap → opens detail flyout showing:
  - The breakdown ("2 men + 1 truck")
  - Source (Auto from BC, or Manual + reason)
  - Optional assigned person/truck list
  - For Ops: "Edit" button to create/update a manual override

### Power Fx — render

```powerfx
With(
    { ca: LookUp('Crew Assignments', taskId = Self.taskId) },
    If(IsBlank(ca),
        "—",
        Concatenate(
            Text(ca.persons) & "M ",
            If(ca.trucks > 0, Text(ca.trucks) & "T ", ""),
            If(ca.cranes > 0, Text(ca.cranes) & "C ", ""),
            If(ca.lifts > 0, Text(ca.lifts) & "L ", ""),
            If(ca.buckets > 0, Text(ca.buckets) & "B ", "")
        )
    )
)
```

### Render examples

| persons | trucks | cranes | renders as |
|---|---|---|---|
| 2 | 1 | 0 | `2M 1T` |
| 4 | 2 | 0 | `4M 2T` |
| 1 | 0 | 0 | `1M` |
| 6 | 3 | 1 | `6M 3T 1C` |
| (no row) | — | — | `—` |

---

## Where it appears

| Surface | Notes |
|---|---|
| Installation home — today's route list | next to each install |
| Installation home — "My next install" card | larger detail chip |
| Production home — today's task list | shows crew planned for build (not just install) |
| Weekly Scheduler — every task card | core feature |
| Project Scheduler — task detail | full detail with override editor |
| Time & Photo — clock-in screen | "You + 1 more · 1 truck" — helps crew know who else should be here |
| Sales Hub — job preview from won opportunity | shows the resourcing the estimate planned |

---

## Edge cases

| Case | Behavior |
|---|---|
| BC PurchaseLine has no `lumCrewType` set | Item is ignored; show `—` if nothing else resolves |
| Manual override exists but BC also has data | Manual wins; show source = "Manual" in detail |
| Task spans multiple days | The badge represents the *peak* crew assigned, not daily total |
| Equipment without a person (just a truck) | Allowed; renders as e.g. `0M 1T` — useful for delivery-only |
| Resourcing changes mid-week | Manual override; flow re-runs nightly and doesn't clobber it |

---

## Sales Hub integration — the upstream story

Because the indicator reads BC PurchaseLines, the data exists from the moment Sales builds the estimate. As soon as the Estimate is converted to a Project (BC SalesOrder), the badge starts displaying with no extra work — exactly the workflow the user described as "I can nail that down during that app development."

The contract between Sales and Operations:

1. Sales is responsible for putting crew/truck/equipment line items on the Estimate
2. Operations sees those resourcing decisions live in Switchboard and the schedulers
3. If reality differs, Ops creates a manual override (logged with reason)
4. The override surfaces in Sales Hub on the original Opportunity so the next quote benefits from the learning

That feedback loop — *"the estimate said 2M 1T, the install actually took 3M 1T, sales should quote 3M next time"* — is the highest-value system effect of the whole indicator.
