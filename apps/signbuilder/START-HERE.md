# START HERE — Lumineo Sign Builder

**Point Claude at this file first in any new session.** It's the map: what the
Sign Builder is, where everything lives, every connection it depends on, how to
run / commit / deploy it, the rules that keep it healthy, and — at the bottom —
**where we left off** with a recap and suggested next steps.

> Sibling of **Lumineo Switchboard** (`START-HERE.md` at the repo root). Same
> repo, same stack, same Dataverse environment, same conventions. When this file
> says "like Switchboard", the Switchboard START-HERE has the long version.

---

## 1. What this project is

**Lumineo Sign Builder** — a React + TypeScript **Power Apps Code App** where
sales, PMs, artists and estimators spec every sign of a job, step by step, from
the **Opportunity** (core details) to the **Job** (everything needed before the
order is released). From the answers it writes the BC job's **Production
Description** and **Field Description** in the shop's job-ticket format, keeps a
**Spec Code** per sign (find signs built the same way on past jobs), shows the
matching **Sign Specification Reference** page, and lets admins tune every
question / answer / rule / sign type in **Setup**.

History (why it looks the way it does):
- **Vercel prototype** — `https://lumineo-signbuilderpro.vercel.app` (React,
  fixed 14 sign types, no setup screens, no description text). The president
  prefers its look → the app follows its screens (Dashboard hero + KPIs,
  numbered step cards, live code badge, Projects, Gallery → Sign Library).
- **BC extension** "Lumineo Sign Builder" (`C:\Users\Alex\SignBuilderPro\bc\lumineo-signbuilder-ext`,
  v0.11.x, UAT) — where the question engine, Spec Rules, blocks, stages, survey
  handling and description templates were designed and tuned. Its logic is
  ported to `src/engine/`; its setup moves over once via *Export Setup (JSON)*.
  Long term BC keeps only: the description receiver API, job fields for spec
  completeness, the Order Released check, and a Job Card button that opens this app.
- Decided **Oct 15, 2026** (Alex): Dataverse is the master for setup + specs;
  `crfdf_` prefix; reuse Switchboard's user roles; opportunity sync flow; keep
  Ballpark $, Send to Estimating, Draft/Submitted/Approved/Built, Projects,
  Print; BC Production/Field templates carry over with per-answer formatting;
  "Generate to Project" writes descriptions into the BC job (like the extension);
  develop in the dev environment → migrate to production; launched **separately**
  from Switchboard.

## 2. Where everything lives

| Thing | Path |
|-------|------|
| **Repo root** (this worktree) | `C:\Users\Alex\lumineo-signbuilder-app` — branch `claude/sign-builder-app` |
| Switchboard's working copy (same repo, other worktree — **don't touch from here**) | `C:\Users\Alex\lumineo-scheduling-port` |
| **The app** (run app commands from here) | `apps/signbuilder/` |
| This file (the map + session log) | `apps/signbuilder/START-HERE.md` |
| Quick overview | `apps/signbuilder/README.md` |
| Source | `apps/signbuilder/src/` |
| Deploy config (appId, env, buildPath) | `apps/signbuilder/power.config.json` (appId `ab0a4994-727d-4255-b399-efaf864c501a`) |
| Dataverse table scripts | `apps/signbuilder/scripts/*.ps1` |
| **User guide** (in-app Help + send to users — keep updated every change) | `apps/signbuilder/public/USER-GUIDE.html` |
| Interactive tour | `apps/signbuilder/src/components/DemoTutorial.tsx` |
| Demo sandbox data | `apps/signbuilder/src/demo/demo-data.ts` |
| BC extension (AL) | `C:\Users\Alex\SignBuilderPro\bc\lumineo-signbuilder-ext` (not in this repo) |
| Spec reference images (source JPGs) | `C:\Users\Alex\SignBuilderPro\spec_pages` (+ `Spec_Reference_Images.zip`) |
| Original option reference workbook | `C:\Users\Alex\SignBuilderPro\Lumineo_SignBuilder_FullReference_v2.xlsx` |
| Stage checklist (Opportunity vs Job) | `C:\Users\Alex\SignBuilderPro\Sign_Spec_Stage_Checklist.xlsx` |

### Source layout (`apps/signbuilder/src/`)

```
domain/      types.ts — setup + spec model (mirrors the BC extension, + per-answer print text/format)
engine/      pure TS, no React / no I/O — fully unit-tested
             flow.ts          question flow: Spec Rules, Also Requires, stages, next step,
                              sign-type picking (Selected When), allowed answers, Spec Code,
                              reference page, answer normalising (sizes, yes/no, numbers…)
             descriptions.ts  Production / Field / Extended text (BC job-ticket house style)
             setup-index.ts   fast lookups over the setup
             values.ts        rule matching, feet-and-inches parsing/formatting
setup/       import-bc.ts — one-time import of BC's Export Setup (JSON)
services/    repo.ts (mock localStorage | live Dataverse), dataverse-core.ts (dv* writes),
             dv-write.ts (retry policy — from Switchboard), current-user.ts, print.ts
store/       Zustand: setup-store, spec-store, write-status-store (from Switchboard), demo-store
screens/     Dashboard, Builder (+ builder/QuestionCard, ReferencePanel, DescriptionPreview),
             Projects, Library, SetupHome, Help
components/  shell (Sidebar, Topbar, SaveStatus, ConfirmDialog, logo — from Switchboard), ui.tsx,
             DemoBanner, DemoTutorial
styles/      lumineo.css (copied from Switchboard — keep in step) + signbuilder.css (tokens only)
data/        demo-setup.ts — stand-in setup until the BC import
demo/        demo-data.ts — sandbox specs for the demo / tour
generated/   Dataverse connector client (copied from Switchboard; same connector)
```

### ⚠️ Write-path invariant (same as Switchboard — read before touching any save)

- **A failed write NEVER reverts the UI.** Stores call `persistOrReport(label, op)`
  (`store/write-status-store.ts`); the edit stays on screen and `SaveStatus`
  shows the failure with Try again. Never `catch → reload`.
- **Every Dataverse write goes through `dvCreate` / `dvUpdate` / `dvDelete`**
  (`services/dataverse-core.ts`) — 5 attempts, retry anything not positively
  permanent, both returned and thrown failures. Never call the SDK's
  `*RecordWithOrganization` writes directly.
- Bulk reads use `listAll` (follows paging past Dataverse's 5,000-row cap).
- The Power SDK is imported lazily (it needs the Power Apps runtime).

## 3. Connections & data

### Dataverse (system of record)
- Environment **Alex Smith's Environment** — `484cdd3c-4409-e741-bbd5-7c210e00310e`,
  org `https://org8fa22efd.crm.dynamics.com` (Developer env: only owner/admins can
  open apps → Sandbox/Production env before rollout). Tenant `fe0182fa-d183-46ab-8493-9e8ea9c3d0b8`.
- Connector: **Microsoft Dataverse** (`shared_commondataserviceforapps`), plus
  SharePoint (JobFiles) reserved for photos later.
- Tables (prefix `crfdf_`, created by `scripts/create-signbuilder-tables.ps1` — ✅ **created Oct 15, 2026**; entity sets `crfdf_sbsetupdocs`, `crfdf_sbreferences`, `crfdf_sbversions`, `crfdf_sbprojects`, `crfdf_sbspecs`, `crfdf_sbsignlines`):

| Table (entity set) | What | Key columns |
|---|---|---|
| `crfdf_sbsetupdoc` (`crfdf_sbsetupdocs`) | Setup as JSON documents: `core` (sections, categories, settings, checklist, vinyl colors, reference list) + one `type:<CODE>` per sign type / block (questions, answers, Spec Rules, templates, reference rules, blocks used) | `crfdf_name` (doc key), `crfdf_kind`, `crfdf_json` (1 MB) |
| `crfdf_sbreference` | Spec reference pages + images (data: URIs, loaded on view) | `crfdf_name` (code), description, file name, SharePoint URL, thumbnail, full image |
| `crfdf_sbversion` | Setup versions / undo steps | scope, kind, json, created by |
| `crfdf_sbproject` | Projects | name, customer, notes |
| `crfdf_sbspec` | Spec header | number (`crfdf_name`), purpose/status/detail level (ints), opportunity no, job no, project id, customer, contact, design ref, job detail notes, approved by/at |
| `crfdf_sbsignline` | One sign | spec id, line no, category, sign type, qty, **answers JSON**, spec code, reference, type decided, completed % |

- Shared with Switchboard: **`crfdf_appuser`** (login → user type; read-only here),
  later **`crfdf_bcjob`** (BC jobs), **`crfdf_bcpushqueue`** pattern for writes to BC.
- New tables need Read/Write added to the non-admin security role
  (Switchboard's `create-scheduler-user-role.ps1` pattern).

### Business Central
- Tenant above; environments **UAT** (extensions live here) and **Production**;
  company **Luminous Neon**.
- Never call BC from the app — **Power Automate flows** move data both ways
  (Switchboard's model, `BC-CONNECTIONS.md` at the repo root):
  BC → Dataverse staging tables (`BCSync_*`), app → outbox rows → `BCPush_*` flows.
  Flow auth: app registration "PowerApps Permissions" (client credentials;
  secret from `$env:BC_CLIENT_SECRET`, never committed).
- Sign Builder BC extension: object range **58450–58549**, prefix LSB.
  ⚠️ `BC-CONNECTIONS.md` suggests 58450–58499 as the planning extension's next
  block — that collides; the planning extension must use another range.
- Job description fields (Infotech tableext 60200 on Job): **60214 Production
  Description**, **60215 Field Description** (60202 Extended) — Blobs, written
  **MSDos-encoded**. Switchboard reads them via API page 58403 `jobDescriptions`.
- **Order Released** (Boolean on Job, found by caption) is the release gate —
  the extension blocks release while Job-stage answers are blank / Open for
  design and asks about open surveys. Once specs live in Dataverse the push
  writes spec completeness onto the job for that check.
- One-time setup move: BC → *Sign Builder Setup → Export Setup (JSON)* (extension
  v0.11.1, codeunit 58471) → app *Setup → Import from Business Central*.

### Other
- Estimating app: `https://lumineo-estimating.vercel.app` (Send to Estimating, later).
- Spec reference SharePoint folder (default link on every reference):
  `https://luminousneon.sharepoint.com/:f:/s/installationschedule/IgCICY5o8mlOT7c8fCvX5reKAUAU8IBC97OAv05zbg9C2WI?e=ac3S51`
- Launch parameters (from Switchboard tile / BC Job Card / links):
  `?specId=…`, `?jobId=J…`, `?opportunityId=…` → opens (or starts) that spec.

### The real setup (BC export)
- File: `SignBuilderSetup_20261015.json` (exported from UAT Oct 15, 2026, in Alex's
  Downloads). **Not in git** — it's company data and 10 MB (mostly reference images).
- Contents: 11 categories, 32 sign types, 0 blocks, 1,348 questions, 2,641 answers,
  1,108 Spec Rules, 467 Field Description template lines, 64 reference rules,
  30 reference pages, 159 vinyl colors, 125 checklist lines.
- Sizes vs Dataverse's 1 MB multiline limit: largest `type:` doc ≈ 116K chars
  (MON-ROUTED), largest image ≈ 500K chars (ST-22) → fits. **But** a whole-setup
  copy is ≈ 2 MB, so `crfdf_sbversion` must store versions per document (or
  chunked), not as one JSON — design Undo/Versions that way.
- **Import `SignBuilderSetup_20261015_fixed.json`**, not the raw export — it has
  the agreed setup fixes (`scripts/fix-bc-setup-export.mjs`). A fresh re-export
  from BC before go-live must go through the script again:
  `node apps/signbuilder/scripts/fix-bc-setup-export.mjs <export.json> <fixed.json>`.

## 4. Run it locally

```powershell
# from the repo root (worktree) — or from apps/signbuilder: npm run dev / test / build
npm install                    # first time only
npm run dev:signbuilder        # http://localhost:5175 — mock data in localStorage, admin stand-in user
npm run test:signbuilder       # vitest (engine)
npm run typecheck:signbuilder
npm run build:signbuilder      # → apps/signbuilder/dist
```

Mock mode keeps data in the browser (`localStorage` key `signbuilder.mock.v1`;
reference images in IndexedDB `signbuilder.mock.images` because the real ones
don't fit in localStorage — clear both to start over). To run on the real setup,
open Setup → Import and pick the BC export. `VITE_DATA_SOURCE=live` (or a prod
build) uses Dataverse.

**Real-setup check** — answers every sign type in the BC export end to end and
builds both descriptions (skipped unless the file is given):

```powershell
$env:SB_SETUP_FILE="C:\Users\Alex\Downloads\SignBuilderSetup_20261015.json"
$env:SB_SETUP_OUT="C:\temp\sb-desc"   # optional: writes each type's descriptions to review
npm run test:signbuilder
```

A failure here is usually a setup problem (a type no answer can reach, an answer
missing from a type-picking question) — the same thing would happen in BC.

## 5. Commit + deploy

Deploy = **build → push**, from `apps/signbuilder/`:

```powershell
npm run build
$env:NODE_OPTIONS="--use-system-ca"; pac code push
```

> 🔴 **Always `git commit` + `git push` every time you deploy** — `pac code push`
> ships built files only, not source.

- `--use-system-ca` avoids `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- pac profile **`LumineoFoundation-Dev`** (asmith@lumineosigns.com) → `pac auth list`.
- **First deploy — done Oct 15, 2026:** tables created, `pac code push` created the
  app (no `pac code init` needed — the config was already filled in). **Role
  privileges NOT added yet** — only admins can open apps in this Developer env; add
  Read/Create/Write/Delete/Append/AppendTo on the 6 `crfdf_sb*` tables to "Lumineo
  Scheduler User" when moving to a Sandbox/Production env.
- Play link: `https://apps.powerapps.com/play/e/484cdd3c-4409-e741-bbd5-7c210e00310e/app/ab0a4994-727d-4255-b399-efaf864c501a?tenantId=fe0182fa-d183-46ab-8493-9e8ea9c3d0b8`

### Git workflow
- Branch: **`claude/sign-builder-app`** (this worktree). PR base / origin HEAD:
  `claude/master-power-apps-design-05pjY`. Remote `origin` →
  `github.com/alexsmith0416/Lumineo-Signs---Switchboard`.
- Commit and push when Alex asks, and **always after a deploy** and **at the end
  of every session** (with this file's "Where we left off" updated) so the repo
  never falls behind.
- Don't modify Switchboard files (`apps/scheduling`, root `START-HERE.md`) from
  this branch unless the change is deliberately shared.

## 6. Keep things current (do these as part of every change)

### 🔴 This file
- **End of every session:** rewrite **"Where we left off"** (recap, what's done,
  what's next, suggestions) and add a dated entry to the **Session log**.
- New connection, table, flow, ID, URL or decision → add it to §3 the same day.

### 🔴 User guide — `public/USER-GUIDE.html` (audit at session START + every change)
Same rule as Switchboard:
1. At session start: `git log --oneline -25`, compare with the guide **body**
   (Features, Walkthroughs, Roles, Glossary…); fix drift first.
2. Any user-facing change: update the **body** section(s) that teach it (a
   What's New row alone is not enough), add a dated **What's New** row (newest
   first), bump the footer version/date on a meaningful revision.
3. Preview by opening the file in a browser; it prints cleanly to PDF. In the app
   it's under **Help** (embedded + Open in new tab + Download PDF).

### 🔴 Interactive tour — `src/components/DemoTutorial.tsx`
Help → **▶ Launch demo & tutorial** (and every Demo-type login) opens the
sandbox (in-memory copy of the setup + sample specs; nothing saved) and the tour.
- A **significant** new feature (screen, panel, toolbar button, workflow) gets a
  step in `FULL_STEPS` in the same change: add a `data-tour="…"` to the real
  control, point the step's `target` at it, `view` = the screen, `placement` so
  the card doesn't cover it, 2–3 plain sentences.
- Mention new tour coverage in the guide's What's New row.

### Tests
- Engine logic changes → add/adjust cases in `src/engine/*.test.ts`.

## 7. User roles & access

Roles come from Switchboard's **`crfdf_appuser`** table (Settings → Users in
Switchboard) — one place for both apps. `src/services/current-user.ts`:

| User type | Specs | Approve | Setup | Generate to Project |
|---|---|---|---|---|
| admin, developer | edit | ✓ | ✓ | ✓ |
| ops | edit | ✓ | — | ✓ |
| pm | edit | — | — | ✓ |
| sales | edit (opportunity level) | — | — | — |
| production | edit | — | — | — |
| install-wk / install-nek | view | — | — | — |
| demo | sandbox only | — | — | — |

Logins not in the table are treated as **sales**. Dev mode = admin stand-in.

## 8. Pick up where I left off

At the start of a session:

```powershell
cd C:\Users\Alex\lumineo-signbuilder-app
git status; git branch --show-current; git log --oneline -10
```

Then read **Where we left off** below, audit the user guide (§6), and continue.

### 🔖 Where we left off (keep this current — rewrite at the END of each session)

**Last session: Oct 15, 2026 — real setup imported from BC + checked end to end.**

**Recap (latest)**
- Alex exported the setup from BC UAT (v0.11.1 Export Setup JSON). Imported it in
  the browser: all 11 categories show; Channel Letters → New → Front lit picks the
  type, fills defaults, builds `CL-FL-EXT-WH` and shows reference ST-12 (image
  survives a reload).
- Dev mock now keeps reference images in IndexedDB (10 MB didn't fit in
  localStorage); the demo sandbox borrows images from the real store.
- New `src/engine/real-setup.test.ts`: answers every sign type and builds both
  descriptions. **28 of 32 types pass**; the descriptions match the BC
  job-ticket format.
- ✅ **Setup problems found and fixed** (Alex agreed) with
  `scripts/fix-bc-setup-export.mjs` → `SignBuilderSetup_20261015_fixed.json`
  (Downloads), imported into the dev app. Now **30 of 30 active types pass**:
  - **Monument** — "Construction" (BUILD) offered only *Single cabinet*, so
    MON-DIR / MON-ROUTED were unreachable → added *Directional* and *Pole cover
    / reveal / topper (routed faces)* to BUILD on all 4 monument types.
  - **Wall Cabinet** — WALL-CAB-NI Selected When → `LIT=No; WORK=New cabinet`
    (was the lighted type's); **WALL-CAB-I/I** (duplicate of WALL-CAB-LIT) and
    **WALL-CAB-N/I** (3-question stub) **deactivated**, not deleted.
  - ⚠️ **BC UAT still has the old setup.** Import the `_fixed` file (not the raw
    export) when the tables exist; a fresh re-export must go through the
    script again.
- Setup → Import is blocked while the demo sandbox is open (it only replaced
  the sandbox's copy — found when the demo was open during testing).

**Earlier the same day**
- Created `apps/signbuilder` (worktree branch `claude/sign-builder-app`): shell
  matching Switchboard, data model, engine ported from the BC extension
  (7 tests passing), Dashboard / Builder / Projects / Sign Library / Setup
  (import) / Help, mock + live (Dataverse) storage, table-creation script.
- Browser-tested in mock mode: category → Quantity → Lighted? → New cabinet
  picks the type; auto-scroll to the next question + "new" tags; live Spec Code;
  feet/inches sizes; answer-limiting rules ("limited"); Production Description
  in the BC format.
- BC extension v0.11.1: **Export Setup (JSON)** for the one-time move.
- Added this START-HERE, the User Guide (v0.1), demo sandbox + guided tour.

**Not done yet / waiting on Alex**
- ✅ Tables created (Oct 15).
- ✅ First deploy (Oct 15) — app `ab0a4994-…`.
- ⏳ **Setup → Import `SignBuilderSetup_20261015_fixed.json` in the deployed app** (live Dataverse is empty until then).
- ✅ BC v0.11.1 published to UAT, setup exported and imported (Oct 15).
- ✅ Monument / Wall Cabinet setup problems fixed (in the `_fixed` file).

**Next (in order)**
1. **Setup tools**: Categories, Sign Types (Selected When, Duplicate), Decision
   Tree, Show Path, Spec Rule Matrix, Question Blocks, Copy/Paste, Undo &
   Versions, Test Category, Check Setup, Stage Checklist, Spec References
   (import images), Vinyl Colors — plus editing **per-answer print text / format**.
2. **BC link**: opportunity sync flow (BC → Dataverse), job picker from
   `crfdf_bcjob`, **Generate to Project** (side-by-side review → push queue row
   → BCPush flow → writable API page in the BC extension writes 60214 / 60215
   MSDos + spec completeness for the Order Released check), Job Card button →
   app with `?jobId=`.
3. Ballpark $ + Send to Estimating, photos per sign (SharePoint JobFiles),
   mobile nav drawer, Switchboard App Launcher tile.

**Suggestions**
- Import the fixed setup in the deployed app, spec a sign or two, then start
  the Setup tools (Check Setup + Sign Types first).
- Build **Check Setup** early in the Setup tools: it would have flagged the
  unreachable sign types automatically (the real-setup check is the start of it).
- Undo/Versions: store per document (a whole-setup copy is ~2 MB, over the
  1 MB column limit — see §3 "The real setup").
- Decide early whether the dev environment's apps can be opened by the people
  testing (Developer env = owner/admins only) — a Sandbox env avoids surprises.
- Keep the BC extension in UAT read-only for specs once the app is live, so
  there's one place to edit.

### Session log (newest first)

- **Oct 15, 2026 (deploy)** — Created the 6 `crfdf_sb*` tables (Alex ran the script
  here with device-code sign-in) and pushed the app: `ab0a4994-727d-4255-b399-efaf864c501a`.
  Darker outlines (Switchboard `--grid-line`). Role privileges deferred to the env move.
- **Oct 15, 2026 (later)** — Imported the real BC setup export (11 categories,
  32 types, 1,348 questions). Mock images → IndexedDB. Added the real-setup
  check (28/32 types passed). Fixed the setup (Monument BUILD answers, Wall
  Cabinet Selected When, 2 old types deactivated) via
  `scripts/fix-bc-setup-export.mjs` → 30/30 pass. Import blocked in demo mode.
- **Oct 15, 2026** — Planned the move from the BC extension to a Power Apps code
  app (Alex's answers: repo = Switchboard monorepo, Dataverse master, `crfdf_`,
  opportunity sync, reuse roles, keep prototype extras + BC templates with
  per-answer formatting, launch separately). Built Step 1 + START-HERE + User
  Guide v0.1 + demo/tour. BC extension v0.11.1 (Export Setup JSON).
- **Oct 13–15, 2026** — (BC extension era) categories + first questions picking
  the type, Spec Rules + Rule Matrix, blocks, undo/versions, Show Path, Check
  Setup, survey/design answers, Order Released gate, spec reference viewer (PDF),
  Hide Answered default. See the extension's history in `bc/lumineo-signbuilder-ext`.
