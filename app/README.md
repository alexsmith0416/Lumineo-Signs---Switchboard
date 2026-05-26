# Lumineo Time & Photo — working prototype

A Vite + React + TypeScript + Tailwind PWA implementing the 9 screens from the static mockup (`../time-photo-mockup.html`) as a real, clickable, state-persisting application.

## Run it

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173`.

## What's wired up

| Feature | Behavior |
| -- | -- |
| Punch in / out | Real action — Job → Task cascade, switch-job warning, "Completed Current Task" checkbox in clock-out modal |
| Live elapsed timer | Updates every second on the active punch card with a pulsing green dot |
| Photo capture | Uses the browser camera (or file picker fallback) via `<input capture="environment">`. Stores base64 thumbnails locally |
| Photo gallery | Per-job, grouped by day, filtered by category, with lightbox |
| Punch history | Today / This Week / Last Week / Pay Period / Custom — each with a navy gradient grand-total card |
| Edit request | Form submits to local state + would email supervisor via Power Automate in production |
| Admin export | CSV download of selected/filtered punches with all the fields BC would expect |
| Offline mode | Toggle in the dev panel (top right) or Settings screen. While offline, writes queue locally and show in a "Waiting to Sync" list. "Retry Sync Now" drains the queue |
| Persistence | All state in `localStorage` via Zustand `persist` middleware |

## What's mocked

* No MSAL.js auth — `CURRENT_EMPLOYEE` is hard-coded in `src/lib/mockData.ts`
* No Dataverse / Graph / BC connections — jobs and tasks come from `mockData.ts`
* Photos store as base64 in `localStorage` (size-limited — fine for demo, real app uses IndexedDB + SharePoint Graph upload)
* GPS is best-effort via `navigator.geolocation`; falls back silently if blocked

## File map

```
app/
├── src/
│   ├── App.tsx              router shell + phone frame
│   ├── store.ts             Zustand store (punches, photos, queue, offline)
│   ├── types.ts             shared types
│   ├── hooks/               useElapsed, useGeolocation
│   ├── lib/                 mockData, format, range bounds
│   ├── components/          AppHeader, SubBar, PhoneFrame, Toast, StatusPill, icons, LumineoLogo, DevPanel
│   └── screens/             Dashboard, PunchIn, Capture, Gallery, History, EditRequest, Admin, Settings
├── tailwind.config.js       brand tokens (navy, red, navy-bg, etc.)
└── vite.config.ts
```

## Next steps to make this production-ready

1. Swap `CURRENT_EMPLOYEE` for MSAL.js + `User.Read` (ALE-56)
2. Add Dataverse client (`src/lib/dataverse.ts`) and replace `MOCK_JOBS` / `MOCK_TASKS` reads (ALE-59)
3. Swap `addPhoto` `dataUrl` storage for Graph SharePoint upload (ALE-66, ALE-67)
4. Promote `useStore.queue` to Dexie-backed IndexedDB store (ALE-69)
5. Wire `submitEditRequest` to Power Automate flow that emails supervisor (ALE-64)
6. Add service worker for PWA install + offline shell

See the [App Outline & Build Spec](https://linear.app/lumineosigns/document/app-outline-and-build-spec-ccfb43044176) on the Linear project for the canonical issue order.
