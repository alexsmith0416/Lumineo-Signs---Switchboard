import { afterEach, describe, expect, it } from "vitest";
import { DEMO_SETUP } from "../data/demo-setup";
import { createMockRepo, docsToSetup, setRepoOverride, setupToDocs } from "../services/repo";
import { useSetupStore } from "../store/setup-store";
import { updateCategory } from "./category-ops";
import { updateOption } from "./question-ops";
import { duplicateSignType } from "./sign-type-ops";
import { deleteTemplateLine } from "./template-ops";
import { diffSetups, isSameSetup, newVersionHeader, setupStats } from "./version-ops";

const T = "WALL-CAB-LIT";

describe("diff", () => {
  it("a setup matches itself after a round trip through its documents", () => {
    expect(isSameSetup(diffSetups(DEMO_SETUP, docsToSetup(setupToDocs(DEMO_SETUP))))).toBe(true);
  });

  it("names what changed, by sign type", () => {
    let s = updateOption(DEMO_SETUP, T, "FACE_TYPE", "Routed & Backed", { value: "Routed and Backed" });
    s = deleteTemplateLine(s, T, "field", 10000);
    s = duplicateSignType(s, "WALL-CAB-NI", "WALL-CAB-X", "Copy");
    s = updateCategory(s, s.categories[0]!.code, { description: "Renamed" });
    const d = diffSetups(DEMO_SETUP, s);
    expect(d.general).toEqual(["Categories"]);
    expect(d.added.map((t) => t.code)).toEqual(["WALL-CAB-X"]);
    expect(d.changed.find((c) => c.code === T)!.parts).toEqual(["answers", "rules", "descriptions"]);
    expect(diffSetups(s, DEMO_SETUP).removed.map((t) => t.code)).toEqual(["WALL-CAB-X"]);
  });
});

describe("saving and restoring", () => {
  afterEach(() => setRepoOverride(null));

  it("saves, lists, loads and deletes versions", async () => {
    const r = createMockRepo(null, { setup: DEMO_SETUP, specs: [], lines: [], projects: [] });
    const h = newVersionHeader(DEMO_SETUP, " First ", "", "manual", "Alex");
    expect(h.stats).toEqual(setupStats(DEMO_SETUP));
    const steps: number[] = [];
    await r.saveVersion(h, DEMO_SETUP, (d) => steps.push(d));
    expect(steps.length).toBeGreaterThan(0);
    expect((await r.listVersions()).map((v) => v.label)).toEqual(["First"]);
    expect(isSameSetup(diffSetups(await r.loadVersion(h.id), DEMO_SETUP))).toBe(true);
    await r.deleteVersion(h.id);
    expect(await r.listVersions()).toEqual([]);
    await expect(r.loadVersion(h.id)).rejects.toThrow();
  });

  it("restore puts the version back, saves the current setup first, and Undo steps back", async () => {
    const r = createMockRepo(null, { setup: DEMO_SETUP, specs: [], lines: [], projects: [] });
    setRepoOverride(r);
    await useSetupStore.getState().load();
    const store = () => useSetupStore.getState();
    const h = newVersionHeader(store().setup!, "Clean", "", "manual", "Alex");
    await r.saveVersion(h, store().setup!);
    store().replace(deleteTemplateLine(store().setup!, T, "field", 10000), "edit");
    const edited = store().setup!;

    await store().restoreVersion(h.id, h.label, "Alex");
    expect(isSameSetup(diffSetups(store().setup!, DEMO_SETUP))).toBe(true);
    const list = await r.listVersions();
    expect(list.map((v) => v.label)).toContain("Before restoring “Clean”");
    const before = list.find((v) => v.kind === "auto")!;
    expect(isSameSetup(diffSetups(await r.loadVersion(before.id), edited))).toBe(true);

    store().undo();
    expect(isSameSetup(diffSetups(store().setup!, edited))).toBe(true);
  });
});
