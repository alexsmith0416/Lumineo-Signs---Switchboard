import { describe, expect, it } from "vitest";
import {
  VINYL_3630,
  VINYL_7725,
  matchesVinylSearch,
  swatchDisplayName,
} from "./vinylSwatches";

describe("vinyl swatch search (the modification carried over from preview)", () => {
  it("matches against the color name", () => {
    const cardinal = VINYL_3630.find((s) => s.name === "Cardinal Red")!;
    expect(matchesVinylSearch(cardinal, "cardinal")).toBe(true);
    expect(matchesVinylSearch(cardinal, "CARDINAL")).toBe(true);
    expect(matchesVinylSearch(cardinal, "Red")).toBe(true);
  });

  it("matches against the 3M color code", () => {
    const target = VINYL_7725.find((s) => s.code === "97")!;
    expect(matchesVinylSearch(target, "97")).toBe(true);
  });

  it("matches against the series number", () => {
    const t3630 = VINYL_3630[0];
    expect(matchesVinylSearch(t3630, "3630")).toBe(true);
  });

  it("returns true for an empty query (so the grid stays full)", () => {
    expect(matchesVinylSearch(VINYL_3630[0], "")).toBe(true);
    expect(matchesVinylSearch(VINYL_3630[0], "   ")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesVinylSearch(VINYL_3630[0], "chartreuse")).toBe(false);
  });

  it("formats the display name the way Dataverse stores it", () => {
    const s = { series: "3630" as const, code: "010", name: "White", hex: "#F5F5F5" };
    expect(swatchDisplayName(s)).toBe("3M 3630 — 010 White");
  });
});
