"""Dump every CNB visible piece sheet so we can locate subtotals and identify
which pieces are actually used in the CNB job."""
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

CNB = Path("reference/estimating") / "Sign365 LN Estimate - CNB.xlsx"
BLANK = Path("reference/estimating") / "Sign365 LN Estimate Template - Blank.xlsx"

SKIP = {"WC", "Inv", "BCI", "BCL", "RateData", "HEADER INFO", "Freeform time and material"}


def dump_sheet(ws_v, ws_f, label: str, max_cols: int | None = None) -> bool:
    """Return True if this sheet appears to have data filled in (any numeric > 0)."""
    used = False
    cols = max_cols or ws_v.max_column
    # Check whether the sheet has any user input by scanning for non-zero numbers
    # in the typical input rows (rows 6-30 in most piece sheets).
    for r in range(1, min(ws_v.max_row, 70) + 1):
        for c in range(1, min(cols, 12) + 1):
            v = ws_v.cell(r, c).value
            if isinstance(v, (int, float)) and v not in (0, 0.0):
                used = True
                break
        if used:
            break
    if not used:
        return False
    print()
    print(f"--- {label} ---  rows used")
    for r in range(1, min(ws_v.max_row, 70) + 1):
        cells = []
        for c in range(1, min(cols, 12) + 1):
            v = ws_v.cell(r, c).value
            f = ws_f.cell(r, c).value
            if v is None and f is None:
                cells.append("")
            elif isinstance(f, str) and f.startswith("="):
                cells.append(f"{v}<{f}>")
            else:
                cells.append(str(v))
        # Skip rows where every cell is empty
        if any(c for c in cells):
            print(f"  r{r:>2}: " + " | ".join(f"{get_column_letter(i+1)}={c}"
                                              for i, c in enumerate(cells) if c))
    return True


def main() -> None:
    wb_v = load_workbook(CNB, data_only=True)
    wb_f = load_workbook(CNB, data_only=False)
    used_sheets = []
    for name in wb_v.sheetnames:
        if name in SKIP:
            continue
        if wb_v[name].sheet_state != "visible":
            continue
        if dump_sheet(wb_v[name], wb_f[name], name):
            used_sheets.append(name)
    print()
    print("=" * 70)
    print(f"USED sheets in CNB ({len(used_sheets)}):")
    for n in used_sheets:
        print(f"  - {n}")


if __name__ == "__main__":
    main()
