import { describe, expect, it } from "vitest";
import { isBcJobNo } from "./job-links";

describe("isBcJobNo", () => {
  it("accepts BC project numbers", () => {
    expect(isBcJobNo("J38696")).toBe(true);
    expect(isBcJobNo(" J103101 ")).toBe(true);
  });

  it("rejects card titles standing in for a job number", () => {
    expect(isBcJobNo("EDUCATION CENTER-Olathe Schools")).toBe(false);
    expect(isBcJobNo("Walmart")).toBe(false);
    expect(isBcJobNo("Store 12")).toBe(false);
  });

  it("rejects blanks and anything over BC's 20-character limit", () => {
    expect(isBcJobNo("")).toBe(false);
    expect(isBcJobNo(null)).toBe(false);
    expect(isBcJobNo("J123456789012345678901")).toBe(false);
  });
});
