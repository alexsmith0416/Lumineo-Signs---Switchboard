# 16 — Starter Prompt: Production Build of the Scheduling Hub

Copy-paste the prompt below into a new Claude Code session to start building the production Power Code App. The prompt is self-contained — it points at the repo, the working prototype branch, the spec, and the Linear project.

> Recommended setup: in the new session, set the working directory to `Lumineo-Signs---Switchboard` and verify the GitHub + Linear MCP integrations are connected before pasting the prompt.

## What the prototype already does

Before launching the production build, know that the prototype is **substantially complete** as an end-to-end demo. Every screen, every interaction, every business rule below is wired and exercised against mock data. The production work is almost entirely about the I/O boundary (real Power SDK / BC / OpenWeather / LNI / Airtable bridge) — not the UI or the engine.

What's done:

- Three calendar surfaces (Production / Installation / Shipping) with drag-to-move + drag-to-resize, dependency cascade with pre-commit confirmation dialog, sticky resource column + dept color label during horizontal scroll, lane-allocated overlay cards, week navigation with a Today button, brand-red Add Job button, and a 🖨 print button that renders a clean foreman-paper view.
- Installation gets stacked 3-row cards carrying a crew/truck badge, weather chip, and invoice $ amount. Top-bar billing stats. WK ↔ NEK region toggle. Toggleable `$` / 🌤 / crew chips that hide their respective info everywhere when off.
- Scenario Sandbox with kind tabs (Production / Install · WK / Install · NEK / Shipping), each backed by its own `createScenarioStore(dataSource)` instance. Auto-enters on mount. Five change kinds (OT / weekends / shift task / rush job / update duration). Live impact + diff. Embedded read-only calendar preview. Cascade-confirm dialog's "Try in Sandbox" stages into the right store.
- Monthly Install Plan with combined billing roll-up vs `$1.1M` goal, per-week target lines, and an AI auto-fill that respects both dollar headroom and per-region crew availability.
- Custom (non-BC) cards: 7 presets (PTO / Inventory / Truck Maint / Med Cert / DOT / Crane Cert / Holiday-Shop-Closed) all locked-by-default; Holiday auto-applies across the whole roster. Plus a build-your-own form with color pickers, Full Day / Full Week shortcuts, and explicit lock + apply-all checkboxes.
- Cascade-aware drop/resize: any move that would shift downstream tasks pops a modal listing exactly what would shift, grouped by reason (department-flow / employee-queue / knock-on), with four options (Cancel / Move only this / Try in Sandbox / Continue). Affected cards pulse with a red outline behind the modal.
- Mobile responsive layout (portrait phones get a hamburger drawer, horizontally scrolling calendar with sticky left column). iOS touch-drag polyfill (`mobile-drag-drop`) so HTML5 drag works on iPads.
- Accessibility basics: `role="dialog"` / `role="alertdialog"` on the slide-overs, focus trap + Escape close, ARIA labels on navigation buttons.
- 47 engine unit tests pinning capacity walking, business-hour anchoring, cascade purity, locked-task flow-around, conflict detection, and scenario commit patches.

What's stubbed and needs replacement:

- `src/services/dataverse.ts`, `installation-data.ts`, `shipping-data.ts` — mock data sources. Replace with real Power SDK adapters that satisfy `ScheduleDataSource`.
- `src/services/bc.ts` — mock BC catalog. Replace with the BC analytics connector.
- `src/components/WeatherChip.tsx` — `getMockWeather` deterministic hash. Replace with `Lumineo Weather` Power Automate flow.
- `src/services/zip-geo.ts` — inline ZIP table. Replace with `bc_ZipGeo` lookup.
- BC `lumCrewType` purchase line resolution → `CrewAssignment` table (entirely new infrastructure per [docs/10](10-crewtruckindicatorspec.md)).

---

## Copy-paste prompt

```
I'm building the production Lumineo Scheduling Hub — a React/TypeScript
Power Code App that replaces the Canvas Production Scheduling app and
adds two parallel surfaces (Installation, Shipping) plus planning views
(Scenario Sandbox, Monthly Install Plan). A complete prototype with
every interaction wired against mock data already exists on branch
`claude/intelligent-cray-ffmS4` in `scheduling-app/`. Your job is to
convert that prototype into the production app by replacing the mock
data sources with real Power SDK, Dataverse, Business Central,
OpenWeatherMap, and LNI Project Scheduler integrations — without
changing the engine, the UI, or the visual styling.

Read these documents first, in this order:

1. `docs/15-scheduling-app-spec.md` — the full build specification.
   Section "Current prototype state" at the top is the at-a-glance
   summary; sections §1–§12 are the detailed reference. The
   file-by-file map in §11 tells you what to port verbatim vs what
   to replace.
2. `scheduling-app/CLAUDE.md` — the prototype's working notes,
   engine contract, and file structure conventions.
3. `docs/04-dataverse-schema.md` — shared Dataverse tables + BC
   integration shape.
4. `docs/09-weathercardspec.md` — `WeatherCache` table + OpenWeatherMap
   connector design.
5. `docs/10-crewtruckindicatorspec.md` — `CrewAssignment` table + BC
   `lumCrewType` purchase-line resolution.
6. `docs/13-airtable-bridge-mapping.md` — the interim data source.
   Both this app and the production Scheduling app read from a
   Dataverse mirror that Power Automate syncs from Airtable. The
   `ScheduleDataSource` interface in the prototype doesn't change —
   real implementations just point at the Dataverse mirror until BC
   admin access lands.
7. `docs/14-bc-write-operations.md` — payload schemas for the queued
   BC write operations (for when BC access is in place).

Linear is the source of truth for milestones:

- Project: "Lumineo Scheduling Hub" (Alex Smith team).
- M0 through M17 (ALE-79 through ALE-179) capture the build. M0–M5
  are the foundational milestones; M6–M11 added installation, monthly
  plan, scenario polish, and cascade-aware confirms; M12–M15 added
  mobile responsive, hamburger nav, custom cards; M16 is the build
  kickoff issue; M17 captures the production-readiness sweep
  (lockByDefault on presets, apply-all for Holiday, per-region
  scenario stores, iOS touch polyfill, print stylesheet, AI auto-fill
  crew capacity, accessibility, cascade cap).
- Each issue's "What landed in the scaffold" section describes the
  prototype state; the "Outstanding (real wiring)" section is what
  you need to build.
- Update the corresponding Linear issue every time you complete a
  milestone's production wiring. Post a brief comment summarizing
  what was wired up and the commit hash.

Constraints — do not violate any of these:

- The engine code under `scheduling-app/src/engine/` is pure
  TypeScript with only `date-fns` as a dependency. 47 unit tests
  (`src/engine/*.test.ts`, `src/services/*.test.ts`) lock its
  behavior. Copy it verbatim into the production codebase. If a test
  breaks, the engine has regressed — fix the production wiring, not
  the engine.
- The UI components (`src/components/`), styles
  (`src/styles/lumineo.css`), and Zustand stores (`src/store/`) port
  verbatim. The store factories (`createScheduleStore(dataSource)`
  and `createScenarioStore(dataSource)`) are designed exactly so the
  data sources swap out independently.
- The `ScheduleDataSource` interface in `src/services/data-source.ts`
  is the contract for the swap. Implement real Power SDK adapters
  that satisfy this interface; don't change the interface.
- The custom-card preset format (`src/data/custom-card-presets.ts`)
  with `lockByDefault` + `applyAllByDefault` flags is the contract
  for the planned `crfdf_customcardpreset` Dataverse table.
- The mobile-drag-drop polyfill in `src/main.tsx` stays — iOS Safari
  + Android Chrome still need it inside a Code App.
- All visual + interaction behavior must match the prototype. When in
  doubt about UX, open the standalone HTML from the prototype build
  (`npm run build` in `scheduling-app/`, the `dist/` is the artifact)
  and compare side-by-side.

Suggested execution order (highest leverage first):

1. Provision the Power Platform / Dataverse environment with the
   schema additions in spec §4.2. Confirm the Airtable → Dataverse
   sync flow (docs/13) is writing to the same tables. Move
   ALE-79 (M1) to "In Progress" while doing this.
2. Implement the real `productionDataSource` against Power SDK
   (replaces `scheduling-app/src/services/dataverse.ts`). Validate by
   loading + drag/drop committing through a real Dataverse row.
   This unblocks M1–M3 simultaneously since the engine + UI are
   already wired against the data source interface.
3. Implement the real `bcService` against BC analytics connector
   (replaces `scheduling-app/src/services/bc.ts`). Validate by
   opening Add Job and seeing a real BC job appear in the search.
   Unblocks M4.
4. Build `WeatherCache` table + `Lumineo Weather` Power Automate
   flow + `bc_ZipGeo` table import. Replace `getMockWeather` in
   `WeatherChip.tsx` with a call to the flow. Unblocks part of M10.
5. Build `CrewAssignment` table + nightly `RecomputeCrewAssignments`
   flow that reads BC `lumCrewType` purchase lines. Update install
   data sources to populate the crew fields from this table.
   Unblocks the rest of M10.
6. Implement `wkInstallDataSource` and `nekInstallDataSource`
   against real Dataverse views filtered by region. Unblocks
   M6 + M9.
7. Implement `shippingDataSource`. Unblocks M7.
8. Wire `Commit proposal` in `MonthlyPlanView.tsx` to actually
   write the new install lines through the data source instead of
   showing an `alert(...)`. Unblocks the last part of M11.
9. Wire the LNI Project Scheduler cross-app sync — both apps
   already share install Dataverse tables; confirm field alignment
   and add change-watcher subscriptions if real-time cross-app
   refresh is required.

Quality bar for each milestone:

- `npm run typecheck` passes in the production app
  (`tsc -b --noEmit`).
- All 47 ported engine tests pass (`npm run test`).
- Manual smoke against the prototype side-by-side for the
  milestone's surface. Add screenshots to the Linear comment.
- Production build (`npm run build`) succeeds.

When a milestone is fully wired:

1. Commit on a branch named after the Linear issue (e.g.,
   `alexrsmith0416/ale-79-m1-foundation`).
2. Push the branch.
3. Post a comment on the Linear issue with: what was wired, files
   touched, commit hash, branch name, any deviations from the spec
   (none expected — flag if found).
4. Move the issue status to "In Review" or "Done" per team
   workflow.

Start by reading the spec, then ask me for:

- The Power Platform credentials.
- The BC analytics connector connection string (or confirmation
  that the Airtable bridge is the data source for the first pass).
- Confirmation of the production department flow order
  (currently Routing → Metal Fab → Paint → Assembly →
  Vinyl/Graphics → Steel MFG; the cascade engine enforces this
  strictly, so it has to match the real shop floor).

While waiting on those, port the engine + UI + stores into the
production codebase scaffold and verify the 47 tests pass against
the ported engine.

Please report back when:
- The spec has been read end-to-end.
- You've identified any ambiguities or missing info I should
  resolve before you start coding.
- You have a one-paragraph execution plan for the first milestone.
```

---

## Items that already landed in the prototype (don't re-implement)

You don't need to do any of these — the prototype on `claude/intelligent-cray-ffmS4` has them wired. Just verify the production build preserves them.

- **Pin custom cards by default.** All 7 presets carry `lockByDefault: true`. AddJobPanel's custom form has a `🔒 Lock` checkbox that respects the preset and lets the user override per card.
- **Bulk-apply for Holiday.** The Holiday preset auto-checks "Apply to all N resources"; commit loops `addScheduleLine` per employee in the active calendar's roster.
- **Per-region scenario sandboxes.** `createScenarioStore(dataSource)` factory with four instances (Production / Install · WK / Install · NEK / Shipping). `ScenarioSandbox` shows a kind-tab strip and switches the entire UI to the matching store. Cascade dialog's "Try in Sandbox" stages into the right store via the `scenarioStore` prop on `CalendarView`.
- **iOS Safari touch-drag.** `mobile-drag-drop` polyfill wired in `main.tsx` with `forceApply: true`.
- **Print + PDF export.** `@media print` strips chrome and prints a clean 7-day calendar grid; 🖨 toolbar button calls `window.print()`.
- **AI auto-fill respects crew availability.** `autofillToGoal` budgets `5 workdays × crewCount` per region per week alongside the existing dollar headroom check. Rejections name which budget is exhausted.
- **Accessibility basics.** NavDrawer + CascadeConfirmDialog use proper roles, trap Escape, auto-focus first item. ARIA labels on Prev / Next / Print / hamburger.
- **Cascade convergence cap.** `MAX_ITERATIONS = 200` with a `console.warn` when the cap is hit (pathological dependency chain).

## Items deferred to the production build (sketches in spec §9)

These were intentionally deferred during prototype work because they require real infrastructure. Spec §9 has implementation sketches.

- **Offline mode + service worker** — IndexedDB outbox + retry/queue wrapper around the data source.
- **Multi-user real-time sync** — Dataverse `subscribe` events (long-term) or 30s poll against the Airtable mirror (interim).
- **Audit log per line** — `crfdf_schedulelinehistory` table + History tab in EditJobPanel.
- **Virtualize calendar** — `react-window` for employee rows when shops grow past ~75 resources.

## Items intentionally out of scope for the current build phase

- **Push notifications.**
- **Monthly goal as a Dataverse config row.** `MONTHLY_INSTALL_GOAL = 1_100_000` stays a constant in `InstallationCalendar.tsx`; easy to swap to a fetch when needed.

## Worth doing after launch

- **Recurring custom cards** — yearly PTO, monthly inventory.
- **Per-region scenario forms** — today the change-builder forms (Overtime/Weekends/Shift/Rush) still write through `useScenarioStore` (which aliases production). They should accept a `useStore` prop like the rest of the scenario sub-components to fully respect the active tab. Low-effort follow-up after the production build is humming.
- **Keyboard nav for drag/resize.** Today's accessibility wins are around dialogs + ARIA labels; full keyboard scheduling is a larger refactor.

---

## How to use this with the existing Linear tracking

Every milestone (M0–M17) in the project has a "Outstanding (real wiring)" section listing exactly what the production build needs. The prompt above tells the new Claude Code session to read those sections and update each issue as work lands.

Recommended Linear hygiene during the production build:

- Move each milestone from `Backlog` → `In Progress` when you start.
- Comment on the issue when you finish each subtask (e.g., "BC search wired" or "Power SDK adapter complete").
- Move to `In Review` when the production wiring matches the prototype acceptance.
- Move to `Done` after smoke + sign-off.
- If you find a gap in the prototype that the spec didn't capture, add it as a NEW issue (M18+) with a "discovered during production build" label.
