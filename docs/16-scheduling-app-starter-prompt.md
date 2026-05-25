# 16 — Starter Prompt: Production Build of the Scheduling Hub

Copy-paste the prompt below into a new Claude Code session to start building the production Power Code App. The prompt is self-contained — it points at the repo, the working prototype branch, the spec, and the Linear project.

> Recommended setup: in the new session, set the working directory to `Lumineo-Signs---Switchboard` and verify the GitHub + Linear MCP integrations are connected before pasting the prompt.

---

## Copy-paste prompt

```
I'm building the production Lumineo Scheduling Hub — a React/TypeScript Power
Code App that replaces the Canvas Production Scheduling app and adds two
parallel surfaces (Installation, Shipping) plus planning views (Scenario
Sandbox, Monthly Plan). A working prototype with every interaction wired
against mock data already exists on branch `claude/intelligent-cray-ffmS4`
in `scheduling-app/`. Your job is to convert that prototype into the
production app by replacing the mock data sources with real Power SDK,
Dataverse, Business Central, OpenWeatherMap, and LNI Project Scheduler
integrations — without changing the engine, the UI, or the visual styling.

Read these documents first, in this order:

1. `docs/15-scheduling-app-spec.md` — the full build specification.
   It contains the architecture, data model, business rules, UI screens,
   brand spec, file-by-file porting map, and "what's stubbed today" list.
2. `scheduling-app/CLAUDE.md` — the prototype's working notes,
   engine contract, and file structure conventions.
3. `docs/04-dataverse-schema.md` — shared Dataverse tables + BC
   integration shape.
4. `docs/09-weathercardspec.md` — `WeatherCache` table + OpenWeatherMap
   connector design.
5. `docs/10-crewtruckindicatorspec.md` — `CrewAssignment` table + BC
   `lumCrewType` purchase-line resolution.
6. `docs/14-bc-write-operations.md` — payload schemas for the 7 queued
   BC write operations.

Linear is the source of truth for milestones:

- Project: "Lumineo Scheduling Hub" (Alex Smith team)
- M0 through M15 are issues ALE-79 through ALE-177. M0–M5 capture the
  core build; M9–M15 are the extensions that landed in the prototype
  (regions, install chrome, monthly plan, cascade confirm, hamburger,
  mobile responsive, custom cards).
- Each issue's "What landed in the scaffold" section describes the
  prototype state; the "Outstanding (real wiring)" section is what you
  need to build.
- Update the corresponding Linear issue every time you complete a
  milestone's production wiring. Post a brief comment summarizing what
  was wired up and the commit hash.

Constraints — do not violate any of these:

- The engine code under `scheduling-app/src/engine/` is pure
  TypeScript with only `date-fns` as a dependency. 46 unit tests
  (`src/engine/*.test.ts`, `src/services/*.test.ts`) lock its behavior.
  Copy it verbatim into the production codebase. If a test breaks, the
  engine has regressed — fix the production wiring, not the engine.
- The UI components (`src/components/`), styles (`src/styles/lumineo.css`),
  and Zustand stores (`src/store/`) port verbatim. The store factory
  `createScheduleStore(dataSource)` is designed exactly so the data
  source swaps out independently.
- The `ScheduleDataSource` interface in `src/services/data-source.ts`
  is the contract for the swap. Implement real Power SDK adapters that
  satisfy this interface; don't change the interface.
- All visual + interaction behavior must match the prototype. When in
  doubt about UX, open the standalone HTML from the prototype build
  (run `npm run build` in `scheduling-app/`, the `dist/` is the artifact)
  and compare side-by-side.

Suggested execution order (highest leverage first):

1. Get the Power Platform / Dataverse environment provisioned with
   the schema additions described in `docs/15-scheduling-app-spec.md`
   §4.2. Move M1 (ALE-79) to "In Progress" while doing this.
2. Implement the real `productionDataSource` against Power SDK
   (replaces `scheduling-app/src/services/dataverse.ts`). Validate by
   loading + drag/drop committing through a real Dataverse row. This
   unblocks M1-M3 simultaneously since the engine + UI are already
   wired against the data source interface.
3. Implement the real `bcService` against BC analytics connector
   (replaces `scheduling-app/src/services/bc.ts`). Validate by opening
   Add Job and seeing a real BC job appear in the search. Unblocks M4.
4. Build `WeatherCache` table + `Lumineo Weather` Power Automate flow
   + `bc_ZipGeo` table import. Replace `getMockWeather` in
   `WeatherChip.tsx` with a call to the flow. Unblocks part of M10.
5. Build `CrewAssignment` table + nightly `RecomputeCrewAssignments`
   flow that reads BC `lumCrewType` purchase lines. Update install
   data source to populate the crew fields from this table. Unblocks
   the rest of M10.
6. Implement `wkInstallDataSource` and `nekInstallDataSource` against
   real Dataverse views filtered by region. Unblocks M6 + M9.
7. Implement `shippingDataSource`. Unblocks M7.
8. Wire `Commit proposal` in `MonthlyPlanView.tsx` to actually write
   the new install lines through the data source instead of showing
   an `alert(...)`. Unblocks the last part of M11.
9. Wire the LNI Project Scheduler cross-app sync — both apps already
   share install Dataverse tables; confirm field alignment and add
   change-watcher subscriptions if real-time cross-app refresh is
   needed.

Quality bar for each milestone:

- `npm run typecheck` passes in the production app (`tsc -b --noEmit`).
- All ported engine tests pass (`npm run test`).
- Manual smoke against the prototype side-by-side for the milestone's
  surface. Add screenshots to the Linear comment.
- Production build (`npm run build`) succeeds.

When a milestone is fully wired:

1. Commit on a branch named after the Linear issue (e.g.,
   `alexrsmith0416/ale-79-m1-foundation`).
2. Push the branch.
3. Post a comment on the Linear issue with: what was wired, files
   touched, commit hash, branch name, any deviations from the spec
   (none expected — flag if found).
4. Move the issue status to "In Review" or "Done" per team workflow.

Start by reading the spec, then ask me for the Power Platform
credentials + the BC analytics connector connection string. While
waiting for those, port the engine + UI + stores into the production
codebase scaffold and verify the 46 tests pass against the ported
engine.

Please report back when:
- The spec has been read end-to-end
- You've identified any ambiguities or missing info that I should
  resolve before you start coding
- You have a one-paragraph execution plan for the first milestone
```

---

## Other suggestions to consider before launching the production build

1. **Confirm flow-order assumption.** The prototype shows departments in user-requested top-to-bottom order: Routing → Metal Fab → Paint → Assembly → Vinyl/Graphics → Steel MFG. The cascade engine treats `flowOrder` as a strict dependency (a task at flowOrder N cannot start before flowOrder < N finishes within the same job). If the shop floor doesn't actually run jobs in that exact order, the cascade will misbehave. Walk through with the production team before lock-in.

2. **Pin custom cards.** Today PTO/Holiday/etc. are normal schedule lines that can be cascade-pushed. They probably shouldn't move when an adjacent regular job moves. The simplest change: default `isLocked: true` for preset-created cards (Holiday especially).

3. **Bulk-apply for Holiday.** "Holiday – Shop Closed" hits every employee. The current UI requires one card per employee. Add an "Apply to all employees in this region" checkbox.

4. **Region-scoped scenario sandbox.** Today the scenario store is bound to production only. Install/shipping scenarios won't work until you replace `useScenarioStore` with a per-store factory.

5. **Touch-drag on iOS Safari.** HTML5 drag-and-drop has historically been spotty on iOS. If shop-floor tablets are iPads, plan for a polyfill (e.g., `Sortable.js`).

6. **Print + PDF export.** Foremen will want paper. A `@media print` stylesheet that hides the chrome and prints a clean week view is low-effort and high-impact.

7. **Offline mode for shop wi-fi reliability.** Service worker + IndexedDB cache of the current week. Sync on reconnect. Particularly important for the Time & Photo Capture app in this same Switchboard repo — both might share the same caching layer.

8. **Multi-user real-time sync.** Two ops users editing simultaneously today only see each other's changes after a refresh. Dataverse change-watcher (`subscribe` to a table) wired to `useScheduleStore.loadWeek` would close this gap.

9. **Audit log per line.** "Who moved this and when, and why?" matters for liability. A `crfdf_schedulelinehistory` table + a tail-of-changes panel in `EditJobPanel` would capture this.

10. **AI auto-fill — improve the candidate selection.** Today it sorts by promised date ascending with a per-week soft cap. Real production should respect crew availability per region per day; today the algorithm only enforces billing capacity.

11. **Push notifications.** Past-due alerts, install reschedules — both deserve a push to the crew phone. Power Automate → mobile push is already part of the broader Switchboard architecture (see `docs/01-architecture-overview.md`).

12. **Cycle the `$1,100,000` goal.** It's a constant in `InstallationCalendar.tsx` today. Should be a per-month Dataverse config row so Ops can adjust quarterly without a code deploy.

13. **Performance pass for 100+ employee shops.** The current calendar renders every row eagerly. At Lumineo scale (~20 production + ~20 install) this is fine; if either shop grows materially, virtualize the row rendering.

14. **Accessibility.** Keyboard nav for drag/resize, ARIA labels on the slide-overs, focus management when the cascade dialog opens. The shop floor isn't the primary worry, but Ops users on laptops will appreciate it.

15. **Stress-test the cascade.** The engine's iterative cascade caps at 100 iterations. If a real schedule produces pathological dependency chains, that cap might trip. Add a logged warning when iteration exits without convergence, and consider raising the cap.

---

## How to use this with the existing Linear tracking

Every milestone (M0–M15) in the project already has a "Outstanding (real wiring)" section listing exactly what the production build needs. The prompt above tells the new Claude Code session to read those sections and update each issue as work lands.

Recommended Linear hygiene during the production build:

- Move each milestone from `Backlog` → `In Progress` when you start.
- Comment on the issue when you finish each subtask (e.g., "BC search wired" or "Power SDK adapter complete").
- Move to `In Review` when the production wiring matches the prototype acceptance.
- Move to `Done` after smoke + sign-off.
- If you find a gap in the prototype that the spec didn't capture, add it as a NEW issue (M16+) with a "discovered during production build" label.
