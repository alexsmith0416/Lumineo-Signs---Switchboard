import { describe, expect, it } from "vitest";
import { cleanPrefs } from "./jobs-views-store";

describe("cleanPrefs", () => {
  it("fills in what an older save is missing (collapsed groups)", () => {
    expect(cleanPrefs({ sorts: [{ field: "job", asc: true }], filters: [], groups: [] })).toEqual({
      sorts: [{ field: "job", asc: true }], filters: [], groups: [], collapsed: [],
    });
  });
  it("keeps the collapsed group paths", () => {
    expect(cleanPrefs({ groups: [{ field: "status", asc: true }], collapsed: ["Installation", 3] }).collapsed).toEqual(["Installation"]);
  });
  it("starts an unsaved view with its default grouping", () => {
    const view = { id: "v", name: "V", cols: ["job"], defaultGroup: "status" };
    expect(cleanPrefs(null, view)).toEqual({ sorts: [], filters: [], groups: [{ field: "status", asc: true }], collapsed: [] });
  });
});
