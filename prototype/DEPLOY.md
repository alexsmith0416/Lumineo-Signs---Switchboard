# Deploying the Switchboard prototype to Vercel

The prototype lives in this `prototype/` subdirectory of the repo. Vercel
needs to know that — otherwise it tries to build from the repo root and fails.

## One-time setup (Vercel dashboard)

1. **Import the GitHub repo** at <https://vercel.com/new>.
2. On the configure screen, set **Root Directory** to `prototype`.
   (Click "Edit" next to Root Directory and pick the folder.)
3. Leave Framework Preset on **Vite** (auto-detected).
4. Leave Build Command, Install Command, and Output Directory blank —
   they're read from `vercel.json`.
5. Click **Deploy**.

Once linked, every push to a tracked branch creates a preview URL; the
production branch creates / updates the production URL.

## One-time setup (CLI alternative)

```bash
npm i -g vercel
cd prototype
vercel link            # pick scope + project name
vercel --prod          # deploys this commit to production
```

When `vercel link` asks for a root directory, accept the default
(`./`) — you're already inside `prototype/`.

## What's in `vercel.json`

- **framework: vite** + standard build / output paths.
- **cleanUrls: false** so `prototypes/Weekly Scheduler Prototype.html`
  keeps its `.html` extension — without this, the in-app tile links
  return 404 because Vercel would try to serve them as `prototypes/...`
  with no extension.
- **No SPA rewrites.** There are multiple static HTML entry points
  (`index.html` plus 3 prototype HTMLs under `/prototypes/`); a catch-all
  rewrite would break those direct file URLs.
- Long cache on `/assets/*` (Vite fingerprints filenames), short cache
  on `/prototypes/*` so prototype iterations show up quickly.

## After deploy

The deployed URL serves everything from a single origin, so the relative
tile links (`prototypes/Weekly Scheduler Prototype.html`, etc.) all
resolve and `window.open()` works without the `file://` restrictions
you hit running `index.html` locally.

The 3 sub-app tiles that point at external apps (Project Scheduler,
Sign Builder Pro, Estimating) still open in a new tab to the existing
URLs — no change there.
