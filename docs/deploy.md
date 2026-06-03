# Deploying Sign Builder Pro

Two deployment targets, depending on what you need:

- **Vercel (prototype URL)** — for sharing a link with stakeholders, demoing,
  and wiring the Switchboard launcher tile. Static hosting, no Dataverse, runs
  on the localStorage fallback. See [§ Vercel](#vercel-prototype-url) below.
- **Power Apps Code app (tenant deployment)** — production target, connects to
  the real `lum_signspecification` + `lum_signproject` Dataverse tables. See
  [§ Power Apps](#power-apps) further down.

## Vercel (prototype URL)

A `vercel.json` is checked in at the repo root, so Vercel auto-detects the
build commands without any dashboard config.

**One-time setup:**

1. Go to <https://vercel.com/new> → **Import Git Repository** → select
   `alexsmith0416/Lumineo-Signs---Switchboard`.
2. Leave every field on its default — `vercel.json` already specifies the
   install command (`cd app && npm ci`), build command (`cd app && npm run
   build`), and output directory (`app/dist`).
3. **Production Branch:** `claude/sign-builder-power-apps-sASaA` (or whichever
   branch you want as the canonical prototype).
4. Click **Deploy**. ~60 seconds later you get a URL like
   `sign-builder-pro-<hash>.vercel.app`.

Every push to the production branch redeploys automatically. Preview
deployments are created for other branches too — handy for reviewing the
mobile-baseline fallback or the launcher-wiring branch side-by-side.

**Wiring the Switchboard launcher tile:**

Once you have the Vercel URL, swap it into
`prototype/src/data/mockData.ts` on the
`claude/switchboard-wire-sign-builder-pro-tile` branch:

```diff
- launchUrl: "https://sign-builder-pro-preview.vercel.app/",
+ launchUrl: "https://sign-builder-pro-<hash>.vercel.app/",
```

Then clicking the ✏️ Sign Builder Pro tile in Switchboard navigates to your
Vercel-hosted prototype with `?userEmail=&role=` appended.

## Power Apps

This is the end-to-end checklist for taking the React app on
`claude/sign-builder-power-apps-sASaA` and standing it up as a Power
Apps Code app inside the Lumineo tenant.

## 0. One-time tenant prep

Done once per environment.

1. **Power Apps Developer CLI** — install `pac`:
   ```bash
   # Windows / macOS / Linux
   dotnet tool install --global Microsoft.PowerApps.CLI.Tool
   pac --version
   ```

2. **Authenticate against the Lumineo tenant:**
   ```bash
   pac auth create --environment "<your environment URL>"
   pac org who
   ```

3. **Create the Dataverse tables.** Two tables are required — pull the
   exact column definitions from `docs/dataverse-schema.md`:

   - `lum_signspecification` (31 columns) — primary table the app reads
     and writes.
   - `lum_signproject` (4 columns: `lum_name`, `lum_customername`,
     `lum_notes`, `lum_createdat`) — sibling table that owns project
     metadata.

   Enable **Change tracking** on both tables. The Power Apps SDK uses
   change tracking to keep the in-app cache fresh.

4. **(Optional) Confirm SharePoint access** — the spec reference modal
   ships with bundled JPEGs from
   `https://luminousneon.sharepoint.com/:f:/s/installationschedule/IgCICY5o8mlOT7c8fCvX5reKAUAU8IBC97OAv05zbg9C2WI`
   so the deployed app doesn't depend on SharePoint reachability for
   the images themselves. The "Open in SharePoint" link inside the
   modal still points back at this folder for the editable master.

## 1. Build the bundle

```bash
git checkout claude/sign-builder-power-apps-sASaA
cd app
npm install
npm run typecheck    # tsc -b --noEmit
npm test             # vitest run — 32 tests
npm run build        # tsc -b && vite build → dist/
```

After `npm run build`:

```
dist/
  index.html
  assets/index-<hash>.js   (~227 KB, ~70 KB gzipped)
  assets/index-<hash>.css  (~24 KB, ~5 KB gzipped)
  spec-images/             (30 reference JPEGs, ~6.5 MB)
```

CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every
push so any regression on this branch flags before deploy.

## 2. Bind the bundle to a Power Apps Code app

```bash
cd app
# If this is the first push and power.config.json has not been picked
# up by an existing solution:
pac code init --displayName "Sign Builder Pro"
```

`power.config.json` already declares both table aliases the React code
expects at runtime:

```json
{
  "tables": [
    { "logicalName": "lum_signspecification", "alias": "SignSpecifications" },
    { "logicalName": "lum_signproject",       "alias": "SignProjects" }
  ],
  "launchParams": ["userEmail", "role"]
}
```

If `pac code init` regenerates the file, merge these entries back in.

## 3. Push and run

```bash
pac code push           # uploads dist/ to the tenant
pac code run            # opens the hosted app
```

## 4. Verify in the tenant

Smoke checklist — what to click through after `pac code run`:

- [ ] Dashboard hero shows "Build. Spec. Deliver." headline and the two
      CTA buttons.
- [ ] **Dev / Dataverse pill** — header badge should read solid amber
      "Dev · localStorage" until the SDK is hooked up. Once the
      published bundle is running inside the host with PowerProvider
      injected, the pill disappears (production state).
- [ ] **Projects screen** — left rail lists projects from
      `lum_signproject`. Click into one, see its signs in the right
      pane.
- [ ] **Builder cascade** — pick "Wall Sign", walk through Faces →
      Illumination → LED Color → Face Type → Vinyl. Spec code in the
      header updates live.
- [ ] **Vinyl color search** — type "blue" in the swatch search,
      grid filters.
- [ ] **Spec reference modal** — click the thumbnail under any cabinet
      face type, full-screen image opens.
- [ ] **Save Spec** — Save button persists to `lum_signspecification`.
      Refresh the page; the spec re-loads via the launch param
      `?specId=<id>` if linked from elsewhere.
- [ ] **Mobile** — open the published URL on a phone. Hamburger menu
      replaces the inline nav, Builder shows the fixed bottom action
      bar, Gallery rows reveal Duplicate / Delete on swipe-left.

## 5. Switchboard launcher integration

Per `docs/07-sub-apps.md`, the Switchboard tile launches sub-apps with
`{ userEmail, role }` URL params. The Builder additionally accepts
`?specId=<guid>` to deep-link into editing a specific spec — useful
for the Project Scheduler "Sign Specs" tab.

Example launch URL from Switchboard:

```
https://<tenant>.powerapps.com/play/.../sign-builder-pro/#/builder?userEmail=alex@lumineosigns.com&role=Operations&specId=abc123
```

The HashRouter inside the app reads launch params from after the `#/`
segment.

## 6. Rollback

The polished tip is `claude/sign-builder-power-apps-sASaA` (commit
`19a9f7e`). The pre-polish baseline (no hamburger menu, no swipe rows,
no bottom action bar — just the responsive layout from the prior
round) lives at `claude/sign-builder-power-apps-sASaA-mobile-baseline`
(`72b38ab`).

To roll back to the baseline and re-deploy:

```bash
git checkout claude/sign-builder-power-apps-sASaA-mobile-baseline
cd app
npm install && npm run build
pac code push
```

## Known gaps

- **Manual QA pass** (ALE-53) — automated tests cover the cascade and
  product code rules; full hardware testing across breakpoints +
  spec-type matrix still pending.
- **Per-app SharePoint URLs for spec images** — the modal currently
  links the shared folder; per-file tenant URLs aren't pinned because
  tenant URLs vary by Lumineo's SharePoint config. The bundled JPEGs
  cover the rendering.
- **Role-switcher dropdown body** — the trigger card is wired but the
  popover menu (matching Switchboard's roleswitcher-menu) is a
  follow-up; only the visual was needed for Switchboard fleet parity.
