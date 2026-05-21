# 11 — Widget Recommendations (Full Catalog)

Every widget proposed across all rounds of design, with implementation detail. Some are MVP (Phase 2/3), some are post-launch enhancements. All are scoped here so they have a home in Linear for later pickup.

Linear tracking: each widget is an issue in `Switchboard — Master Power Apps Shell`, labeled `Home Screen` + role-specific label.

---

## MVP widgets (Phase 2 + Phase 3)

### 1. Announcements

- Source: `Announcement` table, filtered by audience + publishAt/expireAt
- Ops-only CRUD screen
- Per-user dismiss state persisted in `LoadData/SaveData`
- Pin support for critical announcements
- Rich text body via Power Apps RichTextEditor

### 2. Upcoming Birthdays (14 days)

- Source: `UserProfile.birthday`, computed window
- Horizontal scroll strip
- Avatar + first name + day badge ("Tue", "Thu", "next Mon")
- Tap → opens Teams 1:1 message composer pre-filled with "Happy birthday {name}! 🎂"
- Day-of: pulses with a subtle confetti animation

### 3. Upcoming Events / Holidays

- Source: `Event` table, next 21 days
- Types: Holiday, CompanyEvent, Deadline, Birthday (auto-projected)
- Calendar strip — horizontal, 3 weeks visible
- Color-coded chips per type
- Tap → flyout with full description

### 4. Recent Completion Photo Reel

- Source: `Photo` where `isShowcase=true AND takenAt > now()-30d`, max 12
- Auto-rotates every 6 s
- Tap → full-screen lightbox with caption + employee credit
- Ops dashboard separately for moderating new photos and flagging the best for showcase

### 5. App Launcher Tiles

- Role-filtered list per `App Routing` matrix in `03-permissions-and-roles.md`
- Tile state from `SystemConfig.<appKey>.enabled` (lets Ops "turn off" an app for maintenance)
- Subtle stat per tile when data available ("3 open jobs", "5 tasks today")
- Disabled state for "coming soon"

### 6. KPI Strip (Splash KPIs)

- Detailed spec: see [08-splash-screen-spec.md](./08-splash-screen-spec.md)
- 4 cards (Ops) or 3 cards (other roles)
- Snapshot table → sub-100ms reads

### 7. Days Since Lost Time Safety Counter

- Detailed spec: see [08-splash-screen-spec.md](./08-splash-screen-spec.md)
- Flip-clock visual, 3-4 digit tiles
- Logged via Ops-only Safety Incident screen
- Push notification on milestones (30/100/365 days)

---

## Role-specific MVP widgets

### Operations

- **Department load chart** — stacked bar, hours scheduled per dept this week
- **Late tasks list** — `Task.status != Done AND scheduledDate < Today()`
- **Pending approvals** — SignSpec awaiting approval + Opportunities >$50k

### Sales

- **My pipeline by stage** — funnel chart
- **Hot opportunities** — closing in next 30 days
- **Recent customer activity** — last 5 customers touched
- **Top customers by revenue** (last 90 days from BC)

### Production

- **Today's task list** — tappable, opens Weekly Scheduler
- **Shop calendar strip** — next 5 production tasks across the team
- **"Need help?" wall** — Tasks flagged Blocked; anyone can grab

### Installation

- **Today's route** — sequential list of installs, tap → maps deep-link
- **Required photos checklist** — what each install needs uploaded
- **Materials pull list** — items still needed for next 3 installs (from bc_Inventory)
- **Weather chip on every install card** — see [09-weather-card-spec.md](./09-weather-card-spec.md)
- **Crew/truck badge on every install card** — see [10-crew-truck-indicator-spec.md](./10-crew-truck-indicator-spec.md)

### Shipping

- **Ready-to-ship queue** — Tasks where `department=Shipping AND status=Not Started`
- **In-transit list** — shipped but not delivered (from BC)
- **Receiving today** — expected inbound vendor deliveries

---

## Phase 6 / Post-launch widgets

These deliver real value but aren't blockers for the initial cutover. Captured here so they don't get lost.

### 8. Spotlight Rotation

- Auto-rotates from a curated list, one per week
- Either an **Employee Spotlight** (years of service, fun fact, photo) or a **Project Spotlight** (recent completion with photos and short story)
- Source: a `Spotlight` Dataverse table populated by Ops
- Appears on every role's home screen — connective tissue across the company

### 9. Suggestion Box

- Single-field "What could we be doing better?" prompt
- Writes to a `Suggestion` table
- Routes to a Teams channel for Ops to review
- Optional anonymous mode

### 10. Streak Counters (Gamification)

- "12 days clocked in on time"
- "5 days no production errors"
- Per-user, lightweight celebration
- Computed nightly into UserProfile rolling fields
- **Caveat:** Frame carefully. Gamification can demotivate slower workers. Roll out with intent.

### 11. Cycle-time Leaderboard

- Avg hours per task type, ranked across the dept
- For Production and Installation
- **Same caveat as above** — surface as "team learning," never as a public shaming tool

### 12. Safety / Training Reminders

- Surface from `Event` table when a cert is about to expire
- E.g. "Forklift cert expires Sept 12 — schedule recert"
- Per-user reminders + Ops dashboard of upcoming expirations

### 13. Customer Testimonials Reel

- Pulled from Sales Hub when a customer leaves positive feedback (NPS, email, Google review captured to the Account)
- Rotates on Sales + Ops home screens
- Public-facing on internal monitors too

### 14. "On the Road" Map (Ops)

- Real-time map of which install crews are at which job site
- Requires opt-in location sharing from Time & Photo Capture
- Strictly Ops-only; communicate the consent model clearly to crews
- Bing Maps embed via PCF or Power BI tile

### 15. AI Assistant Tile (Copilot Studio)

- Drop in a Copilot Studio bot
- Trained on Lumineo SOPs, FAQs ("how do I clock out remotely?", "where's job J-2026-0142?")
- Tile launches a chat overlay
- Logs every conversation to Dataverse for improving the bot

### 16. Weather card (Installation) ✅ already in MVP

Moved to MVP per user request. See spec [09-weather-card-spec.md](./09-weather-card-spec.md).

### 17. Crew/Truck Badge ✅ already in MVP

Moved to MVP per user request. See spec [10-crew-truck-indicator-spec.md](./10-crew-truck-indicator-spec.md).

### 18. Weather-driven schedule alerts (Ops)

- A daily flow flags installs scheduled during forecasted bad weather (rain >50%, wind >25mph, snow, etc.)
- Surfaces as a banner on the Operations home
- Tap → see affected jobs, one-click message to customer to reschedule

### 19. Material readiness indicator on job cards

- Reads BC inventory levels for the SignSpec BOM items
- Green/yellow/red dot on the job card:
  - Green: all materials in stock
  - Yellow: some materials low (<20% lead time before install)
  - Red: critical materials short — can't start build
- Tap → flyout listing the missing items + their ETAs

### 20. Customer-facing photo approval

- Once an install is complete, the photos can optionally be shared with the customer via a Power Pages portal for sign-off
- Customer's electronic signature lands as a Photo annotation
- Reduces invoicing disputes

### 21. Voice clock-in (T&P Capture)

- "Hey Lumineo, clock me into Reynolds install"
- Uses Speech to Text + a small NL layer
- Hands-free for crews up on ladders or with full hands
- Phase 6 — needs accuracy testing in noisy environments

### 22. Margin alerts (Sales Hub)

- Compares actual costs (BC) to quoted price (Opportunity)
- Surfaces when margin drops below threshold mid-build
- Lets Sales course-correct on the next quote

### 23. Power BI Dashboards tile

- A sixth "App" tile for Ops only
- Opens Power BI Service or an embedded report
- Deep financial / operational analytics that don't fit in a Power App

### 24. Help Center button (always present)

- "?" icon in `lcl_Header`
- Opens a Power Apps Documents library with how-tos per role
- Searchable

### 25. Quick Action Bar

- Per-role contextual actions on the home screen footer
- Examples:
  - Sales: "+ New Opportunity"
  - Production: "Clock In"
  - Installation: "Today's Route"
  - Ops: "+ Announcement"

---

## How widget priority is decided

Anything tied to the Phase 1-3 milestones is **MVP**. Anything in Phase 6 lives in the project backlog with a `Feature` label and gets pulled into a cycle when capacity allows.

The bar for graduating a Phase 6 widget into MVP:

1. At least one role explicitly asks for it
2. The data source is already known (no new integration)
3. The implementation is <2 days for one maker
4. It doesn't push the splash performance budget past 2 s
