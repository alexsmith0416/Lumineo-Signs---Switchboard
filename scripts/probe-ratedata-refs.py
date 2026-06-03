"""Find ANY reference to RateData! in piece sheets — show the cell + formula."""
from pathlib import Path
from collections import Counter
from openpyxl import load_workbook
import re

BLANK = Path("reference/estimating") / "Sign365 LN Estimate Template - Blank.xlsx"
wb_f = load_workbook(BLANK, data_only=False)

# Count which RateData cells are referenced.
ref_pat = re.compile(r"RateData!(\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)", re.IGNORECASE)
counts = Counter()
samples = {}
for name in wb_f.sheetnames:
    ws = wb_f[name]
    if ws.sheet_state != "visible":
        continue
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str) and "RateData" in cell.value:
                for m in ref_pat.finditer(cell.value):
                    ref = m.group(1).upper().replace("$", "")
                    counts[ref] += 1
                    if ref not in samples:
                        samples[ref] = (name, cell.coordinate, cell.value)

for ref, n in counts.most_common(50):
    name, coord, formula = samples[ref]
    print(f"{n:3} ×  RateData!{ref:12}  first seen in [{name}] {coord}: {formula[:90]}")
