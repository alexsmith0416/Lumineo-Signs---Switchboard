# 05 — Home Screens (per group)

Each role lands on a tailored home screen. **Everyone** gets the universal widgets (announcements, birthdays, photo reel, events). **Role-specific** widgets ride on top.

## Universal widgets (every home screen)

| Widget | Source | Notes |
|---|---|---|
| **Header bar** | Canvas Component Library | Logo + user avatar + role badge + sign out |
| **Announcements** | `Announcement` table filtered to audience | Pinned at top, dismissible |
| **Upcoming birthdays** (next 14 days) | `UserProfile.birthday` | Tap to send a Teams message |
| **Upcoming events / holidays** | `Event` table | Calendar strip, scrolls horizontally |
| **Completion photo reel** | `Photo` where `isShowcase=true` and last 30 days | Auto-rotating carousel |
| **Quick actions** | static | "Report a problem," "Suggest improvement" — opens Teams form |
| **App launcher tiles** | role-filtered list | The whole point of the shell |

## Operations Home (`scrHomeOps`)

The control tower. Everything visible. All five tiles.

**Tiles**: Project Scheduler · Weekly Scheduler · Sign Builder Pro · Time & Photo · Sales Hub

**Ops-only KPI strip** (top of screen, four cards):
- Open Jobs (count, click → filtered Project Scheduler)
- Jobs at risk (due in <7 days, <50% complete) — red badge
- Hours logged today (rollup from `TimeEntry`)
- This week's revenue (from BC `bc_SalesOrder.totalAmount`)

**Ops-only secondary widgets**:
- **Department load chart** — bar chart, hours scheduled this week per dept (Prod/Install/Ship)
- **Late tasks list** — `Task.status != Done AND scheduledDate < Today()`
- **Pending approvals** — SignSpec rows awaiting approval, Opportunity quotes >$50k

## Sales Home (`scrHomeSales`)

**Tiles**: Sales Hub · Weekly Scheduler · Sign Builder Pro

**Sales-only KPI strip**:
- My open opportunities (count + $ value)
- My quota progress (this month, with progress bar)
- Quotes awaiting customer response (>3 days old)
- Won this month ($ value)

**Sales-only secondary widgets**:
- **My pipeline by stage** — funnel chart
- **Hot opportunities** — those with `expectedCloseDate` in next 30 days
- **Recent customer activity** — last 5 customers I've touched
- **Top customers by revenue (last 90 days)** — from BC

## Production Home (`scrHomeProd`)

**Tiles**: Weekly Scheduler · Time & Photo Capture

**Prod-specific KPI strip**:
- My tasks today (count)
- Currently clocked in (the active TimeEntry, if any — tap to clock out)
- My hours this week
- Tasks complete this week (count)

**Prod-specific secondary widgets**:
- **Today's task list** — tappable, opens Weekly Scheduler at that task
- **Shop calendar strip** — next 5 production tasks across the team, so people can self-coordinate
- **"Need help?" wall** — tasks flagged as Blocked, anyone can grab

## Installation Home (`scrHomeInst`)

**Tiles**: Weekly Scheduler · Time & Photo Capture

**Install-specific KPI strip**:
- My next install (date + customer + address)
- Currently clocked in
- This week's install count
- Average install hours vs estimate (last 30 days)

**Install-specific secondary widgets**:
- **Today's route** — list of installs in order, tap → maps deep-link
- **Required photos checklist** — what each install needs uploaded before mark-complete
- **Materials pull list** — items still needed for next 3 installs (from `bc_Inventory`)

## Shipping Home (`scrHomeShip`)

**Tiles**: Weekly Scheduler · Time & Photo Capture

**Shipping-specific KPI strip**:
- Packages out today
- Packages in queue (ready to ship)
- Late shipments (>1 day past due)
- This week's shipped value

**Shipping-specific secondary widgets**:
- **Ready-to-ship queue** — Tasks where `department=Shipping AND status=Not Started`
- **In-transit list** — shipped but not delivered (from BC)
- **Receiving today** — expected inbound vendor deliveries

## Other widget recommendations (you asked for more ideas)

These are nice-to-haves to mix in once the basics ship:

- **Weather card** for Installation home (install crews care about this — short tap to forecast at next install address)
- **"Last seen by" indicator** on Announcements so Ops knows what's been read
- **Streak counter** — "you've clocked in on time 12 days in a row" (gamification, low cost, high engagement for shop floor)
- **Suggestion box** — wired to a Dataverse table, gives employees a direct line to Ops without email
- **"Spotlight" rotation** — one employee or one completed project featured per week on every home screen (auto-rotates from a curated list)
- **Cycle-time leaderboard** for Production/Installation — average hours per task type, ranked. Use carefully — can demotivate if not framed right.
- **Safety / training reminders** — surface from `Event` when a cert is about to expire
- **Customer testimonials reel** — pulled from Sales Hub when a customer leaves positive feedback
- **"On the road" map** — for Ops, a real-time map of which install crews are at which job site (requires opt-in location from T&P Capture)
- **AI assistant tile** — drop in Copilot Studio bot for FAQs ("how do I clock out remotely?", "where's job J-2026-0142?")

## Visual language

Use the Canvas Component Library to make all home screens consistent:
- 8pt spacing grid
- Lumineo brand colors top-bar, white cards, soft drop shadows
- Tiles are 220×140 with icon + label + subtle stat ("3 open jobs")
- All screens responsive: 1 column phone, 2 columns tablet, 3+ columns desktop
