import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanPrefs, useJobsViewsStore } from "./jobs-views-store";
import { TYPE_CONFIG } from "../services/current-user";

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

// The views are SHARED by everyone, so a user without Jobs edit rights must
// never change them: layout edits are ignored, and their sorts / filters /
// groups only apply to their own session.
describe("read-only Jobs users", () => {
  afterEach(() => useJobsViewsStore.getState().setReadOnly(false));

  it("can't change the shared layout", () => {
    const s = useJobsViewsStore.getState();
    s.setReadOnly(true);
    const before = s.layout;
    s.setLayout({ ...before, sections: [] });
    expect(useJobsViewsStore.getState().layout).toBe(before);
  });

  it("can still sort / filter for themselves, without saving it on the device", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) });
    const s = useJobsViewsStore.getState();
    s.setReadOnly(true);
    const prefs = { sorts: [{ field: "job", asc: false }], filters: [], groups: [], collapsed: [] };
    s.setPrefs("ro-test-view", prefs);
    expect(useJobsViewsStore.getState().prefsByView["ro-test-view"]).toEqual(prefs);
    expect(stored.has("lumineo.jobs.view.ro-test-view")).toBe(false);
    // ...whereas an editor's change is kept on the device (and shared, when live).
    s.setReadOnly(false);
    s.setPrefs("ro-test-view", prefs);
    expect(stored.has("lumineo.jobs.view.ro-test-view")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("is everyone but Admin / Developer / Ops (and the demo sandbox)", () => {
    const editors = Object.entries(TYPE_CONFIG).filter(([, c]) => c.editJobs).map(([t]) => t).sort();
    expect(editors).toEqual(["admin", "demo", "developer", "ops"]);
  });
});
