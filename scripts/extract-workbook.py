"""
Extract pure-data sheets from the blank Sign365 LN Estimate template and emit
TypeScript modules consumed by the Estimating engine.

Outputs (under apps/estimating/src/data/):
  - catalog.ts    — every non-empty Inv row (~1,266 items)
  - workcodes.ts  — every WC row (~26 codes) + shop labor rate
  - rates.ts      — every named RateData rate, the B84 rounding factor, and
                    the nine increment-based lookup tables (pan / post & panel /
                    routed cabinet / acrylic cabinet / flex cabinet / polecover /
                    reveal / crown / EMC).

Piece-type definitions are not auto-extracted by this script — they are
hand-encoded in src/data/pieceTypes.ts after inspecting the blank workbook,
because the per-sheet formula layout is heterogeneous enough that a generic
extractor would have to guess at intent. Anything ambiguous is marked with a
// TODO and the workbook cell reference, per the build spec.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, UTC
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
BLANK = ROOT / "reference" / "estimating" / "Sign365 LN Estimate Template - Blank.xlsx"
OUT = ROOT / "apps" / "estimating" / "src" / "data"


# ---------------------------------------------------------------------------- #
# Helpers
# ---------------------------------------------------------------------------- #


def ident(s: str) -> str:
    """Make a JS-safe identifier from a free-text label."""
    out = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")
    if out and out[0].isdigit():
        out = "_" + out
    return out or "_"


def js_string(s: str | None) -> str:
    if s is None:
        return '""'
    s = str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{s}"'


def js_num(v) -> str:
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        # Avoid noisy float reps like 2.8499999999999996 — round to 6 dp
        # if the value has tiny float noise.
        if isinstance(v, float):
            rounded = round(v, 6)
            if abs(rounded - v) < 1e-9:
                v = rounded
        return repr(v)
    return js_string(str(v))


# ---------------------------------------------------------------------------- #
# Inv → catalog.ts
# ---------------------------------------------------------------------------- #


def extract_catalog(wb_v) -> list[dict]:
    ws = wb_v["Inv"]
    headers = [c.value for c in ws[1]]
    # Expected: Description, No., Unit Cost, Unit Price, Base UoM, Profit %, ...
    items: list[dict] = []
    for r in range(2, ws.max_row + 1):
        row = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
        desc, no, unit_cost, unit_price, base_uom, profit_pct = row[:6]
        # Skip blank / placeholder rows (the workbook reserves 2000 rows but
        # only the first ~1,266 are real items).
        if not isinstance(desc, str):
            continue
        desc = desc.strip()
        if not desc or desc in ("0", "\xa0"):
            continue
        if not isinstance(unit_price, (int, float)) or unit_price <= 0:
            continue
        item_no = str(no).strip() if no is not None else ""
        items.append({
            "no": item_no,
            "description": desc,
            "unitCost": float(unit_cost) if isinstance(unit_cost, (int, float)) else 0.0,
            "unitPrice": float(unit_price),
            "baseUoM": str(base_uom).strip() if base_uom else "EA",
            "profitPct": float(profit_pct) if isinstance(profit_pct, (int, float)) else 0.0,
        })
    return items


def write_catalog(items: list[dict]) -> None:
    lines = [
        "// AUTO-GENERATED from reference/estimating/Sign365 LN Estimate Template - Blank.xlsx",
        f"// Generated {datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00', '')}Z by scripts/extract-workbook.py",
        "// DO NOT EDIT BY HAND — re-run `npm run extract:estimating` to refresh.",
        "",
        "export interface CatalogItem {",
        "  /** Item number ('No.' in the workbook); the BC import key. */",
        "  readonly no: string;",
        "  readonly description: string;",
        "  readonly unitCost: number;",
        "  readonly unitPrice: number;",
        "  readonly baseUoM: string;",
        "  /** Profit percentage as stored in the workbook (e.g. 44.45, not 0.4445). */",
        "  readonly profitPct: number;",
        "}",
        "",
        f"export const CATALOG: readonly CatalogItem[] = Object.freeze([",
    ]
    for it in items:
        lines.append(
            "  { no: " + js_string(it["no"])
            + ", description: " + js_string(it["description"])
            + f", unitCost: {it['unitCost']!r}"
            + f", unitPrice: {it['unitPrice']!r}"
            + ", baseUoM: " + js_string(it["baseUoM"])
            + f", profitPct: {it['profitPct']!r}"
            + " },"
        )
    lines += [
        "] as const);",
        "",
        f"export const CATALOG_COUNT = {len(items)};",
        "",
    ]
    OUT.joinpath("catalog.ts").write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote catalog.ts ({len(items)} items)")


# ---------------------------------------------------------------------------- #
# WC → workcodes.ts
# ---------------------------------------------------------------------------- #


def extract_workcodes(wb_v) -> tuple[list[dict], float]:
    ws = wb_v["WC"]
    shop_rate = ws["B3"].value
    if not isinstance(shop_rate, (int, float)):
        raise ValueError(f"WC!B3 (Shop Labor Rate) is not numeric: {shop_rate!r}")
    codes: list[dict] = []
    # Header row is r5; data starts r6.
    for r in range(6, ws.max_row + 1):
        code = ws.cell(r, 1).value
        desc = ws.cell(r, 2).value
        rate = ws.cell(r, 3).value
        if not isinstance(code, (int, float)):
            continue
        if not isinstance(desc, str) or not desc.strip():
            continue
        if not isinstance(rate, (int, float)):
            continue
        codes.append({
            "code": int(code),
            "description": desc.strip(),
            "hourlyRate": float(rate),
        })
    return codes, float(shop_rate)


def write_workcodes(codes: list[dict], shop_rate: float) -> None:
    lines = [
        "// AUTO-GENERATED from reference/estimating/Sign365 LN Estimate Template - Blank.xlsx",
        f"// Generated {datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00', '')}Z by scripts/extract-workbook.py",
        "// DO NOT EDIT BY HAND — re-run `npm run extract:estimating` to refresh.",
        "",
        "export interface WorkCode {",
        "  readonly code: number;",
        "  readonly description: string;",
        "  readonly hourlyRate: number;",
        "}",
        "",
        f"/** Shop labor rate as of the workbook's 'effective 1-1-26' increase. */",
        f"export const SHOP_LABOR_RATE = {shop_rate!r};",
        "",
        f"export const WORK_CODES: readonly WorkCode[] = Object.freeze([",
    ]
    for c in codes:
        lines.append(
            f"  {{ code: {c['code']}, description: " + js_string(c["description"])
            + f", hourlyRate: {c['hourlyRate']!r} }},"
        )
    lines += [
        "] as const);",
        "",
        "export const WORK_CODES_BY_CODE: ReadonlyMap<number, WorkCode> = new Map(",
        "  WORK_CODES.map(wc => [wc.code, wc])",
        ");",
        "",
    ]
    OUT.joinpath("workcodes.ts").write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote workcodes.ts ({len(codes)} codes, shop rate ${shop_rate}/hr)")


# ---------------------------------------------------------------------------- #
# RateData → rates.ts
# ---------------------------------------------------------------------------- #


# Single named rates live in column A (label) + column B (value) on rows 1-46
# and row 84-85. Increment lookup tables span rows 47-80 with a known shape:
#   A: "<table> increment N" / B: sqft threshold
#   C: "<table> rate N"      / D: rate (old) — column G has the new rate
#
# We use the newer (5%-less, effective 1-1-26) rates in column G when present;
# otherwise fall back to column D.
TABLE_NAMES = {
    "pan": (47, 51),
    "postAndPanel": (52, 56),
    "routedCabinet": (57, 60),
    "acrylicCabinet": (61, 64),
    "flexCabinet": (65, 67),
    "polecover": (68, 71),
    "reveal": (72, 73),
    "crown": (74, 75),
    "EMC": (76, 80),
}


def extract_rates(wb_v) -> dict:
    ws = wb_v["RateData"]
    singles: dict[str, float] = {}
    # Rows 1-46 are single named rates (with some interspersed columns we ignore).
    for r in range(1, 47):
        label = ws.cell(r, 1).value
        value = ws.cell(r, 2).value
        # Use column G for the new-rate-effective-1-1-26 value when present.
        new_val = ws.cell(r, 7).value
        if isinstance(label, str) and label.strip():
            v = new_val if isinstance(new_val, (int, float)) else value
            if isinstance(v, (int, float)):
                singles[label.strip()] = float(v)

    # Rows 81-85: trailing single rates (pole cover multiplier params + divider bar).
    for r in range(81, ws.max_row + 1):
        label = ws.cell(r, 1).value
        value = ws.cell(r, 2).value
        if isinstance(label, str) and label.strip() and isinstance(value, (int, float)):
            singles[label.strip()] = float(value)

    # Increment lookup tables (rows 47-80). Piece sheets read these via
    # `=RateData!B##` (threshold, column B) and `=RateData!D##` (rate, column D);
    # column G is a labelled "old rate" reference and is NOT consumed downstream.
    tables: dict[str, list[dict]] = {}
    for name, (r0, r1) in TABLE_NAMES.items():
        rows = []
        for r in range(r0, r1 + 1):
            increment = ws.cell(r, 2).value  # column B: sqft threshold
            rate = ws.cell(r, 4).value       # column D: rate consumed by piece sheets
            if isinstance(increment, (int, float)) and isinstance(rate, (int, float)):
                rows.append({"threshold": float(increment), "rate": float(rate)})
        if rows:
            tables[name] = rows

    rounding = ws["B84"].value
    if not isinstance(rounding, (int, float)):
        raise ValueError(f"RateData!B84 (rounding factor) is not numeric: {rounding!r}")

    return {
        "singles": singles,
        "tables": tables,
        "rounding": float(rounding),
    }


def write_rates(rates: dict) -> None:
    singles = rates["singles"]
    tables = rates["tables"]
    rounding = rates["rounding"]

    # Map workbook labels to camelCase keys we can reference from the engine.
    KEY_ALIASES = {
        "Vinyl cut/weed/mask sqft/hour": "vinylCutSqftPerHour",
        "Vinyl application flat surface sqft/hour": "vinylApplyFlatSqftPerHour",
        "Vinyl application push through sqft/hour": "vinylApplyPushThroughSqftPerHour",
        "Grams of paint/sqft": "paintGramsPerSqft",
        "Extra paint color percentage": "extraPaintColorPct",
        "Cabinet paint prep sqft/hour": "cabinetPaintPrepSqftPerHour",
        "Cabinet paint sqft/hour": "cabinetPaintSqftPerHour",
        "Pan paint prep sqft/hour": "panPaintPrepSqftPerHour",
        "Pan paint sqft/hour": "panPaintSqftPerHour",
        "Post & panel paint prep/sqft/hour": "postPanelPaintPrepSqftPerHour",
        "Post & panel paint sqft/hour": "postPanelPaintSqftPerHour",
        "Reveal paint prep sqft/hour": "revealPaintPrepSqftPerHour",
        "Reveal paint sqft/hour": "revealPaintSqftPerHour",
        "Crown paint bondo & prep sqft/hour": "crownPaintPrepSqftPerHour",
        "Crown paint sqft/hour": "crownPaintSqftPerHour",
        "Radius or angle extra labor percentage": "radiusOrAngleExtraLaborPct",
        "Post & panel feet of post fab feet/hour": "postPanelPostFabFtPerHour",
        "LED wiring sqft/hour": "ledWiringSqftPerHour",
        "Synergy 24 volt LEDs/sqft": "synergyLedsPerSqft",
        "Synergy 24 volt LEDs/power supply": "synergyLedsPerPowerSupply",
        "Quickmod 12 volt LEDs/sqft": "quickmodLedsPerSqft",
        "Quickmod 12 volt LEDs/power supply": "quickmodLedsPerPowerSupply",
        "Acrylic cut sqft/hour": "acrylicCutSqftPerHour",
        "Polycarbonate cut sqft/hour": "polycarbCutSqftPerHour",
        "ACM cut sqft/hour": "acmCutSqftPerHour",
        "Prepainted aluminum cut sqft/hour": "prepaintedAlumCutSqftPerHour",
        "Router setup hours": "routerSetupHours",
        "Letter perimeter path factor": "letterPerimeterPathFactor",
        "Routed panel shape sqft/hour": "routedPanelShapeSqftPerHour",
        "Routing aluminum inches/hour": "routingAluminumInchesPerHour",
        "Routing push through acrylic inches/hour": "routingPushThroughInchesPerHour",
        "Routed pop stud sqft/hour": "routedPopStudSqftPerHour",
        "Routed backer assembly sqft/hour": "routedBackerAssemblySqftPerHour",
        "Routed face fabrication rate sqft/hour": "routedFaceFabricationSqftPerHour",
        "Retainer assembly sqft/hour": "retainerAssemblySqftPerHour",
        "Flex face assembly sqft/hour": "flexFaceAssemblySqftPerHour",
        "Flex face clip plastic per/foot": "flexFaceClipPlasticPerFoot",
        "Flex face metal clip per/foot": "flexFaceMetalClipPerFoot",
        "EMC hand paint sqft/hour": "emcHandPaintSqftPerHour",
        "CC rail fab feet/hour": "ccRailFabFtPerHour",
        "Trim cap face fab inches/hour": "trimCapFaceFabInchesPerHour",
        "Channel letter block fab inches/hour": "channelLetterBlockFabInchesPerHour",
        "Channel letter serif fab inches/hour": "channelLetterSerifFabInchesPerHour",
        "Channel letter script fab inches/hour": "channelLetterScriptFabInchesPerHour",
        "Channel letter paint prep sqft/hour": "channelLetterPaintPrepSqftPerHour",
        "Channel letter paint sqft/hour": "channelLetterPaintSqftPerHour",
        "large pole cover size for face material change": "largePoleCoverFaceMaterialChangeSize",
        "large pole cover frame multiplier": "largePoleCoverFrameMultiplier",
        "large pole size for cover frame multiplier": "largePoleCoverFrameMultiplierSize",
        "Ceiling Hour rounding rate for labor calulations": "hourRoundingFactor",
        "Divider bar ft/hr": "dividerBarFtPerHour",
    }

    out = {KEY_ALIASES.get(k, ident(k)): v for k, v in singles.items()}
    # The hourRoundingFactor lives in B84 — also exposed as `rounding` at top
    # level so engine code can grab it cleanly.
    out["hourRoundingFactor"] = rounding

    lines = [
        "// AUTO-GENERATED from reference/estimating/Sign365 LN Estimate Template - Blank.xlsx",
        f"// Generated {datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00', '')}Z by scripts/extract-workbook.py",
        "// DO NOT EDIT BY HAND — re-run `npm run extract:estimating` to refresh.",
        "",
        "/** Tier in a sqft-threshold lookup table (e.g. 'pan' rates). */",
        "export interface RateTier {",
        "  /** Lower-bound sqft (inclusive). The first tier always has threshold=0. */",
        "  readonly threshold: number;",
        "  /** Labor hours/sqft applied above this threshold. */",
        "  readonly rate: number;",
        "}",
        "",
        "/** Look up the rate that applies at a given sqft value. */",
        "export function tierFor(table: readonly RateTier[], sqft: number): number {",
        "  let chosen = table[0]?.rate ?? 0;",
        "  for (const t of table) {",
        "    if (sqft >= t.threshold) chosen = t.rate;",
        "    else break;",
        "  }",
        "  return chosen;",
        "}",
        "",
        "export const RATES = Object.freeze({",
    ]
    for key, value in out.items():
        lines.append(f"  {key}: {value!r},")
    lines += [
        "} as const);",
        "",
        "export type Rates = typeof RATES;",
        "",
        "export const TABLES = Object.freeze({",
    ]
    for table_name, rows in tables.items():
        lines.append(f"  {table_name}: Object.freeze([")
        for row in rows:
            lines.append(f"    {{ threshold: {row['threshold']!r}, rate: {row['rate']!r} }},")
        lines.append("  ] as readonly RateTier[]),")
    lines += [
        "} as const);",
        "",
        "export type Tables = typeof TABLES;",
        "",
    ]
    OUT.joinpath("rates.ts").write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote rates.ts ({len(out)} singles, {len(tables)} lookup tables, "
          f"hourRoundingFactor={rounding})")


# ---------------------------------------------------------------------------- #
# Main
# ---------------------------------------------------------------------------- #


def main() -> None:
    if not BLANK.exists():
        raise SystemExit(f"Missing blank workbook: {BLANK}")
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Extracting from {BLANK.name}")
    wb_v = load_workbook(BLANK, data_only=True)

    items = extract_catalog(wb_v)
    write_catalog(items)

    codes, shop_rate = extract_workcodes(wb_v)
    write_workcodes(codes, shop_rate)

    rates = extract_rates(wb_v)
    write_rates(rates)

    print()
    print("Done.")


if __name__ == "__main__":
    main()
