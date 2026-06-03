# LNI Production Schedule — Power Apps Code App

## Project Overview

React + Vite + TypeScript app that replaces the Airtable-based LNI Production Schedule.
Deployed as a Power Apps Code App via `pac canvas push`.
Data lives in Microsoft Dataverse (`lni_productionschedule`).

## Architecture

- **Runtime**: Power Apps injects `PowerAppsClientContext` as a global at startup
- **Local dev**: `src/mocks/powerAppsClient.ts` shims it via `window` before React renders
- **Data hook**: `useDataverse` — optimistic UI, reverts on network failure
- **Views**: 14 named column sets in `src/data/viewConfigs.ts`; one Grid component handles all
- **Field metadata**: `src/data/fieldDefs.ts` is the single source of truth — label, type, width, options
- **Column prefs**: persisted per-user per-view in `lni_userviewpreferences` Dataverse table
- **Calc fields**: `dip`, `totalMfg`, `totalInstall` — computed client-side, never written to Dataverse

## Key Commands

```bash
# Local dev
npm run dev

# Type check
npx tsc --noEmit

# Production build
npm run build

# Deploy to Power Apps (requires pac CLI and active auth)
pac canvas push --environment <env-id>
```

pac CLI location: `C:\Users\Alex\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd`

## Brand Rules (non-negotiable)

- Font: Open Sans only
- Navy: `#141464` | Red: `#E8151B`
- All design tokens live in `src/index.css` `:root` and `src/data/brandTokens.ts`
- Never hardcode colors or font sizes in components

## Field Types

| type | behavior |
|------|----------|
| `text` | inline text input |
| `multiline` | textarea, Escape/Tab commits |
| `select` | fixed-position searchable dropdown with badge previews |
| `bool` | checkbox, toggles on single click |
| `date` | native date picker |
| `number` | numeric input |
| `currency` | numeric input, `$` formatted display |
| `readonly` | display only, no editor |

## Dataverse Tables

### lni_productionschedule
Primary data table. See `src/data/fieldDefs.ts` for all column names (`dvColumn` property).

### lni_userviewpreferences
Columns: `lni_userid`, `lni_viewname`, `lni_hiddencolumns` (JSON), `lni_columnorder` (JSON)

## Linear Project

Tasks tracked in Linear project ALE (Lumineo Signs — LNI Production Schedule App).
