import { describe, expect, it } from "vitest";
import { defaultLoadName, reorderItems, type ShipmentItem } from "./types";

function item(partial: Partial<ShipmentItem> = {}): ShipmentItem {
  return {
    id: partial.id ?? "i1",
    jobNo: null,
    customerName: "",
    description: "",
    notes: "",
    location: "",
    kind: "delivery",
    loaded: false,
    ...partial,
  };
}

const a = item({ id: "a", customerName: "A", location: "Dodge City" });
const b = item({ id: "b", customerName: "B", location: "Garden City" });
const c = item({ id: "c", customerName: "C", location: "Olathe" });

describe("reorderItems", () => {
  it("moves an item down the list", () => {
    expect(reorderItems([a, b, c], 0, 2).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("moves an item up the list", () => {
    expect(reorderItems([a, b, c], 2, 0).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("moves an item by one position", () => {
    expect(reorderItems([a, b, c], 1, 0).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("returns the SAME array reference for a no-op move", () => {
    // The store leans on identity here to skip the write entirely.
    const items = [a, b, c];
    expect(reorderItems(items, 1, 1)).toBe(items);
  });

  it("returns the same array for out-of-range indexes", () => {
    const items = [a, b, c];
    expect(reorderItems(items, -1, 1)).toBe(items);
    expect(reorderItems(items, 0, 3)).toBe(items);
    expect(reorderItems(items, 5, 0)).toBe(items);
  });

  it("does not mutate the input", () => {
    const items = [a, b, c];
    reorderItems(items, 0, 2);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("handles a single-item and an empty list", () => {
    const one = [a];
    expect(reorderItems(one, 0, 0)).toBe(one);
    const none: ShipmentItem[] = [];
    expect(reorderItems(none, 0, 0)).toBe(none);
  });

  it("re-orders the stops in an auto-generated load name", () => {
    // The name lists stops in item order, so a reorder renames an auto-named load.
    const day = new Date(2026, 7, 13);
    expect(defaultLoadName(day, [a, b])).toBe("8/13 Dodge City & Garden City Load");
    expect(defaultLoadName(day, reorderItems([a, b], 1, 0))).toBe("8/13 Garden City & Dodge City Load");
  });
});
