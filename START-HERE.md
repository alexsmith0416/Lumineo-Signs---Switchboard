# START HERE — Lumineo Scheduling Hub

**Point Claude at this file first in any new terminal.** It's the map: what this
project is, where everything lives, and exactly how to commit + deploy to the
live app. Read this, then read `apps/scheduling/CLAUDE.md` for the deep
architecture/engine detail.

---

## 1. What this project is

The **Lumineo Scheduling Hub** — a React + TypeScript **Power Apps Code App**
that replaces the old Canvas Production Scheduling app. Three calendars
(Production, Installation, Shipping) share one constraint-based scheduling
engine, plus a Scenario Sandbox for what-if planning, a Monthly Plan roll-up,
and a per-user "My Schedule" view.

- **Live app name:** Lumineo Project Scheduler
- **Linear project:** https://linear.app/lumineosigns/project/lumineo-scheduling-hub-b4e29b417bee
- **Issues:** `ALE-79`–`ALE-87`, milestones M0–M8 (status table in `apps/scheduling/CLAUDE.md`)

## 2. Where everything lives

| Thing | Path |
|-------|------|
| **Repo root** | `C:\Users\Alex\lumineo-scheduling-port` |
| **The app** (run all app commands from here) | `apps/scheduling/` |
| Deep dev notes (architecture, engine contract, brand tokens) | `apps/scheduling/CLAUDE.md` |
| App overview / what works today | `apps/scheduling/README.md` |
| Source | `apps/scheduling/src/` |
| Deploy config (appId, env, buildPath) | `apps/scheduling/power.config.json` |
| Dataverse admin one-off scripts | `apps/scheduling/scripts/*.ps1` |
| Power Automate flows | `apps/scheduling/flows/` |
| **User guide** (ship-to-users doc + in-app Help — keep updated every deploy) | `apps/scheduling/public/USER-GUIDE.html` |

> ⚠️ This working copy (`lumineo-scheduling-port`) is **not** the OneDrive
> "Lumineo Signs — Switchboard" repo. All scheduling work happens here.

### Source layout (`apps/scheduling/src/`)

```
engine/      pure TypeScript scheduling logic — imports nothing but date-fns
services/    I/O boundary (Power SDK, BC analytics) — currently mostly stubbed
             current-user.ts → user roles/access (see §5)
store/       Zustand stores; live + scenario kept independent
hooks/       React glue (debounced search, live preview math)
components/  UI (scenario/ subfolder for sandbox); imports from store, not services
styles/      lumineo.css — design tokens + component styles
data/        mock fixtures for the stubbed services
generated/   generated Dataverse model/service types
```

## 3. Run it locally

```powershell
# from apps/scheduling/
npm install          # first time only
npm run dev          # Vite dev server, http://localhost:5174 (boots with mock data)
npm run typecheck    # tsc -b --noEmit
npm run build        # production build → dist/
npm run test         # vitest
```

Dev mode uses mock data and an admin stand-in user; changes persist in memory
only. Set `VITE_DATA_SOURCE=live` (or a prod build) to hit the real Power SDK.

## 4. Commit + deploy to the live app

Deploy is **build → push**. Run both from `apps/scheduling/`:

```powershell
npm run build
$env:NODE_OPTIONS="--use-system-ca"; pac code push
```

> 🔴 **Always `git commit` + `git push` every time you deploy.** A `pac code push`
> only ships the built files to the live app — it does **not** save your source
> to git. Right after every successful deploy, commit the changed source and push
> the branch so the repo matches what's live (see **Git workflow** below).

- **Why the env var:** plain `pac code push` fails with
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — bundled Node doesn't trust the local root
  CA. `--use-system-ca` fixes it. (Bash equivalent: `NODE_OPTIONS=--use-system-ca pac code push`.)
- **Auth:** deploy uses the active pac profile **`LumineoFoundation-Dev`**
  (asmith@lumineosigns.com). Check with `pac auth list`; the active one is
  marked `*`. It must point at env `Alex Smith's Environment`
  (`org8fa22efd.crm.dynamics.com`).

**Deploy target (from `power.config.json`):**
- App ID: `d954d7c6-698a-4563-8e03-f44df090778f`
- Environment ID: `484cdd3c-4409-e741-bbd5-7c210e00310e`
- Dataverse org: `org8fa22efd.crm.dynamics.com`
- Build output pushed: `dist/` (entry `index.html`)

**Share/bookmark this link** — it hides the purple Power Apps header by default
(`?hideNavBar=true`). Users can toggle the header back on in **Settings → Display**:
```
https://apps.powerapps.com/play/e/484cdd3c-4409-e741-bbd5-7c210e00310e/a/d954d7c6-698a-4563-8e03-f44df090778f?hideNavBar=true
```
The header is Power Apps player chrome (outside the app), so hiding it is a URL
param, not app CSS — the in-app toggle just reloads at the with/without-param URL.
IDs are duplicated in `src/services/power-host.ts`; keep them in sync with
`power.config.json` if the app is ever redeployed to a new environment/app id.

### Git workflow
- Branch convention: `claude/<slug>` for in-progress work.
- **Main branch for PRs:** `claude/master-power-apps-design-05pjY` (this is
  `origin/HEAD`).
- Remote: `origin` → `github.com/alexsmith0416/Lumineo-Signs---Switchboard`.
- Commit and push only when asked. If on the main branch, branch first.

### Keep the user guide current (audit at session START + on EVERY deploy)

There is a customer-facing user guide at **`apps/scheduling/public/USER-GUIDE.html`**
— a self-contained, brand-styled HTML doc (Lumineo logo + colors). It ships in
the app bundle (Vite `public/`) and is surfaced in-app under **Help** (sidebar →
Help → embedded guide + Download PDF), and is also sent to users directly. It is
the single place users learn what the app can do.

🔴 **At the START of every development session** — before doing new work — audit
the guide against the app so it never drifts:
1. `git log --oneline -25` and skim what shipped recently.
2. Compare it to the guide **body** (§4 Legend, §5 Features, §6 Walkthroughs,
   §7 Roles, §13 Glossary). If a shipped feature, a change to the job process /
   flow, a role/permission change, or any user-facing behavior is missing or
   wrong in the body, fix it this session — don't wait for the user to notice.

🔴 **Whenever a change adds, changes, or removes a user-facing feature** (a new
feature, a change to the job process/flow, a role/permission change, or any UI
affordance) update the guide in the SAME change, in this order of importance:
1. **Update the relevant BODY section(s)** — Features, Walkthroughs, Legend,
   Roles, Shortcuts, Troubleshooting, Glossary, FAQ — so the guide *describes*
   the feature. ⚠️ This is the step that gets skipped: a "What's New" row is
   **not** enough on its own — the body must actually teach the feature.
2. Add a dated row to the **"What's New"** table (§14, newest first).
3. Bump the version/date in the footer on a meaningful revision.

Treat this like updating tests: a user-facing change isn't "done" until the
guide **body** reflects it. (Pure internal/refactor changes with no user impact
don't need a guide edit.) Open the file in a browser to preview; it prints
cleanly to PDF for distribution.

## 5. User roles & access (code, not data)

Access is defined in **`src/services/current-user.ts`**, not in Dataverse:

- `USER_DIRECTORY` maps login email (lowercase) → `UserType`
  (`admin` / `ops` / `production` / `install-wk` / `install-nek` / `sales` / `pm`).
- `TYPE_CONFIG` sets each type's default screen, `$`-visibility, and Monthly-plan
  access. `$` values + Monthly Gameplanning are Admin/Ops only.
- Unlisted logins fall back to a derived type (shared floor account → Sales/PM
  code → else admin).
- **To add/onboard a user:** add the email to `USER_DIRECTORY`, then build + push (§4).

## 6. Pick up where I left off

At the start of a session, to reorient quickly:

```powershell
git status
git log --oneline -10
git branch --show-current
```

Then check the **Milestone status** and **Known gaps** sections at the bottom of
`apps/scheduling/CLAUDE.md` for what's done vs. still stubbed (notably: Power SDK
and BC analytics are stubbed; no test suite yet; calendar is a hand-rolled grid).

### 🔖 Next up (keep this current — it's the "where we left off" note)

> ⚠️ **Claude: update this block at the END of each session** so the next
> terminal knows exactly where to resume. Replace it with the current thread —
> what's done, what's next, any half-finished work.

- **Last shipped (Jul 20, 2026):** Automatic job card resizing — multi-day
  install cards "un-stack" (job # | customer | description on one line; tasks
  joined with " • "; wraps, never clips). Height estimate is viewport-aware via
  a `ResizeObserver` (`useDayColumnWidth` in `CalendarView.tsx`). Committed +
  pushed + deployed.
- **Next:** _(nothing queued — ask the user what to pick up)._ Possible follow-up
  if requested: extend un-stacking to Production/Shipping (compact) cards, which
  are currently single-row and were intentionally left out of scope.

---

*Keep this file current when the deploy flow, paths, or app identity change.*
