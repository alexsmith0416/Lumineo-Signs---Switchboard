// Reads scripts/bc-items-probe.ps1's items.csv → [{ no, name, category, uom }]
// (blocked items dropped). Shared by the item scripts.
export function readItemsCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])))
    .filter((r) => r.blocked !== "True")
    .map((r) => ({
      no: r.number,
      name: [r.displayName, r.displayName2].filter(Boolean).join(" ").trim(),
      category: r.itemCategoryCode,
      uom: r.baseUnitOfMeasureCode,
    }));
}
