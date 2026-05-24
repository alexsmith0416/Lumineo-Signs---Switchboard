# Lumineo Signs — Switchboard Platform Dev Bible

> Read this file before writing a single line of code. Every rule here exists for a reason.

---

## Current Build Mode — Open Access + Airtable

**Until further notice, these temporary rules apply:**

| Concern | Temporary approach | Future state |
|---|---|---|
| Access control | All authenticated users see all screens — no role filtering | Entra security groups + role routing |
| Job data | Read from Airtable via `AirtableMirror_Sync` flow → Dataverse | BC virtual tables + BC API write-back |
| BC writes | Queue in `lum_PendingBCWrites`, process manually | Automated via BC API when access granted |
| Entra groups | Not configured — deferred | 5 `Lumineo-*` security groups |

Do not build role-based routing or group membership checks until the Entra groups task is explicitly reopened.

---

## App Inventory

| App | Type | Linear Project | Status |
|-----|------|---------------|--------|
| Platform Foundation | Dataverse + flows + component lib | ab485dc7 | Scripts ready — run next |
| Switchboard | Canvas Power App (shell) | 9f38c4d4 | Not started |
| LNI Production Schedule | Code App (React+Vite+TS) | 53e5d207 | Flows + deploy remaining |
| Sign Builder Pro | Canvas Power App | ea529bb1 | 22/23 In Review — QA + deploy |
| Sales Hub | Canvas Power App | 93a928be | Not started |
| Time & Photo Capture | Canvas Power App | 313875c7 | Not started |
| Lumineo Scheduling Hub | Code App (React+Vite+TS) | 973724df | Not started |

**Linear workspace:** linear.app/lumineosigns · Team key: ALE

---

## Build Order (strict dependency chain — do not skip)

```
1. Platform Foundation   ← BLOCKS EVERYTHING
2. Switchboard shell
3. LNI Production Schedule  ← foundation tables done; flows + deploy remaining
4. Sign Builder Pro          ← canvas done; QA + PAC push remaining
5. Sales Hub
6. Time & Photo Capture
7. Lumineo Scheduling Hub
```

---

## Publisher — NEVER CHANGE

```
Publisher display name : Lumineo
Publisher prefix       : lum_
Option value prefix    : 10000
Solution name          : LumineoFoundation
```

The `lum_` prefix is permanent. Every Dataverse table, column, choice, and relationship must use it. Changing it after tables have data is catastrophic.

---

## Universal UI Design Tokens

### TypeScript / CSS

```ts
export const tokens = {
  navyPrimary:  '#141464',
  navyLight:    '#2a2a8a',
  redAccent:    '#E8151B',
  navyBg:       '#e8eaf5',
  gray50:       '#f7f8fa',
  fontFamily:   "'Open Sans', sans-serif",
  fontWeightRegular: 400,
  fontWeightMedium:  500,
  fontWeightSemibold: 600,
  fontWeightBold:    700,
};
```

### Power Fx / Canvas

```
// Color constants (define in App.OnStart or as named formulas)
Set(colNavyPrimary,  RGBA(20,20,100,1));
Set(colNavyLight,    RGBA(42,42,138,1));
Set(colRedAccent,    RGBA(232,21,27,1));
Set(colNavyBg,       RGBA(232,234,245,1));
Set(colGray50,       RGBA(247,248,250,1));
Set(colWhite,        RGBA(255,255,255,1));
```

Navbar wordmark: 15px / weight 800 / white / 0.12em letter-spacing
All fonts: Google Fonts Open Sans (400/500/600/700)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Switchboard (Canvas App)            │
│  Splash → Login → Home Screen (single, no roles) │
│  App Launcher → Launch(subAppUrl, {userEmail})   │
└──────┬──────────┬──────────┬────────────────────┘
       │          │          │
  Canvas Apps   Code Apps  Canvas Apps
  Sales Hub     LNI Prod   Sign Builder Pro
  Time+Photo    Sched Hub
       │
       └── All share: Dataverse (lum_ tables) + Airtable sync
```

**Access model (temporary):** All users authenticated via Microsoft 365 see all screens. No Entra group checks.

**Sub-app launch pattern:**
```
Launch(varSalesHubUrl, {userEmail: varCurrentUser.Email})
```

**Sub-app receive pattern:**
```
Set(varUserEmail, Param("userEmail"));
```

---

## Data Sources

### Job data — Airtable (temporary primary source)

Job data flows: **Airtable → `AirtableMirror_Sync` PA flow (every 15 min) → Dataverse `lum_Job` table**

- Read `lum_job` in all apps — never query Airtable directly from canvas
- The sync flow keeps Dataverse current; canvas apps only touch Dataverse
- New jobs created in apps write to `lum_job`; a separate outbound flow syncs back to Airtable

### Business Central (future)

- BC virtual tables (bc_Customer, bc_Item, bc_SalesOrder, etc.) will be available read-only once configured
- Writes queue in `lum_pendingbcwrites` until BC API admin access is granted
- Do not block any feature on BC API access

---

## Dataverse Tables (all `lum_` prefix)

| Logical Name | Display Name | Key Purpose |
|---|---|---|
| lum_userprofile | User Profile | Microsoft 365 user record (no role routing yet) |
| lum_job | Job | Core job record — populated by Airtable sync |
| lum_task | Task | Job subtasks |
| lum_timeentry | Time Entry | Clock-in/out records |
| lum_photo | Photo | Job site photos (Dataverse File column, ≤128 MB) |
| lum_signspec | Sign Spec | Sign specifications for Sign Builder Pro |
| lum_opportunity | Opportunity | Sales opportunities |
| lum_announcement | Announcement | Home screen announcements |
| lum_event | Event | Calendar events |
| lum_safetymetric | Safety Metric | Daily safety KPIs |
| lum_safetyincident | Safety Incident | Incident reports |
| lum_kpisnapshot | KPI Snapshot | Nightly precomputed KPIs (NEVER query live on splash) |
| lum_crewassignment | Crew Assignment | Crew-to-job assignments |
| lum_weathercache | Weather Cache | Cached weather data (refresh ≤15 min) |
| lum_systemconfig | System Config | Key-value config store |
| lum_pendingbcwrites | Pending BC Writes | Queued writes to Business Central |
| lum_synclog | Sync Log | Airtable/BC sync audit log |
| lum_spotlight | Spotlight | Employee spotlight cards |
| lum_suggestion | Suggestion | Employee suggestion box |

**BC Virtual Tables (future — read-only, never copy data):**
bc_Customer, bc_Item, bc_SalesOrder, bc_SalesOrderLine, bc_Vendor, bc_Inventory

---

## Canvas Component Library (10 controls — prefix `lcl_`)

| Control | Purpose |
|---|---|
| lcl_Header | App header bar with wordmark and user avatar |
| lcl_NavRail | Left navigation rail |
| lcl_KpiCard | KPI metric card |
| lcl_DaysCounter | Flip-clock safety days counter |
| lcl_AnnouncementCard | Announcement display card |
| lcl_BirthdayStrip | Employee birthday strip |
| lcl_PhotoCarousel | Photo carousel |
| lcl_WeatherChip | Weather chip widget |
| lcl_CrewTruckBadge | Crew/truck assignment badge |
| lcl_EventCalendarStrip | Event calendar strip |

---

## Power Fx Patterns

### OnStart — max 3 round-trips, all parallel
```
Concurrent(
    Set(varCurrentUser, LookUp(lum_userprofiles, AzureADObjectId = User().ObjectId)),
    Set(varTodayKpis,   LookUp(lum_kpisnapshots, DateValue = Today())),
    Set(varAnnouncements, Filter(lum_announcements, IsActive = true))
);
```

### No role routing (temporary — single home screen for all users)
```
// After OnStart, navigate directly — no Switch() on role
Navigate(HomeScreen, ScreenTransition.None)
```

---

## PAC CLI Patterns

```powershell
# Auth
pac auth create --url https://<env>.crm.dynamics.com

# Push canvas app source
pac canvas pack --msapp output.msapp --sources ./src/canvas/SalesHub
pac canvas push --msapp output.msapp

# Solution import (managed)
pac solution import --path LumineoFoundation_managed.zip --activate-plugins

# Code app
pac code-app init --name LNIProductionSchedule --directory ./src/code-apps/lni-prod
pac code-app push --name LNIProductionSchedule
```

---

## Repo Structure

```
/
├── CLAUDE.md                        ← YOU ARE HERE
├── platform-foundation/
│   ├── README.md                    ← Phase 0-1 setup guide
│   ├── solution/
│   │   ├── solution.xml
│   │   └── [Content_Types].xml
│   └── scripts/
│       ├── 01-setup.ps1             ← Verify publisher + solution
│       └── 02-create-tables.ps1    ← Create all 19 Dataverse tables
├── switchboard/
├── sales-hub/
├── lni-production-schedule/
├── sign-builder-pro/
├── time-photo-capture/
├── scheduling-hub/
├── docs/                            ← 14 design docs (existing)
└── prototype/                       ← React prototype (existing)
```

---

## Performance Rules — DO NOT VIOLATE

1. **Splash screen** must be interactive in <2 seconds on Wi-Fi
2. **Max 3 Dataverse round-trips** on OnStart — use `Concurrent()`
3. **Never query BC tables live on splash** — read `lum_KpiSnapshot` only
4. **KPI recompute** runs nightly at 05:30 via Power Automate — never on-demand from UI
5. **Weather cache** refreshes ≤15 min via flow, not on every screen load

---

## Do / Don't

| Do | Don't |
|---|---|
| Use `lum_` prefix on ALL custom schema | Use any other prefix |
| Load KPIs from `lum_KpiSnapshot` | Query live BC/Dataverse on splash |
| Use `Concurrent()` on OnStart | Chain sequential Set() calls |
| Pass user email via `Launch()` params | Re-authenticate in sub-apps |
| Use `lcl_` component library controls | Duplicate UI components per app |
| Write BC data via `lum_PendingBCWrites` | Call BC API directly from canvas |
| Read job data from `lum_job` (Airtable-synced) | Query Airtable directly from canvas |
| Read design docs in `docs/` before building | Guess at spec details |
| Build single home screen (all users) | Add role routing before Entra groups are configured |

---

## Deferred Items (do not build until explicitly reopened)

- **Entra security groups** (`Lumineo-Operations`, `Lumineo-Sales`, `Lumineo-Employees-Production`, `Lumineo-Employees-Installation`, `Lumineo-Employees-Shipping`) — groups and role-based routing
- **BC API write-back** — automated processing of `lum_PendingBCWrites`
- **BC virtual table configuration** — bc_Customer, bc_Item, etc.

---

## BC Integration (Interim)

- **Job data reads:** `lum_job` table, populated by `AirtableMirror_Sync` flow every 15 min
- **BC writes:** Queue in `lum_pendingbcwrites`, process manually until API access granted
- **BC reads:** Not available until virtual tables are configured — use Airtable-synced data

Full schema: `docs/04-dataverse-schema.md`
Full architecture: `docs/01-architecture-overview.md`
Build plan: `docs/06-build-plan.md`
