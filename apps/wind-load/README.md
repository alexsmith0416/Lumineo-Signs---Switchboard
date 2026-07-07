# Wind Load Calculator

A user-friendly front end for the shop's structural sizing workbook
(`reference/wind-load/STSIGN5.xls`): enter the sign faces, pick pole and
footing types, and it recommends the pole size, footing embedment depth,
concrete order volume, and (optionally) base plate + anchor bolt sizes.

Standalone for now — it does **not** render the Switchboard sidebar, but uses
the full Switchboard design system (`DESIGN.md`): semantic light/dark tokens,
Open Sans, the same topbar/panel/chip/KPI patterns as Estimating and Sign
Builder Pro.

```bash
npm run dev:wind-load    # http://localhost:4803
npm run test:wind-load   # engine acceptance tests (pinned to workbook values)
npm run build:wind-load
```

## What's ported from the workbook

| Workbook sheet | App |
|---|---|
| **Wind** | UBC 1994 design pressures: `qs = 0.00256·V²`, Ce from table 16-G (exposure B/C/D), `Cq = 1.4`; the conservative "round the centroid up to the next height bracket" element lookup; seismic comparison `Fp = Z·I·Cp·Wp` |
| **Column** | Moment/shear at grade from up to 8 sign faces; pipe (A53-B) / square tube (A500-B) selection from the workbook's exact size tables; `fb` vs allowable (compactness checks, ×1.33 wind increase) |
| **Pier** | Lateral-bearing pier/caisson embedment (UBC 1806.7, `D = (A/2)(1+√(1+4.36h/A))`) — solved iteratively by the app instead of hand-iterating like the spreadsheet; bearing check; concrete volume |
| **Base Plate** | Plate size/thickness, A36 anchor bolt diameter + embedment + spacing, concrete cone, tension+shear interaction, column-to-plate weld check |
| **Spec** | Standard steel / welding / concrete specification notes (Specifications tab) |

Not ported (use the workbook / an engineer for these): stepped multi-segment
columns with sleeves, spread footings + reinforcement mats, torsion beams,
plate-to-plate bolted connections, wide-flange allowable stress.

> **Preliminary sizing only.** The source workbook is based on UBC 1994 /
> AISC 9th ed. ASD and is marked for educational use. Final design and permit
> calculations must be prepared or verified by a licensed engineer.

## Layout

- `src/data/tables.ts` — Ce table, seismic zone factors, pipe/tube size
  tables, and spec notes transcribed from the workbook.
- `src/lib/engine.ts` — pure calculation engine (no DOM), fully unit-tested.
- `src/__tests__/engine.test.ts` — values pinned to the spreadsheet's stored
  results (e.g. `qs(115) = 33.856`, exposure-C pressures, size brackets).
- `src/ui/` — Switchboard-styled shell: `Topbar` (with brand block, since
  there's no sidebar), `InputsPanel`, `ResultsPanel`, `SpecsView`.

Inputs autosave to `localStorage`; **Print** produces a clean one-page calc
summary with a project header.
