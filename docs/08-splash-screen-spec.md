# 08 — Splash Screen Specification

The splash screen is the first thing every user sees after sign-in and the most-viewed surface in the entire ecosystem. It needs to feel polished, surface live information, and route the user to the right place in under two seconds.

Linear tracking: `Switchboard — Master Power Apps Shell` → *Phase 1* + *Phase 3*

---

## Visual layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                          Alex Smith    │
│  │ LUMINEO  │                                          Operations 🔻  │
│  │  SIGNS   │                                                         │
│  └──────────┘                                                         │
│                                                                       │
│  ╔══════════════════════════════════════════════════════════════╗    │
│  ║                                                              ║    │
│  ║               ┌────┐ ┌────┐ ┌────┐                           ║    │
│  ║               │ 2  │ │ 4  │ │ 7  │   DAYS SINCE              ║    │
│  ║               │  3 │ │  6 │ │  2 │   LOST TIME               ║    │
│  ║               └────┘ └────┘ └────┘                           ║    │
│  ║                                                              ║    │
│  ║          Previous record: 412 days  •  Last reset 2025-04-03 ║    │
│  ╚══════════════════════════════════════════════════════════════╝    │
│                                                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ $84,200     │ │     17      │ │      3      │ │   142h      │    │
│  │ Revenue     │ │ Open Jobs   │ │ At Risk     │ │ Hours Today │    │
│  │ This Week   │ │             │ │             │ │             │    │
│  │ ▲ 12%       │ │ ▲ 2         │ │ ▲ 1         │ │ ▼ 6%        │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📣  Announcement — Quarterly safety meeting Friday 2 PM    │ ×  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Upcoming 🎂   Mike (Tue)  •  Sarah (Thu)  •  James (next Mon)       │
│                                                                       │
│  Apps  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│        │ Proj │ │ Week │ │ Sign │ │ Time │ │ Sales│                 │
│        │ Sched│ │ Sched│ │ Bldr │ │ Photo│ │ Hub  │                 │
│        └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                 │
│                                                                       │
│  ╭─── Recent Completions ─────────────────────────────────────╮      │
│  │  [photo] [photo] [photo] [photo] [photo] [photo] →         │      │
│  ╰────────────────────────────────────────────────────────────╯      │
└──────────────────────────────────────────────────────────────────────┘
```

The block sizes shift per role (Sales and Employees get fewer KPI cards, more role-specific content) but the **header**, **safety counter**, **announcement**, **birthdays**, **tiles**, **photo reel** are universal.

---

## Days Since Lost Time — detailed spec

A large, friendly safety counter rendered as a **flip-clock** style display. Three or four numeric tiles depending on the digit count.

### Behavior

- Reads from `SafetyMetric` Dataverse table — a single config row plus a history of incidents
- Auto-increments at 06:00 local time daily (Power Automate recurrence flow)
- When an incident is logged: counter resets to `0`, current streak archived as a `SafetyMetric.History` row
- "Previous record" subtitle shows the longest streak ever — gamifies the metric
- Tap the counter (Ops only) to open **Safety Incident Logger** flyout

### Data model — `SafetyMetric`

```
SafetyMetric
├─ id (PK, singleton row "current")
├─ currentStreakStartDate (date)
├─ longestStreakDays (int)
├─ longestStreakEndDate (date)
└─ updatedAt

SafetyIncident (history)
├─ id (PK)
├─ incidentDate (date)
├─ description (text)
├─ category (Lost-Time | Recordable | Near-Miss | First-Aid)
├─ employeeInvolved → UserProfile (optional)
├─ daysStreakAtIncident (int)
└─ loggedBy → UserProfile
```

> Only `Lost-Time` incidents reset the counter. `Recordable` / `Near-Miss` are logged but don't break the streak — they show in the Ops safety dashboard as separate counters.

### Power Fx — counter display

```powerfx
// Inside lcl_DaysCounter component, OnVisible:
Set(varDays,
    DateDiff(
        LookUp('Safety Metrics', id = "current").currentStreakStartDate,
        Today(),
        TimeUnit.Days
    )
);
Set(varDigits, Split(Text(varDays, "[$-en-US]000"), ""));
```

The three or four `lcl_DaysCounter` tiles are bound to `varDigits` items 1, 2, 3, (4). Each tile is a stack of two text blocks with a CSS-style flip animation triggered when `varDays` changes — clean visual feedback on the daily roll-over.

### Variant: 4-digit display when >999

The component auto-expands to a 4-digit layout when the streak exceeds 999 days. Bragging-rights territory.

### Push notification

When `varDays` hits **multiples of 30 or 100** the morning recompute flow sends a Teams message to the `Lumineo-Operations` channel: "🎉 30 days lost-time-free! Keep it up team."

---

## KPI Strip — detailed spec

Four cards by default (Operations), three for other roles. Each card is a `lcl_KpiCard` component instance bound to a row in the `KpiSnapshot` Dataverse table.

### Why a snapshot table, not live queries

If the splash queried Dataverse + BC virtual tables live every load, cold-starts would hit 5-10 seconds. Instead, a **nightly Power Automate flow** at 05:30 recomputes every KPI and writes the result to `KpiSnapshot` rows. Splash reads the precomputed rows in <100 ms. Real-time KPIs (like "Hours Today") use a separate 15-minute incremental flow.

### Data model — `KpiSnapshot`

```
KpiSnapshot
├─ id (PK)
├─ key (string, e.g. "revenue_this_week")
├─ audience (Operations | Sales | Production | Installation | Shipping | All)
├─ label (string, "Revenue This Week")
├─ value (decimal)
├─ valueFormat (currency | int | hours | percent)
├─ deltaValue (decimal — vs prior period)
├─ deltaDirection (up | down | flat)
├─ deltaIsGood (bool — green/red intent)
├─ sparkline (string — comma-separated values for mini-chart, last 7 points)
├─ computedAt (datetime)
└─ link (string — optional deep-link, e.g. "scrHomeOps?filter=at-risk")
```

### KPIs per role

| Role | KPI keys |
|---|---|
| **Operations** | `revenue_this_week`, `open_jobs`, `jobs_at_risk`, `hours_logged_today` |
| **Sales** | `my_open_opportunities`, `my_quota_pct`, `quotes_pending_response`, `won_this_month` |
| **Production** | `my_tasks_today`, `my_hours_this_week`, `tasks_complete_this_week`, `avg_cycle_time` |
| **Installation** | `my_next_install`, `installs_this_week`, `est_vs_actual_hours`, `tomorrow_weather` (special — text not number) |
| **Shipping** | `packages_out_today`, `packages_in_queue`, `late_shipments`, `value_shipped_this_week` |

### Card visual states

- **Default** — value, label, delta arrow + percent, soft sparkline behind
- **Pressed** — slight scale; on release `Launch()`s `link`
- **Stale data** — shows a small "🔄 stale" badge if `computedAt > 24h ago`
- **Error** — shows "—" with a tooltip "Could not load. Tap to retry."

### Power Fx — card binding

```powerfx
// lcl_KpiCard input properties:
//   kpiKey: string
//   role: string
//
// Inside the component:
With(
    { row: LookUp('Kpi Snapshots', key = Self.kpiKey, audience in [Self.role, "All"]) },
    Switch(row.valueFormat,
        "currency", "$" & Text(row.value, "[$-en-US]#,##0"),
        "hours",    Text(row.value, "[$-en-US]#,##0") & "h",
        "percent",  Text(row.value, "[$-en-US]0") & "%",
        Text(row.value, "[$-en-US]#,##0")
    )
)
```

---

## Universal widgets — recap

All defined in `Lumineo Canvas Component Library`:

| Component | Behavior |
|---|---|
| `lcl_Header` | Logo, user avatar, role badge, sign-out, "?" help, "switch role" (Ops-only) |
| `lcl_DaysCounter` | The 3-4 digit flip-clock from above |
| `lcl_KpiCard` | The bound-to-snapshot KPI tile |
| `lcl_AnnouncementCard` | Pinned banner, dismissible per-user (stored in localStorage via SaveData) |
| `lcl_BirthdayStrip` | Horizontal scroll, next 14 days, tap → Teams message composer |
| `lcl_PhotoCarousel` | Auto-rotates every 6 s; pulls `Photo` where `isShowcase = true AND takenAt > Today() - 30` |
| `lcl_EventCalendarStrip` | Horizontal scroll; tap → event detail flyout |
| App launcher tile grid | Filtered by role; tile state from `SystemConfig.<appKey>.enabled` |

---

## Performance budget

| Metric | Target |
|---|---|
| Time to splash interactive (Wi-Fi, cold) | < 2.0 s |
| Time to splash interactive (4G, cold) | < 3.5 s |
| Time to navigate to a tile target app | < 1.0 s |
| Number of Dataverse rows loaded on splash | < 50 (snapshot rows + 14d birthdays + 7d events + 12 photos + 3 announcements) |
| Number of round-trips | ≤ 3 (one `Concurrent(...)` batch on OnStart) |

### Power Fx — efficient OnStart

```powerfx
Concurrent(
    // 1. Auth & role
    Set(varUserEmail, User().Email);
    Set(varUserProfile, LookUp('User Profiles', email = varUserEmail));
    Set(varRole, varUserProfile.role);

    // 2. KPIs for this role
    ClearCollect(colKpis,
        Filter('Kpi Snapshots', audience in [varRole, "All"])
    );

    // 3. Safety + content
    Set(varSafety, LookUp('Safety Metrics', id = "current"));
    ClearCollect(colAnnouncements,
        Filter('Announcements',
            audience in [varRole, "All"]
            And publishAt <= Now()
            And (IsBlank(expireAt) Or expireAt > Now())
        )
    );
    ClearCollect(colBirthdays,
        Filter('User Profiles',
            active = true
            And DateDiff(Today(), Date(Year(Today()), Month(birthday), Day(birthday)), TimeUnit.Days) >= 0
            And DateDiff(Today(), Date(Year(Today()), Month(birthday), Day(birthday)), TimeUnit.Days) <= 14
        )
    );
    ClearCollect(colEvents,
        Filter('Events',
            startDate <= DateAdd(Today(), 21)
            And startDate >= Today()
        )
    );
    ClearCollect(colPhotos,
        FirstN(
            SortByColumns(
                Filter('Photos', isShowcase = true And takenAt > DateAdd(Today(), -30)),
                "takenAt", Descending
            ),
            12
        )
    );
)
```

The five collections load in parallel — total OnStart time is bounded by the slowest single query (typically the photo lookup at ~600 ms).
