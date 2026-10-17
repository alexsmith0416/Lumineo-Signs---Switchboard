import { describe, expect, it } from "vitest";
import { cardStepKey, deptKeyForName } from "./production-steps";
import { bcStepForDepartmentName } from "./bc-planning-sync";
import { defaultScheme } from "./board-colors";

// Lawrence (NEK) is a production lane for a location that only does vinyl.
describe("a location lane that does one department's work", () => {
  it("counts the Lawrence lane as Vinyl / Graphics — stepper, BC step and colour", () => {
    expect(deptKeyForName("Lawrence")).toBe("V");
    expect(deptKeyForName(" lawrence ")).toBe("V");
    expect(cardStepKey("production", "Lawrence")).toBe("V");
    expect(bcStepForDepartmentName("Lawrence")).toBe(bcStepForDepartmentName("Vinyl / Graphics"));
    expect(defaultScheme({ name: "Lawrence", color: "#cccccc" }).bg).toBe("#C8E6D4");
  });

  it("only matches the exact name — a city in task text isn't vinyl", () => {
    expect(deptKeyForName("Install sign at Lawrence Memorial")).toBeNull();
    expect(cardStepKey("installation", "Lawrence")).toBe("I");
  });
});
