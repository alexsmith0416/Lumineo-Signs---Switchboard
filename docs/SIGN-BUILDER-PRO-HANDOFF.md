# Sign Builder Pro — Session Handoff

> **Purpose:** pick up exactly where the last session ended. This captures the
> current state, the branch map, what's done, what's pending, and how to verify.
> Last updated at commit `e51c39e`.

---

## TL;DR

Sign Builder Pro is a **React + Vite + TypeScript Power Apps Code app** that
replaces the manual sign-spec process at Lumineo Signs. It is feature-complete
as a runnable prototype: full 12-step cascade, real-time product code, vinyl
swatches, spec reference images, Projects, light/dark design system, mobile
layout, an Estimating handoff, and ft+in dimension inputs. It runs today on a
localStorage fallback; the Dataverse adapter activates automatically inside the
Power Apps host.

- **Working branch:** `claude/sign-builder-power-apps-sASaA` (tip `e51c39e`)
- **App lives in:** `app/` (its own Vite project; NOT the monorepo `apps/`)
- **Tests:** 70 passing (`cd app && npm test`)
- **Build:** clean (`cd app && npm run build`)
- **Deploy:** Vercel (config checked in) or `pac code push` — see `docs/deploy.md`

---

## Branch map (all on `alexsmith0416/lumineo-signs---switchboard`)

| Branch | Tip | What it is |
| --- | --- | --- |
| `claude/sign-builder-power-apps-sASaA` | `e51c39e` | **The Sign Builder Pro app — primary working branch.** |
| `claude/sign-builder-power-apps-sASaA-mobile-baseline` | `72b38ab` | Pre-polish fallback (no hamburger / swipe / bottom-bar). Roll back here if the mobile polish ever needs reverting. |
| `claude/switchboard-wire-sign-builder-pro-tile` | `0211088` | Switchboard launcher wiring — the SBP tile opens the hosted app with `?userEmail=&role=`. Off `claude/master-power-apps-design-05pjY`. Open a PR into that branch when ready. |
| `claude/estimating-app` | (user's) | The **Estimating** Power Apps Code app (a monorepo at repo root: `apps/estimating`, `packages/ui`). Built by the user. |
| `claude/estimating-app-sbp-import-reader` | `c2a8df8` | Estimating-side reader for the SBP→Estimating handoff. Off `claude/estimating-app`. **Ready to merge** — built + 60 tests pass in the monorepo. |

> ⚠️ **Two different repo layouts coexist.** The Sign Builder Pro branch keeps the
> app in `app/` (single Vite project). The Estimating branch is a workspaces
> monorepo (`apps/estimating`, `packages/ui`) at the repo root. Don't confuse
> `app/` (SBP) with `apps/` (monorepo).

---

## Where things live (on the SBP branch)

```
app/
  src/
    main.tsx                      entry; bootstraps theme before first paint
    app/
      App.tsx                     shell: Sidebar + Topbar + routed content
      SpecContext.tsx             ALL spec state + cascade + save/approve/export/estimating
      launchParams.ts             useLaunchParams() + isOps() — reads ?userEmail/role/specId/jobId/opportunityId
      app.css                     screen-specific styles
    ui/
      lumineo-ui.css              design tokens (light/dark) + shell/primitive CSS
      useTheme.ts                 light/dark hook (localStorage + prefers-color-scheme)
      icons.tsx                   inline SVG icon set
      Sidebar.tsx                 248px nav rail + theme toggle
      Topbar.tsx                  breadcrumb + title + search + user chip
      DimensionInput.tsx          paired ft + in textbox (writes total inches)
      RayMark.tsx, Pill.tsx, Banner.tsx, specStatus.ts, HamburgerMenu.tsx, SwipeRow.tsx
    screens/
      Dashboard.tsx  Builder.tsx  Projects.tsx  Gallery.tsx  Reports.tsx
    builder/
      SpecSummary.tsx  SpecReferenceImage.tsx  BallparkModal.tsx
      steps/Step1SignType … Step12Electrical, Step1bFabrication, Step6bRoutedBacker, StepNotesStatus
    domain/
      SignSpec.ts                 the spec model + emptySignSpec()
      signTypes.ts                14 sign-type catalog + helpers
      productCode.ts              assembleProductCode() + calculateDepartments()
      vinylSwatches.ts            3M 3630 + 7725 grids + search
      specReferenceImage.ts       (signType,faces,illum,faceType) → bundled image
      dimensions.ts               splitFtIn / joinFtIn / formatDimension / formatHWD
      Project.ts                  Project model
      estimateMapping.ts          SignSpec → Estimating Piece[] (v2 contract)
      ballpark.ts                 local rough-price calculator
      *.test.ts                   vitest suites (70 tests total)
    data/
      dataverseService.ts         SignSpecRepo interface + localStorage fallback
      dataverseAdapter.ts         runtime-detects window.PowerProvider; maps SignSpec↔lum_signspecification
      projectRepo.ts  projectAdapter.ts   same pattern for lum_signproject
      powerProvider.ts            shared SDK type
      estimatingService.ts        buildEstimatingPayload/Url + sendSpecToEstimating
      seed.ts                     dev seed data
  public/spec-images/             30 bundled SharePoint spec-page JPEGs
  power.config.json               Dataverse table bindings + launchParams
  vite.config.ts  tsconfig*.json  package.json
docs/
  deploy.md                       Vercel + pac code push workflow
  dataverse-schema.md             lum_signspecification (35 cols) + lum_signproject (4 cols)
  estimating-integration.md       SBP↔Estimating contract (v2) — canonical
vercel.json                       one-click Vercel import config
.github/workflows/ci.yml          typecheck + test + build on push
```

---

## What's DONE

**Core builder**
- 12-step cascade (Step1 SignType → Step12 Electrical) with full cascade-reset on every parent change
- Real-time product code assembly + department routing (pure functions, tested)
- Custom→free-text option on Steps 6 (Face Type), 6B (Backer), 7 (Finish), 9 (Mounting)
- Vinyl swatch grids: 3M 3630 Translucent + 7725 Opaque, with color search; swaps on illumination
- Spec reference image: 30 bundled SharePoint pages, `(signType,faces,illum,faceType)` lookup, full-screen modal
- COPY (2s confirm), Export Spec HTML printout, Save, Clear, draft auto-save to localStorage

**Dimensions**
- Height/Width/Depth (Step 3) + Footing Depth (Step 11) use **paired ft + in textboxes**
- Storage stays as total-inches strings; `dimensions.ts` helpers convert. Export reads `3'0" × 10'0"`.

**Projects + Gallery**
- Projects = named bundles of signs (sibling `lum_signproject` table). Rail + detail pane.
- Gallery: 4-axis filter (search + sign type + status + customer), swipe-to-reveal row actions, duplicate/delete

**Cross-app**
- Launch contract: reads `?userEmail`, `?role`, `?specId`, `?jobId`, `?opportunityId` (after the hash; HashRouter)
- Ops-only **Approve** action (gated on `isOps(launch)`) — sets status + records approver email + timestamp
- **Estimating handoff (v2):** `$ Ballpark` modal (local rough price) + `→ Send to Estimating` button
  - Opens `${estimatingUrl}#import?payload=<base64url-json>` in a new tab
  - `estimateMapping.ts` emits Estimating's real `Piece` shape (kebab-case `typeId`, per-piece-type `inputs`)
  - **Estimating side already reads it** — `claude/estimating-app-sbp-import-reader`, 60 tests pass in the monorepo

**Design system (matches docs/DESIGN.md — the Figma source of truth)**
- 248px indigo sidebar (MAIN/OTHER), Topbar (breadcrumb + title + search + user chip)
- Full light/dark theming via CSS custom properties + theme-toggle pill; Open Sans
- All components token-driven; flat (borders over shadows)

**Mobile**
- Hamburger drawer below 900px, fixed bottom action bar in Builder, swipe rows in Gallery

**Infra**
- Dataverse adapter auto-detects `window.PowerProvider`; localStorage fallback for dev
- `power.config.json` declares both tables; CI runs typecheck+test+build; `vercel.json` for one-click deploy

**Linear** (project `Sign Builder Pro — Power Apps Code App`, team Alex Smith / ALE)
- Project moved to In Progress; 22 issues (ALE-31…ALE-52) moved to In Review; ALE-53 (QA) still Backlog
- ALE-244 (Estimating import) has the full contract + both-branch status posted as comments

---

## What's PENDING / next steps

1. **Merge the Estimating reader.** `claude/estimating-app-sbp-import-reader` (`c2a8df8`) is verified — merge into `claude/estimating-app`. Once both apps deploy, set `window.LUMINEO_ESTIMATING_URL` to the real Estimating URL (one constant; default is `https://estimating.lumineosigns.com/`).
2. **Reverse-direction link (offered, not yet built):** an "Open in Sign Builder Pro" button on imported Estimating projects → `https://signbuilderpro.lumineosigns.com/#/builder?specId=<id>`. SBP already reads `?specId`. Closes the loop both ways.
3. **Deploy to Vercel.** Import the repo, set production branch to `claude/sign-builder-power-apps-sASaA`, Deploy. `vercel.json` auto-configures `cd app && npm run build` → `app/dist`. (Vercel's New-Project screen can't pick a non-default branch; deploy first, then set the branch in Project Settings → Git, then redeploy.)
4. **Tenant deploy (`pac code push`).** Needs the two Dataverse tables created first (`docs/dataverse-schema.md`): `lum_signspecification` + `lum_signproject`. Then `cd app && npm run build && pac code push`.
5. **ALE-53 QA pass.** Manual hardware testing across breakpoints + the full sign-type matrix — still Backlog.
6. **Switchboard tile URL.** After Vercel/tenant deploy, swap the placeholder URL in `prototype/src/data/mockData.ts` on `claude/switchboard-wire-sign-builder-pro-tile` for the real hosted URL, then PR into `claude/master-power-apps-design-05pjY`.

**Known deferred (need platform / info):**
- BC catalog BOM picker, PDF via Power Automate, `Photo` table writes, `postMessage` events back to Switchboard — all wait on Business Central / the host.
- Real per-file SharePoint image URLs — modal currently links the folder share; bundled JPEGs cover rendering.
- Cast Aluminum (CA) + Formed Plastic (PL) letter types map to Estimating `freeform-tm` (no exact piece type in the registry yet).

---

## How to verify quickly (start of next session)

```bash
# from repo root
git checkout claude/sign-builder-power-apps-sASaA
git pull origin claude/sign-builder-power-apps-sASaA      # ensure at e51c39e or later

cd app
npm install
npm run typecheck     # tsc -b --noEmit — clean
npm test              # vitest — 70 passing
npm run build         # → app/dist
npm run dev           # http://localhost:5173

# Try the cross-app + theme:
#   /#/builder?specId=seed-wc-1&userEmail=alex@lumineosigns.com&role=Operations
#   toggle light/dark from the bottom-left sidebar pill
#   pick a sign type + dimensions → "$ Ballpark" → "Send to Estimating"
```

To verify the Estimating reader (different branch, monorepo layout):
```bash
git checkout claude/estimating-app-sbp-import-reader
npm install
npm run build:estimating      # tsc + vite, clean
npm run test:estimating       # 60 passing (incl. src/__tests__/sbp-payload.test.ts)
```

---

## Key contracts to remember

- **Dimensions:** stored as total-inches strings on `SignSpec`; UI shows ft+in via `DimensionInput`. Helpers in `domain/dimensions.ts`. Handoff sends inches as **numbers** (`Number(...)`) so Estimating's `num()` reads them.
- **Estimating payload:** **v2**, `ESTIMATING_PAYLOAD_VERSION` in `data/estimatingService.ts`. Shape mirrors Estimating's `Piece` (kebab-case `typeId` from its `PIECE_TYPES` registry + per-piece-type `inputs` keys). Full map in `docs/estimating-integration.md`. Bump the version if the shape changes.
- **Launch params:** live AFTER the hash (HashRouter), e.g. `app/#/builder?specId=...`. Switchboard appends `?userEmail=&role=`.
- **Dataverse adapter:** lazy — resolves the active repo on first call (a TDZ fix; do NOT move it back to eager module-init, that crashed prod — see commit `547be3d`).
- **CSS:** consolidate responsive media queries at the BOTTOM of `app.css` so source-order cascade lets `display:none` win on mobile (learned the hard way; see commit history).

---

## Recent commit trail (newest first, SBP branch)

```
e51c39e  Align SBP → Estimating contract with the actual Estimating app (v2)
dff88de  Dimension inputs split into paired ft + in textboxes
2f758ac  Sign Builder Pro → Estimating handoff (ALE-244)
abd30f0  Adopt Lumineo Switchboard Design System (light + dark)
02eaed3  Add vercel.json for one-click prototype deployment
35e12e4  Align with docs/07-sub-apps.md launch + approval contract
a06cbae  Lock down deployment readiness — docs/deploy.md
19a9f7e  Mobile polish: hamburger, swipe rows, bottom action bar
72b38ab  Match original Preview wording + real mobile layout  ← mobile-baseline branch point
15320af  Rework header to navy bar with ray-mark logo
547be3d  Fix TDZ ReferenceError in the production data adapters
d931258  Merge: add Projects entity + sign name + Custom-text dropdowns
```
