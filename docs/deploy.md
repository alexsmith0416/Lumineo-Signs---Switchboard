# Deploying the connected apps (Estimating + Sign Builder Pro)

This repo is an npm-workspaces monorepo with two deployable web apps that
work in tandem:

| App | Path | Build output |
| --- | --- | --- |
| **Estimating** | `apps/estimating` | `apps/estimating/dist` |
| **Sign Builder Pro** | `apps/sign-builder` | `apps/sign-builder/dist` |

The connection is a **URL handoff** — no shared backend required:

- **Sign Builder Pro → Estimating:** the Builder's *→ Send to Estimating*
  button opens `${ESTIMATING_URL}#import?payload=<base64url-json>` in a new
  tab. The Estimating app reads the payload on load (and on `hashchange`),
  creates a pre-filled estimate, and clears the hash.
- **Estimating → Sign Builder Pro:** after an import, Estimating shows an
  *Open original in Sign Builder Pro* link to
  `${SIGN_BUILDER_URL}#/builder?specId=<id>`.

So each app only needs to know the **other app's base URL**. That is set per
deploy with one environment variable each.

## The two connection variables

| App / Vercel project | Env var | Value |
| --- | --- | --- |
| Sign Builder Pro | `VITE_ESTIMATING_URL` | the deployed Estimating URL, e.g. `https://lumineo-estimating.vercel.app/` |
| Estimating | `VITE_SIGN_BUILDER_URL` | the deployed Sign Builder Pro URL, e.g. `https://lumineo-sign-builder.vercel.app/` |

Resolution precedence in both apps (so you can repoint without a rebuild):
1. `window.LUMINEO_ESTIMATING_URL` / `window.LUMINEO_SIGN_BUILDER_URL` (runtime, e.g. set in `index.html`)
2. the `VITE_*` build-time env above
3. the `*.lumineosigns.com` production default

> The URLs are only known **after** the first deploy, so it's a chicken/egg:
> deploy both once (defaults are fine), copy each project's URL, set the two
> env vars, then redeploy. After that they stay wired.

## Deploy to Vercel (recommended for shared testing)

You create **two Vercel projects** from the **same GitHub repo**, each
pointed at one app folder. A `vercel.json` is committed in each app folder
with the right install/build/output settings, so there's almost nothing to
configure in the dashboard.

### Project 1 — Estimating

1. <https://vercel.com/new> → **Import** `alexsmith0416/Lumineo-Signs---Switchboard`.
2. **Root Directory:** `apps/estimating`.
   - Expand **Root Directory** and **enable "Include source files outside of
     the Root Directory in the Build Step"** — the build installs the whole
     workspace from the repo root (`cd ../.. && npm install`).
3. **Production Branch:** `claude/confident-brown-epakq0` (or whatever you
   merge this into, e.g. `main`).
4. **Deploy.** You'll get a URL like `https://<name>.vercel.app/`.

### Project 2 — Sign Builder Pro

Repeat the import with **Root Directory:** `apps/sign-builder` (same
"include files outside root" toggle, same production branch).

### Project 3 — Wind Load Calculator

Repeat the import with **Root Directory:** `apps/wind-load` (same
"include files outside root" toggle; production branch
`claude/wind-load-calculator-app-y8basr` until it's merged). This app is
standalone — no connection env vars needed, so one deploy and it's done.

### Wire them together

1. In the **Sign Builder Pro** project → Settings → Environment Variables, add
   `VITE_ESTIMATING_URL` = the Estimating project's URL.
2. In the **Estimating** project → add `VITE_SIGN_BUILDER_URL` = the Sign
   Builder Pro project's URL.
3. **Redeploy both** (Deployments → ⋯ → Redeploy) so the new env bakes in.

Done — share the two URLs. Anyone can open Sign Builder Pro, build a sign,
click *Send to Estimating*, and land in the Estimating app with the pieces
pre-filled. Both are static SPAs, so they run on the localStorage fallback
(no login / Dataverse needed for testing).

> Netlify/Cloudflare Pages work the same way: two sites, base/build dir =
> the app folder, build command `cd ../.. && npm install && npm run
> build:estimating` (resp. `build:sign-builder`), publish dir
> `apps/<app>/dist`, and the same two env vars.

## Verify the connection locally first (optional)

```bash
npm install

# Build each app pointed at where the OTHER one will run locally:
VITE_SIGN_BUILDER_URL="http://127.0.0.1:4801/" npm run build:estimating
VITE_ESTIMATING_URL="http://127.0.0.1:4802/"   npm run build:sign-builder

# Serve them (two terminals):
npm run preview --workspace apps/estimating   -- --port 4802
npm run preview --workspace apps/sign-builder -- --port 4801
```

Open <http://127.0.0.1:4801/#/builder>, pick a sign type, click *→ Send to
Estimating* — a new tab opens on `:4802` with the imported estimate and a
link back to `:4801`.

For day-to-day development just run `npm run dev:estimating` /
`npm run dev:sign-builder` (Vite dev servers); set the env vars in a
`.env.local` in the app folder if you want the cross-links to point at your
dev ports.

## Power Apps (tenant) deployment

Both apps are also Power Apps Code apps (`power.config.json` committed in
each). The end-to-end `pac code init/push/run` checklist for Sign Builder
Pro is in [`docs/SIGN-BUILDER-PRO-HANDOFF.md`](SIGN-BUILDER-PRO-HANDOFF.md)
and the Dataverse schema in [`docs/dataverse-schema.md`](dataverse-schema.md).
The payload contract between the apps is in
[`docs/estimating-integration.md`](estimating-integration.md).
