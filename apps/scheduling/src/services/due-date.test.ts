import { describe, expect, it } from "vitest";
import { dueDateOrNull } from "./due-date";

describe("dueDateOrNull", () => {
  it("reads an old date-only save (exactly UTC midnight) as that calendar day here", () => {
    const d = dueDateOrNull("2026-06-12T00:00:00Z")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 5, 12, 0]);
  });

  it("keeps a real time as it is (new saves: local midnight)", () => {
    const local = new Date(2026, 5, 12);
    expect(dueDateOrNull(local.toISOString())!.getTime()).toBe(local.getTime());
  });

  it("returns null for empty or bad values", () => {
    expect(dueDateOrNull(null)).toBeNull();
    expect(dueDateOrNull("")).toBeNull();
    expect(dueDateOrNull("not a date")).toBeNull();
  });
});
