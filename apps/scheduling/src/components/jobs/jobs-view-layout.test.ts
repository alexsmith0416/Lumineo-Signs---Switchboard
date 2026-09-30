import { describe, expect, it } from "vitest";
import {
  addSection, addView, defaultLayout, deleteSection, deleteView, duplicateView, moveSection, moveView,
  renameSection, renameView, sanitizeLayout, setViewCols,
} from "./jobs-view-layout";
import { JOB_FIELDS } from "./jobs-fields";

const known = new Set(Object.keys(JOB_FIELDS));
const ids = (l: ReturnType<typeof defaultLayout>, section: string) => l.sections.find((s) => s.id === section)!.viewIds;

describe("view layout", () => {
  it("starts with the built-in views, ids = names", () => {
    const l = defaultLayout();
    expect(ids(l, "Master")).toEqual(["All Jobs", "Not tracked yet"]);
    expect(l.views["Not tracked yet"]!.preset).toBe("untracked");
  });

  it("adds, renames and duplicates views next to the original", () => {
    let l = defaultLayout();
    let id: string;
    [l, id] = addView(l, "Team", { name: "Paint Team", cols: ["job", "status"] });
    expect(ids(l, "Team").at(-1)).toBe(id);
    l = renameView(l, id, "  Paint crew ");
    expect(l.views[id]!.name).toBe("Paint crew");
    let copy: string;
    [l, copy] = duplicateView(l, "All Jobs");
    expect(ids(l, "Master")).toEqual(["All Jobs", copy, "Not tracked yet"]);
    expect(l.views[copy]!.name).toBe("All Jobs copy");
  });

  it("won't delete the last view; deleting removes it from its section", () => {
    let l = defaultLayout();
    l = deleteView(l, "OPS / MFG");
    expect(l.views["OPS / MFG"]).toBeUndefined();
    expect(ids(l, "Team")).not.toContain("OPS / MFG");
    const single = { sections: [{ id: "s", label: "S", viewIds: ["a"] }], views: { a: { id: "a", name: "A", cols: ["job"] } } };
    expect(deleteView(single, "a")).toBe(single);
  });

  it("drags views within and across sections", () => {
    let l = defaultLayout();
    l = moveView(l, "Warehouse Coord.", "Team", 0);
    expect(ids(l, "Team")[0]).toBe("Warehouse Coord.");
    l = moveView(l, "OPS / MFG", "Team", 3); // to the end, same section
    expect(ids(l, "Team").at(-1)).toBe("OPS / MFG");
    l = moveView(l, "WK Expeditor", "Master", 1);
    expect(ids(l, "Master")).toEqual(["All Jobs", "WK Expeditor", "Not tracked yet"]);
    expect(ids(l, "Individual")).toEqual([]);
  });

  it("keeps the Job column first when columns change", () => {
    const l = setViewCols(defaultLayout(), "All Jobs", ["status", "job", "sales"]);
    expect(l.views["All Jobs"]!.cols).toEqual(["job", "status", "sales"]);
  });

  it("adds, renames, reorders and deletes sections (views move up)", () => {
    let l = defaultLayout();
    let s: string;
    [l, s] = addSection(l, "Mine");
    l = renameSection(l, s, "My views");
    expect(l.sections.at(-1)!.label).toBe("My views");
    l = moveSection(l, s, 0);
    expect(l.sections[0]!.id).toBe(s);
    l = deleteSection(l, "Team");
    expect(l.sections.map((x) => x.id)).not.toContain("Team");
    expect(ids(l, "Master")).toContain("OPS / MFG");
  });

  it("repairs a damaged saved layout", () => {
    expect(sanitizeLayout(null, known).sections.length).toBe(3);
    const l = sanitizeLayout(
      { sections: [{ id: "a", label: "A", viewIds: ["x", "missing"] }], views: { x: { name: "X", cols: ["status", "bogus"] }, y: { name: "Y", cols: [] } } },
      known,
    );
    expect(l.views.x!.cols).toEqual(["job", "status"]);
    expect(l.sections[0]!.viewIds).toEqual(["x", "y"]);
  });

  it("keeps custom field columns, which load after the layout", () => {
    const l = sanitizeLayout({ sections: [{ id: "a", label: "A", viewIds: ["x"] }], views: { x: { name: "X", cols: ["job", "cf_abc1", "status"] } } }, known);
    expect(l.views.x!.cols).toEqual(["job", "cf_abc1", "status"]);
  });
});
