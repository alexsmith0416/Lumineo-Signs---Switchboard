import { describe, expect, it } from "vitest";
import { deliveryPlace, RECEIVING_SITES, siteOrBlank, storageSpotsFor } from "./warehouse-sites";

describe("receiving sites", () => {
  it("lists Hutchinson's storage spots and none for sites without defined spots", () => {
    expect(storageSpotsFor("Hutchinson")).toContain("Warehouse - Floor");
    expect(storageSpotsFor("hutchinson ")).toContain("Bus Barn - Garage");
    expect(storageSpotsFor("Olathe")).toEqual([]);
    expect(storageSpotsFor("")).toEqual([]);
  });

  it("only defaults to a known site", () => {
    expect(siteOrBlank("wichita")).toBe("Wichita");
    expect(siteOrBlank("Dallas")).toBe("");
    expect(siteOrBlank(undefined)).toBe("");
    expect(RECEIVING_SITES).toContain("Olathe");
  });

  it("names a delivery's place from what's known", () => {
    expect(deliveryPlace({ site: "Hutchinson", location: "Vinyl Room" })).toBe("Hutchinson · Vinyl Room");
    expect(deliveryPlace({ site: "", location: "Supply Room" })).toBe("Supply Room");
    expect(deliveryPlace({ site: "Olathe", location: " " })).toBe("Olathe");
    expect(deliveryPlace({ location: "" })).toBe("");
  });
});
