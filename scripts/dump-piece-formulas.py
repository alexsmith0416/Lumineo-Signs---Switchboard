"""Dump every visible piece sheet's structural formulas from the blank
workbook. Output is a single .md file the next author reads alongside
pieceTypes.ts when implementing the engine math.

For each sheet we emit:
  - The "input block" (typically rows 5-15, where the user enters
    H, L, qty, faces, depth, etc.).
  - The "output / formula block" (rows 30+ where sqft / labor / lookup
    cells live).
  - The piece total cell formula (usually B10 or near).
"""
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

BLANK = Path("reference/estimating") / "Sign365 LN Estimate Template - Blank.xlsx"
OUT = Path("docs") / "17-estimating-piece-formulas.md"

SKIP = {"WC", "Inv", "BCI", "BCL", "RateData", "HEADER INFO"}


def has_formula_or_input_label(cell_value) -> bool:
    if isinstance(cell_value, str):
        return cell_value.strip().startswith("=") or any(
            kw in cell_value.lower() for kw in ("?", "total", "sqft", "hour", "inches", "feet", "panel", "face", "qty", "height", "length")
        )
    return False


def cell_brief(value, formula, max_formula_len: int = 80) -> str:
    if isinstance(formula, str) and formula.startswith("="):
        # Strip the leading = for readability.
        f = formula
        if len(f) > max_formula_len:
            f = f[:max_formula_len] + "…"
        return f"{value!r} ← {f}"
    return repr(value)


def dump_sheet(out_lines: list[str], ws_v, ws_f) -> None:
    name = ws_v.title
    out_lines.append(f"## `{name}`")
    out_lines.append("")
    out_lines.append("```")
    # First we walk every non-empty row in the input block (rows 1-15) and the
    # formula/output area (rows 30 onward up to max_row).
    interesting_ranges = [(1, min(15, ws_v.max_row))]
    if ws_v.max_row > 30:
        interesting_ranges.append((30, ws_v.max_row))
    for r0, r1 in interesting_ranges:
        for r in range(r0, r1 + 1):
            row_cells = []
            for c in range(1, min(ws_v.max_column, 13) + 1):
                v = ws_v.cell(r, c).value
                f = ws_f.cell(r, c).value
                if v is None and f is None:
                    continue
                label = get_column_letter(c)
                if isinstance(v, str) and len(v) > 40:
                    v = v[:40] + "…"
                row_cells.append(f"{label}: {cell_brief(v, f)}")
            if row_cells:
                out_lines.append(f"r{r:>2}  " + "  ".join(row_cells))
        out_lines.append("---")
    out_lines.append("```")
    out_lines.append("")


def main() -> None:
    wb_v = load_workbook(BLANK, data_only=True)
    wb_f = load_workbook(BLANK, data_only=False)
    out_lines = [
        "# Piece-type formula reference",
        "",
        "Auto-dumped from `Sign365 LN Estimate Template - Blank.xlsx` by",
        "`scripts/dump-piece-formulas.py`. This is the canonical source for the",
        "math each `apps/estimating/src/data/pieceTypes.ts` entry should",
        "implement. Cell formulas are shown as `value ← =formula`. Re-run the",
        "script after any workbook update.",
        "",
    ]
    for name in wb_v.sheetnames:
        if name in SKIP:
            continue
        ws_v = wb_v[name]
        if ws_v.sheet_state != "visible":
            continue
        # Skip the "(2)" duplicates — same formulas as the primary sheet.
        if name.endswith("(2)"):
            continue
        dump_sheet(out_lines, ws_v, wb_f[name])
    OUT.write_text("\n".join(out_lines), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
