import { describe, expect, it } from "vitest";
import { bundleSigns, emptyProject } from "./Project";
import { emptySignSpec } from "./SignSpec";

describe("emptyProject", () => {
  it("defaults to blank fields and a fresh timestamp", () => {
    const p = emptyProject();
    expect(p.name).toBe("");
    expect(p.customerName).toBe("");
    expect(p.notes).toBe("");
    expect(p.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("bundleSigns", () => {
  it("sums quantity across signs to produce totalUnits", () => {
    const project = emptyProject();
    const signs = [
      { ...emptySignSpec(), quantity: 3 },
      { ...emptySignSpec(), quantity: 5 },
      { ...emptySignSpec(), quantity: 1 },
    ];
    const bundle = bundleSigns(project, signs);
    expect(bundle.totalUnits).toBe(9);
    expect(bundle.signs).toBe(signs);
  });

  it("handles an empty sign list", () => {
    const bundle = bundleSigns(emptyProject(), []);
    expect(bundle.totalUnits).toBe(0);
    expect(bundle.signs).toEqual([]);
  });
});
