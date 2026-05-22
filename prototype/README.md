# Switchboard — Clickable Splash Prototype

A React + Vite prototype that renders the splash screen spec from
[`docs/08-splash-screen-spec.md`](../docs/08-splash-screen-spec.md) with a
role switcher in the header. Intended for stakeholder review *before* any
Power Apps work is committed.

This is **not** the production app — no Dataverse, no Entra, no real data.
Everything is mocked so the visual and per-role behavior can be evaluated
in isolation.

## What it shows

- **Header** with Lumineo brand block, current user, and a role dropdown
- **Days Since Lost Time** counter (3-digit flip layout, badge, previous record)
- **KPI strip** that changes per role (4 cards for Operations; 3–4 for others)
  including delta arrows, color-coded direction, and inline sparklines
- **Announcement banner** (dismissible)
- **Upcoming birthdays** strip
- **App launcher** tiles filtered by role audience, with "open count" badges
- **Recent completions** photo reel (CSS gradients stand in for photos)

Switching role in the header dropdown re-renders the page exactly the way
production Switchboard will route a real Entra-authenticated user to their
home screen — same components, same data shapes, different visible content.

## Run it

From this directory:

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`).

Other scripts:

- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run typecheck` — TypeScript-only check, no emit

## File layout

```
prototype/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
└── src/
    ├── main.tsx
    ├── App.tsx              ← role state lives here
    ├── styles.css           ← all CSS, Lumineo brand tokens at the top
    ├── types.ts             ← shared TS types (match the Dataverse schema)
    ├── data/
    │   └── mockData.ts      ← KPIs per role, users, announcements, photos
    └── components/
        ├── Header.tsx       ← brand + role switcher
        ├── SplashScreen.tsx ← composes the splash
        ├── DaysCounter.tsx
        ├── KpiStrip.tsx     ← + inline KpiCard + Sparkline
        ├── AnnouncementCard.tsx
        ├── BirthdayStrip.tsx
        ├── AppLauncher.tsx
        └── PhotoReel.tsx
```

## What's intentionally NOT here

- **No real auth** — there's no Entra; the role dropdown is the auth simulator
- **No flip-clock animation** on the days counter — static numerals; the production component (Linear ALE-100) handles the animation
- **No actual photos** — CSS gradients with captions stand in
- **No weather chip / crew-truck badge** — those are spec'd separately
  (docs 09, 10) and live on the Installation *home screen*, not the splash
- **No data fetching** — everything is a constant in `mockData.ts`

## What to evaluate

When showing this around, the most useful questions:

- Does the **KPI selection per role** feel right? Are the four/three numbers
  the ones each group actually wants to see first? (See doc 08 §"KPIs per role")
- Is the **safety counter** the right size and tone for the top of every screen?
- Are the **5 app tiles** discoverable enough? Should there be more / fewer
  per role?
- Does the **role badge in the header** make the active context obvious?
- Anything missing that you'd expect to see on first login?

Bring feedback to the Switchboard Phase 0 milestone in Linear (ALE-145, ALE-146)
before the production splash begins.
