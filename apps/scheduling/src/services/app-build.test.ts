import { describe, expect, it } from "vitest";
import { isOutdatedBuild, recordedBuild, shouldRecordBuild } from "./app-build";

describe("outdated-build check for shop-floor tick processing", () => {
  it("treats an older build than the recorded one as outdated", () => {
    expect(isOutdatedBuild(1_000, 2_000)).toBe(true);
  });

  it("lets the recorded build and newer ones process", () => {
    expect(isOutdatedBuild(2_000, 2_000)).toBe(false);
    expect(isOutdatedBuild(3_000, 2_000)).toBe(false);
  });

  it("never blocks when nothing is recorded or the value is damaged", () => {
    expect(isOutdatedBuild(1_000, undefined)).toBe(false);
    expect(isOutdatedBuild(1_000, "not a number")).toBe(false);
    expect(isOutdatedBuild(1_000, -5)).toBe(false);
  });

  it("never blocks a tab whose own build is unknown", () => {
    expect(isOutdatedBuild(0, 2_000)).toBe(false);
  });

  it("records only a newer build", () => {
    expect(shouldRecordBuild(3_000, 2_000)).toBe(true);
    expect(shouldRecordBuild(2_000, 2_000)).toBe(false);
    expect(shouldRecordBuild(1_000, 2_000)).toBe(false);
    expect(shouldRecordBuild(1_000, undefined)).toBe(true);
    expect(shouldRecordBuild(0, undefined)).toBe(false);
  });

  it("reads a recorded build saved as a number or a string", () => {
    expect(recordedBuild(1791342938290)).toBe(1791342938290);
    expect(recordedBuild("1791342938290")).toBe(1791342938290);
  });
});
