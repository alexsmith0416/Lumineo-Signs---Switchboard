# Estimating — Claude Code build prompt

Paste the prompt below into **Claude Code** (VS Code) from the repo root to build the full Estimating app.

**Before running:**
1. Commit `docs/18-estimating.md` (the spec).
2. Place the estimating workbooks where Claude Code can read them: `reference/estimating/Sign365_LN_Estimate_Template_-_Blank.xlsx` (formulas) and `reference/estimating/Sign365_LN_Estimate_Template.xlsx` (the filled MERITRUST job, for the acceptance test).
3. Optional: drop the two prototype HTML files in `reference/estimating/` as a visual/logic reference.

Tracked in Linear: **Estimating — Power Apps Code App** (issues ALE-234 → ALE-246).

---

## Prompt

```
Build the Estimating app — a React + Vite + TypeScript Power Apps Code App — inside this monorepo, following our existing conventions (shared @lumineo/ui, the design tokens, the same structure as the other code apps). Read docs/18-estimating.md first; it is the spec. Track work against Linear issues ALE-234 through ALE-246.

SOURCE OF TRUTH — THE WORKBOOK
The estimating logic lives in reference/estimating/Sign365_LN_Estimate_Template_-_Blank.xlsx (formulas) and ..._Template.xlsx (a filled job for testing). Write a Node or Python extraction script (SheetJS or openpyxl) and DERIVE everything from these sheets — do not hardcode or guess:
- Inv sheet -> the inventory catalog (Description, No., Unit Cost, Unit Price, Base UoM, Profit %). ~1,266 real items. Generate src/data/catalog.ts.
- WC sheet -> work codes (Code, Description, Hourly Rate). Shop rate is $92/hr. Generate src/data/workcodes.ts.
- RateData sheet -> process rates (sqft/hr per process, grams/sqft, the hours-rounding factor in B84). Generate src/data/rates.ts.
- Every visible sign-type sheet (~25: Vinyl cutting, Apply vinyl graphics, Alum/Economy pan, Post & panel, Flat panels, Routed panel shapes, Routed face only, Routed alum faces letters, Routed push-through acrylic, Sf/Df routed cabinet, Sf/Economy/Df acrylic cabinet, Sf/Df flex cabinet, Pole cover, Structural steel, Reveal, Crown cove, EMC assembly, Crating, LED wiring, Changeable copy face, Flex/Routed face assembly, Paint calculation, Trimcap letter face, Channel letter fabrication). For each, extract its inputs, its sqft formula, its default labor lines (work code + which RateData rate + rounding), any special factors (push-through routing inches, radius/angle multiplier, paint extra-color factor, LED-count-per-sqft, the base-rate lookup tables like "0-3 sqft=1/hr, 4-7=2/hr, 8-17=3/hr, 18+=4/hr"), and its total cell. Encode all of these as DATA-DRIVEN piece-type definitions in src/data/pieceTypes.ts that a single engine consumes. Where a sheet's formula is ambiguous, leave a // TODO with the cell references rather than guessing.
- BCI sheet -> the material export shape (Job#, Task#, Item#, Desc, Unit Cost, Profit%, Unit Price, Qty). BCL sheet -> the labor export shape (Job#, Resource#, Run Time hrs).

ENGINE (src/lib/engine.ts)
Pure functions: sqft per type, labor hours per type (sqft / rate, with the type's rounding), material line total = unitPrice * units, labor line total = hours * rate, piece total = sum of lines, project total = sum of pieces. Anchor your extraction against these VERIFIED formulas:
- Apply Vinyl Graphics: sqft = (H*L/144)*qty; labor 2416, hours = CEILING(sqft / (Flat 32 | PushThrough 15), 0.5).
- Vinyl Cutting: sqft = CEILING((H*L)/144, 4)*qty; labor 2415, hours = CEILING(sqft/20, B84).
- Paint Calculation: sqft = (H*L/144)*faces; auto material line "EST PAINT - CUSTOM" units = ROUND(sqft*100) grams; labor 2110 hours = sqft/20, 2112 hours = sqft/25.
- Routed Panel Shapes: sqft = (H*L/144)*panels; labor 2010 setup 1hr + 2010 routing hours = sqft/50.

APP (build-your-own estimate, no prefilled fields)
- Estimate header: Job # (J####), Job name, Estimator, Description.
- Project list + create new.
- "Add a sign piece" -> pick any of the ~25 types -> the type's input cascade renders -> sqft + default labor auto-compute -> add materials via a searchable picker over the FULL catalog (search by description or item #) -> enter units -> live line/piece/project totals. Support multiple pieces, including multiples of one type. Allow adding extra labor lines (pick any work code) and editing hours.
- BC Export view: aggregate all pieces into BCI material lines + BCL labor lines (run time summed by resource); add a real Excel download (SheetJS) matching the workbook's BCI/BCL import shape.
- Proposal summary: generate a short plain-language sign description per piece.
- Sign Builder Pro import: stub a function that accepts an SBP sign spec and pre-fills a piece (map type + dimensions + vinyl material line); leave the actual SBP wiring as a TODO.

DESIGN + PLATFORM
- Use @lumineo/ui and the tokens: navy #141464, navyLight #2a2a8a, navyBg #e8eaf5, red #E8151B, redDark #c4111a, Open Sans, 64px header, radii sm5/md7/lg10. Mobile-responsive: stack the piece-list/detail two-column layout into one column below the 900px breakpoint; usable at 600/900/1200.
- Data layer behind an interface (CatalogRepo, EstimateRepo) seeded from the generated local data now, so a Dataverse implementation can swap in later (ALE-234/236) without touching the UI.
- Make it a Power Apps code app: pac code init / wire power.config, and ensure pac code push works. Vite base './'.

ACCEPTANCE
Build the filled MERITRUST J35260 job from the workbook and confirm it reconciles to $11,474.35 to the cent, with: Apply Vinyl $276.264, Paint $62.457, Routed Panel Shapes $604.89, Pole Cover $1,655.39, Df Routed Cabinet $8,875.35. Add a quick test that asserts these. Then run a build and fix any TS/Vite errors.
```

---

## Notes

- The prompt has Claude Code **extract formulas straight from the workbook** rather than trusting hand-typed values, so all ~25 types come from your sheets and anything ambiguous is flagged as a `// TODO` with cell references instead of guessed.
- The **$11,474.35** reconciliation (MERITRUST J35260) is the built-in acceptance test — if the math drifts, the test fails.
- Data sits behind a repo interface seeded locally, so the **Dataverse** swap (ALE-234/236) later won't touch the UI.
