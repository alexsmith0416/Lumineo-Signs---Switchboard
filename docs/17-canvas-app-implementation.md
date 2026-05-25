# 17 — Canvas App Implementation Spec (Switchboard)

## Purpose

You (Claude Code in VS Code) have all the right components built into the
`.msapp` already — `kpiCardRevenue`, `safetyCounter`, `weatherWarehouse`,
`annCard1`, etc. — but they're laid out as **floating individual controls**
on the screen with no container structure. That's why the canvas looks like
scattered rectangles instead of the LNI-style grid prototype.

This doc is the **canvas-side implementation spec** that turns the existing
controls into the responsive, branded splash + sub-app shell layout shown in
the React prototype (`prototype/V21-*.html` for the latest visual).

> **Read these first:**
> - [doc 01 — architecture overview](01-architecture-overview.md)
> - [doc 05 — home screens](05-home-screens.md)
> - [doc 08 — splash screen spec](08-splash-screen-spec.md)
> - [doc 15 — launch contract](15-launch-contract.md) (URL params each sub-app receives)
> - [doc 16 — PCF wrapping contract](16-pcf-wrapping-contract.md) (for React-app sub-apps)

## The big picture: why the current canvas is "wrong"

In classic Canvas Power Apps you have two layout modes:

1. **Manual positioning** — every control has explicit `X`, `Y`, `Width`,
   `Height` properties (usually as formulas referring to `Parent`).
2. **Modern containers (Auto-layout)** — `Vertical container` and
   `Horizontal container` with `LayoutMode = Auto`. Children flow
   automatically with a `LayoutGap`, and the container resizes its
   children based on the design.

The Tree view in your screenshot shows every control as a direct child of
`Screen1`. That means each is manually positioned and there's no responsive
behavior. The fix is to **wrap related controls in modern containers** so
they sit together as a group, then use the container's auto-layout to
handle spacing.

## Foundation

### Brand tokens — `App.OnStart`

Set these once on `App.OnStart` so every control can reference the same
values. Replace any control formula that hard-codes a color with the
matching token.

```powerfx
// App.OnStart
Set(gblBrand, {
    navy:       RGBA(20, 20, 100, 1),
    navyLight:  RGBA(42, 42, 138, 1),
    navyMid:    RGBA(232, 234, 245, 1),
    navySoft:   RGBA(242, 243, 250, 1),
    red:        RGBA(232, 21, 27, 1),
    redSoft:    RGBA(255, 228, 229, 1),
    green:      RGBA(15, 110, 86, 1),
    greenSoft:  RGBA(216, 239, 231, 1),
    amber:      RGBA(242, 153, 74, 1),
    amberSoft:  RGBA(253, 240, 217, 1),
    bg:         RGBA(250, 250, 251, 1),
    bg2:        RGBA(245, 245, 245, 1),
    card:       RGBA(255, 255, 255, 1),
    border:     RGBA(228, 229, 234, 1),
    borderSoft: RGBA(239, 240, 243, 1),
    text:       RGBA(31, 31, 46, 1),
    textMid:    RGBA(74, 79, 94, 1),
    textDim:    RGBA(139, 145, 163, 1)
});

Set(gblFont, {
    family:  Font.'Open Sans',
    weightR: FontWeight.Regular,
    weightM: FontWeight.Semibold,
    weightB: FontWeight.Bold,
    weightX: FontWeight.Lighter   // map to 800 in CSS terms
});

Set(gblRadii, { sm: 4, md: 6, lg: 8, pill: 999 });

// Identity (per doc 15 launch contract)
Set(gblUser, {
    email:          Param("userEmail"),
    role:           Coalesce(Param("role"), "Operations"),
    impersonatedBy: Coalesce(Param("impersonatedBy"), "")
});
Set(gblReturnTo, Coalesce(Param("returnTo"), "switchboard://home"));

// Parse incoming launch context (per doc 15)
Set(gblCtx,
    Coalesce(
        // Large-context: read from lum_LaunchContext
        If(!IsBlank(Param("contextRef")),
            ParseJSON(
                LookUp('lum_LaunchContext', id = Param("contextRef")).payload
            )
        ),
        // Inline context
        If(!IsBlank(Param("context")), ParseJSON(Param("context"))),
        Blank()
    )
);

// Route to the role-appropriate splash
Navigate(
    Switch(gblUser.role,
        "Operations",   scrHomeOps,
        "Sales",        scrHomeSales,
        "Production",   scrHomeProd,
        "Installation", scrHomeInst,
        "Shipping",     scrHomeShip,
        scrHomeOps    // default
    )
);
```

### Naming conventions

| Prefix | Use |
|---|---|
| `scr` | Screen — e.g. `scrHomeOps`, `scrLaunchProjectScheduler` |
| `con` | Container — e.g. `conMain`, `conGlanceRow`, `conKpiGrid` |
| `lbl` | Label |
| `btn` | Button |
| `gal` | Gallery |
| `img` | Image |
| `icn` | Icon |
| `kpi` | KPI card (these already exist in your tree) |
| `tile` | App launcher tile |

Keep the existing names (`kpiCardRevenue`, `safetyCounter`, etc.) — they're
fine. Just re-parent them into containers.

### Responsive design width

```powerfx
// App-level (computed in App.OnVisible or as a formula)
Set(gblDesignW, 1280);                 // max content width (matches prototype SPLASH_MAX)
Set(gblContentW, Min(App.Width - 40, gblDesignW));
Set(gblContentX, (App.Width - gblContentW) / 2);  // centers the content
Set(gblIsDesktop, gblContentW >= 900);
Set(gblIsTablet,  gblContentW >= 560 && gblContentW < 900);
Set(gblIsPhone,   gblContentW < 560);
```

Use `gblContentW` for the **main content column width** on every screen.
Use `gblContentX` for its left position. Together they give you a centered
1280-px-max content column on desktop, a viewport-width column on phone.

## Layout pattern: every splash and sub-app screen

```
Screen
├─ conHeader            (Horizontal container, fixed 64 px tall, full width)
│  ├─ conBrand            (logo + LUMINEO SIGNS / SWITCHBOARD)
│  ├─ lblViewTitle        ("Home · Operations")
│  └─ conHeaderRight      (+ New, avatar, role-switcher)
│
└─ conScroll            (Vertical Gallery or Scroll container)
   └─ conContent          (Vertical container, width = gblContentW, X = gblContentX)
      ├─ conGlanceRow      (Horizontal container — safety + KPI strip)
      ├─ conAnnouncements  (Vertical container — announcement cards)
      ├─ conAppLauncher    (Horizontal wrap container — app tiles)
      ├─ conRoleDashboard  (responsive container — role widgets)
      ├─ conBirthdays      (Vertical container — title + scroll strip)
      └─ conPhotoReel      (Vertical container — title + scroll strip)
```

### Modern containers vs. classic positioning

Power Apps lets you mix these. Recommended:
- **Modern containers** for everything inside `conContent` (auto-layout
  handles responsive spacing).
- **Manual positioning** for the outer structure: `conHeader` and
  `conContent` size themselves to `App.Width` / `gblContentW`.

In each container set:
- `LayoutMode = Auto`
- `LayoutDirection = Vertical` or `Horizontal`
- `LayoutGap = 12` (or whatever — see per-section gap below)
- `LayoutAlignItems = Stretch` for vertical containers (children fill width)

---

## Screen 1: `scrHomeOps` (Operations splash)

Per [doc 05](05-home-screens.md). The user is `Operations`; they see all 5
app tiles, the Operations dashboard widgets, and Ops-only KPIs (which were
recently updated per [doc 04](04-dataverse-schema.md) and prototype V15:
DIP, Value of Open Jobs, GM% April, GM% YTD).

### `scrHomeOps` properties

| Property | Formula |
|---|---|
| `Fill` | `gblBrand.bg` |
| `LoadingSpinner` | `LoadingSpinner.None` |

### `conHeader` (fixed top, 64 px)

```
LayoutMode = Manual                  // header has fixed positions
X = 0
Y = 0
Width = App.Width
Height = 64
Fill = gblBrand.navy
```

Children:

- **`conBrand`** (Horizontal container, manual)
  - `X = 20`, `Y = 12`, `Height = 40`
  - `Width = 360` (approx — adjust to fit "LUMINEO SIGNS / SWITCHBOARD")
  - Inside:
    - **`imgLogo`** — the ray-burst SVG (see "Logo" section below)
      - `X = 0`, `Y = 0`, `Width = 40`, `Height = 40`
      - `Image = "data:image/svg+xml;base64,...the ray-burst svg..."` (see below)
    - **`lblBrandName`** — "LUMINEO SIGNS"
      - `X = 54`, `Y = 4`, `Height = 18`
      - `Font = gblFont.family`, `Size = 15`, `FontWeight = Bold`
      - `Color = White`
    - **`lblBrandSub`** — "SWITCHBOARD"
      - `X = 54`, `Y = 22`, `Height = 14`
      - `Font = gblFont.family`, `Size = 11`, `FontWeight = Semibold`
      - `Color = RGBA(255, 255, 255, 0.55)`

- **`lblViewTitle`** — "Home · Operations"
  - `X = 400`, `Y = 22`, `Height = 20`
  - `Text = "Home · " & gblUser.role`
  - `Font = gblFont.family`, `Size = 13`, `FontWeight = Semibold`
  - `Color = RGBA(255, 255, 255, 0.85)`

- **`conHeaderRight`** (Horizontal container, manual right-anchored)
  - `X = App.Width - 220`, `Y = 12`, `Width = 200`, `Height = 40`
  - Contains:
    - **`btnHelp`** — ghost button ("Help"), Fill = `RGBA(255,255,255,0.1)`, Color = White
    - **`btnNew`** — red button ("+ New"), Fill = `gblBrand.red`, Color = White
    - **`conUser`** — avatar + name + caret (opens role-switcher menu)

### `conContent` (centered content column)

```
LayoutMode = Auto
LayoutDirection = Vertical
LayoutGap = 12
LayoutAlignItems = Stretch
X = gblContentX
Y = 76                                // header (64) + 12 gap
Width = gblContentW
Height = App.Height - Self.Y - 32
```

This becomes your single content column. Children below all stretch to
`gblContentW`.

### `conGlanceRow` (safety + KPI grid)

The prototype keeps these inline — desktop/landscape: safety + all 4 KPIs
in a single row; phone: safety on top, 2x2 KPI grid below.

```
Parent = conContent
LayoutMode = Auto
LayoutDirection = If(gblIsPhone, Vertical, Horizontal)
LayoutGap = 8
LayoutAlignItems = Stretch
Height = If(gblIsPhone, 196, 92)
```

Children:

- **`safetyCounter`** (your existing control)
  - On desktop: `Width = 200`, `Height = Parent.Height`
  - On phone: `Width = Parent.Width`, `Height = 72`
  - Fill = `gblBrand.navy`, Color = White
  - Reads from `lum_SafetyMetric` singleton — see [doc 08](08-splash-screen-spec.md)
  - Already exists; just confirm fill/typography matches the spec below.

- **`conKpiGrid`** (Horizontal container, wraps)
  - `LayoutDirection = Horizontal`, `LayoutGap = 8`
  - `LayoutWrap = true`
  - `LayoutAlignItems = Stretch`
  - Contains the 4 KPI cards.

**KPIs to show for Ops** (per latest data spec):

| Existing control | New label / value | Notes |
|---|---|---|
| `kpiCardRevenue` | rename → `kpiCardDIP` | "Avg Days Job Open (DIP)" — see formula below |
| `kpiCardJobs` | rename → `kpiCardOpenValue` | "Value of Open Jobs" |
| `kpiCardComplete` | rename → `kpiCardGmApril` | "GM % — April" |
| `kpiCardMargin` | keep → `kpiCardGmYtd` | "GM % — YTD" |

Each card layout (apply to every `kpiCard*`):

```
LayoutMode = Auto
LayoutDirection = Vertical
LayoutGap = 2
Height = 72 (phone) | 92 (desktop)
Width  = (gblIsPhone, calc 2-up; else flex grow)
Fill = gblBrand.card
BorderColor = gblBrand.border
BorderThickness = 1
BorderRadius = gblRadii.md
PaddingLeft = 12, PaddingRight = 12, PaddingTop = 8, PaddingBottom = 8
```

Children inside each KPI card:
- `lblKpiLabel` — 9 px Semibold uppercase, `Color = gblBrand.textDim`, `LetterSpacing = 0.7`
- `lblKpiValue` — 20 px Bold, `Color = gblBrand.text`, tabular numerals
- `lblKpiDelta` — 10 px Bold inline (e.g. "▲ 12%"). Color logic:
  ```powerfx
  If(deltaDirection = "flat",  gblBrand.textDim,
     deltaIsGood,              gblBrand.green,
                               gblBrand.red)
  ```

**Width formula for KPI card on phone (2-up grid):**
```powerfx
Width = (Parent.Width - Parent.LayoutGap) / 2
```

**Width formula on desktop (4-up after safety):**
```powerfx
Width = (Parent.Width - 200 - 8 - Parent.LayoutGap * 3) / 4
```

Or simpler — set `FillPortions = 1` and let `LayoutAlignItems = Stretch` size them.

### `conAppLauncher` (5 app tiles)

```
LayoutMode = Auto
LayoutDirection = Horizontal
LayoutWrap = true
LayoutGap = 8
LayoutAlignItems = Stretch
```

Wraps to 2-up on phone, 5-up on desktop.

You don't have a single `tile*` control yet — create a **canvas component**
`cmpAppTile` (defined once, reused 5×) with inputs:

| Input | Type | Example |
|---|---|---|
| `key` | Text | "projectScheduler" |
| `label` | Text | "Project Scheduler" |
| `emoji` | Text | "📊" |
| `badgeText` | Text | "17 open" |
| `enabled` | Boolean | true |
| `targetUrl` | Text | "https://apps.powerapps.com/play/.../ProjectScheduler" |

`OnSelect` (using the launch contract from doc 15):
```powerfx
Launch(
    Self.targetUrl,
    {
        userEmail: gblUser.email,
        role: gblUser.role,
        returnTo: "switchboard://home"
    }
);
// And audit-log it
Patch('lum_LaunchLog', Defaults('lum_LaunchLog'), {
    userEmail: gblUser.email,
    role: gblUser.role,
    targetApp: Self.key,
    source: "tile",
    launchedAt: Now()
});
```

The 5 tiles:

| Tile | label | emoji | badgeText | shows for |
|---|---|---|---|---|
| Project Scheduler | "Project Scheduler" | "📊" | `Concurrent(CountRows(Filter('lum_Job', status<>"Complete")) & " open"` | Operations only |
| Weekly Scheduler  | "Weekly Scheduler"  | "🗓️" | CountRows of tasks this week | All roles |
| Sign Builder Pro  | "Sign Builder Pro"  | "✏️" | `CountRows(Filter('lum_SignSpec', status="Open"))` | Ops, Sales, Production |
| Time & Photo      | "Time & Photo"      | "📷" | "Punch in" | Ops, Production, Install, Shipping |
| Sales Hub         | "Sales Hub"         | "💰" | `CountRows(Filter('lum_Opportunity', stage<>"Won" && stage<>"Lost")) & " opps"` | Ops, Sales |

Wire `cmpAppTile.Visible` to the role check from doc 03.

### `conAnnouncements`

Vertical container with one `annCard` per `lum_Announcement` row matching
the audience filter. You already have `annCard1`, `annCard2` — convert to
a **Gallery** for variable count:

```powerfx
// galAnnouncements.Items
Filter('lum_Announcement',
    audience = "All" || audience = gblUser.role,
    publishAt <= Now(),
    expireAt > Now() || IsBlank(expireAt)
)
```

Each gallery row:
- Background `gblBrand.navySoft`
- Left border `gblBrand.navy`, 3 px
- 10 px padding
- `lblAnnIcon` — `📢`
- `lblAnnTitle` — Bold, `Color = gblBrand.navy`
- `lblAnnBody` — Regular
- `btnDismiss` — 22×22 ghost button "×"

### `conRoleDashboard` (Operations widgets)

This is where the existing `weatherWarehouse`, `weatherOffice`, `crewBadge1`,
`crewBadge2`, `eventStrip*` etc. belong — but **only those relevant to Operations** show here. Other roles get different widget sets per [doc 05](05-home-screens.md).

For Operations:
1. **Department Load** (full-width, spans both columns on desktop)
2. **Late Tasks** (col 1)
3. **Pending Approvals** (col 2)

Container layout:

```
LayoutMode = Auto
LayoutDirection = Vertical
LayoutGap = 12
```

For desktop 2-col, wrap the bottom two widgets in a nested horizontal
container:

```
conRoleDashboard (vertical)
├─ conDeptLoad             (full width, spans 1 row)
└─ conLowerRow (horizontal, 2 children, gap 12)
   ├─ conLateTasks         (FillPortions = 1)
   └─ conPendingApprovals  (FillPortions = 1)
```

On phone, set `conLowerRow.LayoutDirection = Vertical` so it stacks.

Each widget shell:
- White Fill (`gblBrand.card`)
- 1px border (`gblBrand.border`), radius `gblRadii.md`
- 12 px padding
- Header row (Horizontal): `lblTitle` + optional `btnAction`
- Body (Vertical, gap 8)

### `conBirthdays`

```
LayoutMode = Auto
LayoutDirection = Vertical    // title above strip
LayoutGap = 8
```

- **`lblBirthdayTitle`** — "🎂 UPCOMING BIRTHDAYS" 10 px Bold, dim color
- **`galBirthdayStrip`** — horizontal Gallery, scroll horizontal
  - Items: `Sort(Filter('lum_UserProfile', !IsBlank(birthday) && DateAdd(Today(), 14, Days) >= ThisRecord.birthday), birthday)`
  - Each chip: avatar circle, name, "When" label (e.g. "Tuesday", "Next Friday")
  - Chip pill style: Fill `gblBrand.bg2`, radius `gblRadii.pill`

### `conPhotoReel`

Same pattern — horizontal Gallery scrolling left/right. Items:
```powerfx
Filter('lum_Photo', isShowcase = true, takenAt > DateAdd(Today(), -30, Days))
```

Each tile: 200×120 px, image background, caption + author overlay.

---

## Screen 2-5: other role splashes

Copy `scrHomeOps`. Same outer layout. Differences:

### `scrHomeSales`

- KPI grid (3-4 cards): My Opportunities, Quota Attained, Won This Month
- App tiles visible: Sales Hub, Weekly Scheduler, Sign Builder Pro
- Role dashboard: Pipeline funnel, Hot opportunities, Recent customer activity, Top customers (90d)
  - 2-col on desktop: Pipeline + Hot opps row, Recent + Top row

### `scrHomeProd`

- KPI grid: My Tasks Today, My Hours This Week, Tasks Complete This Week
- App tiles visible: Weekly Scheduler, Time & Photo
- Role dashboard: Today's tasks (col 1), Shop calendar (col 2), Need help? (full-width)

### `scrHomeInst`

- KPI grid: Next Install, Installs This Week, Est vs Actual, Tomorrow's Weather
- App tiles visible: Weekly Scheduler, Time & Photo
- Role dashboard: Today's route (full-width), Required photos (col 1), Materials pull list (col 2)
- Weather card from `weatherWarehouse` / `weatherOffice` — pick the one
  matching the next install's ZIP. See [doc 09](09-weather-card-spec.md).

### `scrHomeShip`

- KPI grid: Packages Out Today, In Queue, Late Shipments, Value Shipped
- App tiles visible: Weekly Scheduler, Time & Photo
- Role dashboard: Ready-to-ship (col 1), In transit (col 2), Receiving today (full-width)

---

## Sub-app shell screens

Per [doc 07](07-sub-apps.md), the four canvas sub-apps each get their own
shell. These are separate `.msapp` files in production — but during
development you can prototype them as additional screens in the same app
so you can iterate quickly. Each shell screen:

- Same header pattern as the splashes (navy bar, logo, view title)
- View title = sub-app name (e.g. "Project Scheduler")
- Header right side adds: `← Back` button that does `Launch(gblReturnTo)`
- Content area = the sub-app's actual UI

### `scrProjectScheduler`

- Header view title: "Project Scheduler"
- Layout:
  - Left: 220 px wide vertical container `conJobList`
    - Search box `txtJobSearch`
    - Gallery `galJobs` filtered by `txtJobSearch.Text`
  - Right: `conJobDetail` (fill remaining width)
    - Tabbed: Overview / Tasks / Specs / Files / BC Sales Order
    - For each tab, a vertical container with the relevant fields

Cold-boot — per [doc 15](15-launch-contract.md):
```powerfx
// scrProjectScheduler.OnVisible
If(!IsBlank(gblCtx) && gblCtx.action = "openJob",
    Set(varSelectedJobId, gblCtx.jobId);
    Set(varActiveTab, Coalesce(gblCtx.tab, "overview")),
    // Default: show job list
    Set(varSelectedJobId, Blank())
)
```

### `scrWeeklyScheduler`

- Header view title: "Weekly Scheduler"
- This sub-app wraps an **existing React app via PCF** per [doc 16](16-pcf-wrapping-contract.md).
- For now the canvas shell renders a placeholder `lblPlaceholder` ("Weekly Scheduler PCF loads here") so the navigation flow can be tested. Real PCF wiring comes during the platform sprint.

PCF will receive these inputs:
```
userEmail   = gblUser.email
role        = gblUser.role
weekStart   = Coalesce(gblCtx.weekStart, Today() - Weekday(Today(), Monday) + 1)
deptFilter  = Coalesce(gblCtx.deptFilter, gblUser.role)
contextJson = If(IsBlank(gblCtx), "", JSON(gblCtx))
returnTo    = gblReturnTo
```

### `scrSignBuilderPro`

Same shell + PCF placeholder. Cold-boot honors `action = "openSpec"`,
`"newSpec"`, `"approveQueue"` per [doc 15](15-launch-contract.md).

### `scrTimePhotoCapture`

This is **not a PCF** — it's a native canvas app for mobile.

- Big touch-friendly layout (44×44 minimum touch targets)
- Screens within: `scrTpMyDay`, `scrTpClockIn`, `scrTpPhotoCapture`, `scrTpHistory`
- `scrTpMyDay.OnVisible` reads `gblCtx.todaysTaskIds` for instant render

### `scrSalesHub`

Model-driven app placeholder. The actual Sales Hub will be a separate
solution. From the canvas, just `Launch()` to the MDA URL.

---

## Logo SVG (paste into `imgLogo.Image`)

The ray-burst Lumineo logo, with rays transparent so the navy header shows
through:

```
data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjRTgxNTFCIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0wLDAgSDEwMCBWMTAwIEgwIFogTTI1LDc1IEwyMiwwIEwyOCwwIFogTTI1LDc1IEwzNCwwIEw0NiwwIFogTTI1LDc1IEw1NCwwIEw3MCwwIFogTTI1LDc1IEw4MiwwIEwxMDAsNyBMMTAwLDAgWiBNMjUsNzUgTDEwMCwxOCBMMTAwLDQwIFogTTI1LDc1IEwxMDAsNTIgTDEwMCw3NiBaIi8+PC9zdmc+
```

This decodes to the same `<path>` used in the React prototype's `Header.tsx`.
If you want to tweak ray angles, decode the base64, edit the path
coordinates, re-encode.

---

## Snippets — paste into Power Apps Studio

### 1. `App.OnStart` — full setup

```powerfx
// Brand tokens
Set(gblBrand, {
    navy:       RGBA(20, 20, 100, 1),
    navyLight:  RGBA(42, 42, 138, 1),
    navyMid:    RGBA(232, 234, 245, 1),
    navySoft:   RGBA(242, 243, 250, 1),
    red:        RGBA(232, 21, 27, 1),
    redSoft:    RGBA(255, 228, 229, 1),
    green:      RGBA(15, 110, 86, 1),
    greenSoft:  RGBA(216, 239, 231, 1),
    amber:      RGBA(242, 153, 74, 1),
    amberSoft:  RGBA(253, 240, 217, 1),
    bg:         RGBA(250, 250, 251, 1),
    bg2:        RGBA(245, 245, 245, 1),
    card:       RGBA(255, 255, 255, 1),
    border:     RGBA(228, 229, 234, 1),
    borderSoft: RGBA(239, 240, 243, 1),
    text:       RGBA(31, 31, 46, 1),
    textMid:    RGBA(74, 79, 94, 1),
    textDim:    RGBA(139, 145, 163, 1)
});
Set(gblRadii, { sm: 4, md: 6, lg: 8, pill: 999 });

// Identity per doc 15
Set(gblUser, {
    email:          Param("userEmail"),
    role:           Coalesce(Param("role"), "Operations"),
    impersonatedBy: Coalesce(Param("impersonatedBy"), "")
});
Set(gblReturnTo, Coalesce(Param("returnTo"), "switchboard://home"));

// Launch context
Set(gblCtx,
    Coalesce(
        If(!IsBlank(Param("contextRef")),
            ParseJSON(LookUp('lum_LaunchContext', id = Param("contextRef")).payload)
        ),
        If(!IsBlank(Param("context")), ParseJSON(Param("context"))),
        Blank()
    )
);

// Responsive
Set(gblDesignW, 1280);

// Route
Navigate(
    Switch(gblUser.role,
        "Operations",   scrHomeOps,
        "Sales",        scrHomeSales,
        "Production",   scrHomeProd,
        "Installation", scrHomeInst,
        "Shipping",     scrHomeShip,
        scrHomeOps
    )
);
```

### 2. Every splash screen's `OnVisible`

```powerfx
Set(gblContentW, Min(App.Width - 40, gblDesignW));
Set(gblContentX, (App.Width - gblContentW) / 2);
Set(gblIsDesktop, gblContentW >= 900);
Set(gblIsTablet,  gblContentW >= 560 && gblContentW < 900);
Set(gblIsPhone,   gblContentW < 560);
```

### 3. Container property template (paste into any new container)

```powerfx
LayoutMode = LayoutMode.Auto
LayoutDirection = LayoutDirection.Vertical    // or Horizontal
LayoutGap = 12
LayoutAlignItems = LayoutAlignItems.Stretch
Fill = Transparent                              // or gblBrand.card if it's a card
```

### 4. KPI card properties (apply to every `kpiCard*`)

```powerfx
// Container
LayoutMode = LayoutMode.Auto
LayoutDirection = LayoutDirection.Vertical
LayoutGap = 2
LayoutAlignItems = LayoutAlignItems.Start
PaddingLeft = 12
PaddingRight = 12
PaddingTop = 8
PaddingBottom = 8
Height = If(gblIsPhone, 72, 92)
Fill = gblBrand.card
BorderColor = gblBrand.border
BorderThickness = 1
BorderRadius = gblRadii.md
HoverFill = gblBrand.navySoft   // optional
TabIndex = 0

// Width inside conKpiGrid
FillPortions = 1                  // each KPI gets equal share of horizontal space
```

### 5. Safety counter card properties (`safetyCounter`)

```powerfx
LayoutMode = LayoutMode.Auto
LayoutDirection = LayoutDirection.Vertical
LayoutGap = 1
PaddingLeft = 12
PaddingRight = 12
PaddingTop = 8
PaddingBottom = 8
Fill = gblBrand.navy
BorderRadius = gblRadii.md
Width = If(gblIsPhone, Parent.Width, 200)
Height = If(gblIsPhone, 72, 92)

// Child labels:
// lblSafetyHead — "DAYS SINCE LOST TIME" — 9 px Bold white-70%
// lblSafetyValue — varSafetyDays as Number — 28 px Bold white tabular numerals
// lblSafetySub — "Record [longestStreak]" — 10 px white-60%
```

Where the safety value comes from:
```powerfx
// scrHomeOps.OnVisible (and on every other home screen)
Set(varSafety, First('lum_SafetyMetric'));
Set(varSafetyDays, DateDiff(varSafety.currentStreakStartDate, Today(), Days));
```

### 6. App tile component `cmpAppTile` properties

```powerfx
// Outer container
LayoutMode = LayoutMode.Auto
LayoutDirection = LayoutDirection.Vertical
LayoutGap = 6
PaddingLeft = 12
PaddingRight = 12
PaddingTop = 12
PaddingBottom = 10
Height = If(gblIsPhone, 84, 108)
Fill = gblBrand.card
BorderColor = gblBrand.border
BorderThickness = 1
BorderRadius = gblRadii.md
HoverFill = gblBrand.navySoft

// FillPortions = 1 inside conAppLauncher
```

Children:
- `lblTileEmoji` — Self.emoji, 22 px (phone) / 26 px (desktop)
- `lblTileLabel` — Self.label, 12 px / 13 px Bold
- `lblTileBadge` — Self.badgeText, 9 px Bold uppercase, pill background `gblBrand.navyMid`, top-right absolute position

### 7. Role-switcher button (header right)

```powerfx
// btnUserDropdown — opens a popover with the 5 role options
OnSelect:
    Set(varShowRoleMenu, !varShowRoleMenu)

// Each role option button
OnSelect:
    Set(gblUser, Patch(gblUser, { role: "Operations" }));
    Set(varShowRoleMenu, false);
    Navigate(scrHomeOps);
```

---

## Migration plan from current "scattered controls" state

Step-by-step for Claude Code in VS Code:

1. **Add `App.OnStart`** with the snippet above. Run the app once so
   `gblBrand`, `gblUser`, etc. exist.
2. **Add a `scrHomeOps` screen** if not already present. Set its `Fill` to
   `gblBrand.bg`.
3. **Move all existing controls into the new screen.** Cut from `Screen1`,
   paste into `scrHomeOps`.
4. **Create the container scaffolding** (`conHeader`, `conContent`,
   `conGlanceRow`, `conKpiGrid`, `conAppLauncher`, `conRoleDashboard`,
   `conBirthdays`, `conPhotoReel`) per the structure above.
5. **Re-parent each existing control** into its correct container. In Power
   Apps Studio: right-click → Reparent → pick container. (Tree view shows
   nesting once done.)
6. **Apply the property formulas** for fills/sizes/positions per the
   per-control specs.
7. **Build `cmpAppTile`** and instance it 5 times instead of using
   ad-hoc rectangles for the launcher.
8. **Update KPI labels** to the 4 Ops-required KPIs (DIP, Value of Open
   Jobs, GM% April, GM% YTD).
9. **Repeat the screen pattern** for `scrHomeSales` through
   `scrHomeShip` with role-specific KPIs and widgets.
10. **Build the 5 sub-app shell screens** (`scrProjectScheduler`,
    `scrWeeklyScheduler`, `scrSignBuilderPro`, `scrTimePhotoCapture`,
    `scrSalesHub`) with the header pattern + back button + per-app content.
11. **Wire up `cmpAppTile.OnSelect`** so tapping a tile launches the right
    sub-app with the launch contract params (doc 15).
12. **Test the launch context cold-boot** — pass `?context={"action":"openJob","jobId":"..."}`
    to Project Scheduler URL and verify `gblCtx.action` resolves.

---

## Wiring KPI cards to Dataverse (`lum_kpisnapshot`)

Once the placeholder `"$0"` labels need real values, point each `lcl_KpiCard`
instance at a row in `lum_kpisnapshot`. The KPI snapshot table is the
**presentation layer** — its rows are pre-computed by Power Automate so the
canvas doesn't have to do any math at render time.

### Schema reminder (from [doc 04](04-dataverse-schema.md))

| Field | Type | Notes |
|---|---|---|
| `key` | text | e.g. `"dip_avg_days"`, `"gm_pct_april"` |
| `audience` | text | `"Operations"`, `"Sales"`, …, or `"All"` |
| `label` | text | UI label (e.g. "Avg Days Job Open (DIP)") |
| `value` | decimal | the number to display |
| `valueFormat` | text | `"currency"` \| `"int"` \| `"hours"` \| `"percent"` \| `"days"` |
| `deltaValue` | decimal | percent change vs prior period |
| `deltaDirection` | text | `"up"` \| `"down"` \| `"flat"` |
| `deltaIsGood` | bool | true if the delta direction is favorable |
| `link` | text | optional deep-link URL on tap |
| `computedAt` | datetime | when this row was generated |

### KPI card data binding pattern

Each `lcl_KpiCard` exposes a single input — `kpiKey` (text). Everything
else flows from the lookup.

**`lcl_KpiCard` component inputs:**

| Name | Type | Example |
|---|---|---|
| `kpiKey` | Text | `"dip_avg_days"` |

**`lcl_KpiCard.varKpi` (define as a local variable in the component's `OnReset` or compute inline):**

```powerfx
// As a With() expression in each label so it re-evaluates on data refresh:
With(
    { kpi: LookUp('lum_kpisnapshot',
        key = Self.kpiKey &&
        (audience = "All" || audience = gblUser.role)
    )},
    kpi.value     // or kpi.label, kpi.deltaValue, etc.
)
```

If you'd rather not paste `With()` into every label, set a component-scoped
output called `kpi` (Power Apps Studio: Component → Properties → New custom
property → output). Then each label can read `KpiCard.kpi.label` directly.

**`lblKpiLabel.Text`:**

```powerfx
With({ kpi: LookUp('lum_kpisnapshot', key = Self.kpiKey && (audience = "All" || audience = gblUser.role)) },
    Upper(Coalesce(kpi.label, "—"))
)
```

**`lblKpiValue.Text`:**

```powerfx
With({ kpi: LookUp('lum_kpisnapshot', key = Self.kpiKey && (audience = "All" || audience = gblUser.role)) },
    Switch(kpi.valueFormat,
        "currency", "$" & Text(kpi.value, "[$-en-US]#,##0"),
        "int",      Text(kpi.value, "#,##0"),
        "hours",    Text(kpi.value, "#,##0") & " h",
        "days",     Text(kpi.value, "#,##0"),
        "percent",  Text(kpi.value, "#,##0.0") & "%",
        Text(kpi.value)
    )
)
```

**`lblKpiDelta.Text`:**

```powerfx
With({ kpi: LookUp('lum_kpisnapshot', key = Self.kpiKey && (audience = "All" || audience = gblUser.role)) },
    If(kpi.deltaDirection = "flat",
        "▬",
        Switch(kpi.deltaDirection, "up", "▲ ", "down", "▼ ", "")
        & Text(Abs(kpi.deltaValue), "#,##0.#")
        & If(kpi.valueFormat = "percent", " pp", "%")
    )
)
```

**`lblKpiDelta.Color`:**

```powerfx
With({ kpi: LookUp('lum_kpisnapshot', key = Self.kpiKey && (audience = "All" || audience = gblUser.role)) },
    If(kpi.deltaDirection = "flat",  gblBrand.textDim,
       kpi.deltaIsGood,              gblBrand.green,
                                     gblBrand.red)
)
```

### The 4 Operations KPI keys

Replace the current placeholder cards (`Revenue MTD`, `Active Jobs`,
`Jobs Complete`, `Gross Margin`) with these, per user-confirmed scope
(safety + Operational Execution + the 2 GM% KPIs):

| Card instance | `kpiKey` | Label that should resolve | Value format |
|---|---|---|---|
| `kpiCardDIP` | `dip_avg_days` | Avg Days Job Open (DIP) | days |
| `kpiCardOpenValue` | `value_open_jobs` | Value of Open Jobs | currency |
| `kpiCardGmApril` | `gm_pct_april` | GM % — April | percent |
| `kpiCardGmYtd` | `gm_pct_ytd` | GM % — YTD | percent |

For the safety counter, the source is `lum_safetymetric` (not
`lum_kpisnapshot`). Already covered in the safety chip section above.

### Seed data for testing (before BC sync exists)

Until [Linear ALE-24/25](https://linear.app/lumineosigns/project/lni-production-schedule-power-apps-code-app-29f2fc1f8840)
land and Power Automate populates these rows, seed them manually so the
canvas has something to show. Run this once from a dev session
(`App.OnStart` temporarily, then remove) or from a Power Automate "Seed
KPI snapshots" flow:

```powerfx
// Operations
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "dip_avg_days", audience: "Operations",
    label: "Avg Days Job Open (DIP)", value: 32, valueFormat: "days",
    deltaValue: 3, deltaDirection: "down", deltaIsGood: true,
    computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "value_open_jobs", audience: "Operations",
    label: "Value of Open Jobs", value: 1247800, valueFormat: "currency",
    deltaValue: 8, deltaDirection: "up", deltaIsGood: true,
    computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "gm_pct_april", audience: "Operations",
    label: "GM % — April", value: 34.2, valueFormat: "percent",
    deltaValue: 2, deltaDirection: "up", deltaIsGood: true,
    computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "gm_pct_ytd", audience: "Operations",
    label: "GM % — YTD", value: 31.8, valueFormat: "percent",
    deltaValue: 1, deltaDirection: "up", deltaIsGood: true,
    computedAt: Now()
});

// Sales
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "my_open_opportunities", audience: "Sales",
    label: "My Opportunities", value: 11, valueFormat: "int",
    deltaValue: 3, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "my_quota_pct", audience: "Sales",
    label: "Quota Attained", value: 68, valueFormat: "percent",
    deltaValue: 7, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "won_this_month", audience: "Sales",
    label: "Won This Month", value: 47600, valueFormat: "currency",
    deltaValue: 22, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});

// Production
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "my_tasks_today", audience: "Production",
    label: "My Tasks Today", value: 5, valueFormat: "int",
    deltaDirection: "flat", computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "my_hours_this_week", audience: "Production",
    label: "My Hours This Week", value: 34, valueFormat: "hours",
    deltaValue: 2, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});

// Installation
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "installs_this_week", audience: "Installation",
    label: "Installs This Week", value: 4, valueFormat: "int",
    deltaValue: 1, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "est_vs_actual_hours", audience: "Installation",
    label: "Est vs Actual", value: 92, valueFormat: "percent",
    deltaValue: 3, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});

// Shipping
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "packages_out_today", audience: "Shipping",
    label: "Packages Out Today", value: 12, valueFormat: "int",
    deltaValue: 2, deltaDirection: "up", deltaIsGood: true, computedAt: Now()
});
Patch('lum_kpisnapshot', Defaults('lum_kpisnapshot'), {
    key: "late_shipments", audience: "Shipping",
    label: "Late Shipments", value: 1, valueFormat: "int",
    deltaDirection: "flat", computedAt: Now()
});

// Safety singleton — different table
Patch('lum_safetymetric', Defaults('lum_safetymetric'), {
    currentStreakStartDate: DateAdd(Today(), -247, Days),
    longestStreakDays: 412,
    longestStreakEndDate: DateAdd(Today(), -365, Days),
    updatedAt: Now()
});
```

### Refresh strategy

The `lum_kpisnapshot` rows are pre-computed elsewhere (Power Automate
nightly + on-demand rollups). The canvas just reads. Trigger a refresh on:

- `App.OnStart` — initial load
- `scrHomeOps.OnVisible` — every time the user navigates back to home
- Optionally: a timer control that calls `Refresh('lum_kpisnapshot')` every
  60 seconds for live-feeling dashboards on shop-floor tablets

```powerfx
// On home screen OnVisible
Refresh('lum_kpisnapshot');
```

### Tap-to-drill behavior (per [doc 15](15-launch-contract.md))

If the KPI row has a `link` field set, tap should navigate there. Wire
into the KPI card's `OnSelect`:

```powerfx
With({ kpi: LookUp('lum_kpisnapshot', key = Self.kpiKey && (audience = "All" || audience = gblUser.role)) },
    If(!IsBlank(kpi.link),
        Launch(kpi.link, {
            userEmail: gblUser.email,
            role: gblUser.role,
            returnTo: "switchboard://home"
        }),
        // no link — silent no-op
        false
    )
)
```

For Operations:
- `dip_avg_days.link` = Project Scheduler URL with `?context={"action":"openCalendar"}`
- `value_open_jobs.link` = Project Scheduler URL with `?context={"action":"openJob","filter":"openValue"}`
- `gm_pct_*` = no link for now (financial drill-down is future work)

---

## Open questions / known gaps

These need to be resolved as part of platform setup:

1. **`lum_LaunchContext` doesn't exist as a Dataverse table yet** — see [doc 15](15-launch-contract.md). The `Param("contextRef")` branch in `App.OnStart` will be a no-op until that table is created.
2. **Sub-app target URLs are placeholders.** Replace `https://apps.powerapps.com/play/.../ProjectScheduler` with the actual published Power Apps player URLs once each sub-app is deployed.
3. **PCF inputs in sub-app shells** assume the PCFs are imported. Per [doc 16](16-pcf-wrapping-contract.md), `WeeklyScheduler` and `SignBuilder` PCFs are scaffold-only right now.
4. **Theme parity** — every existing canvas control still uses its own ad-hoc colors. Going to `gblBrand.*` everywhere is a one-time sweep.
