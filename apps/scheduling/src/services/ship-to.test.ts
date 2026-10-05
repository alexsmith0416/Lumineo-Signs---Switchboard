import { describe, expect, it } from "vitest";
import { formatShipTo, googleMapsUrl } from "./ship-to";

describe("formatShipTo", () => {
  it("joins street, city and state + zip", () => {
    expect(formatShipTo({ address: "123 Main St", city: "Salina", state: "KS", zip: "67401" })).toBe(
      "123 Main St, Salina, KS 67401",
    );
  });
  it("skips blank parts", () => {
    expect(formatShipTo({ address: " ", city: "Salina", state: "KS", zip: "" })).toBe("Salina, KS");
    expect(formatShipTo({ zip: "67401" })).toBe("67401");
  });
  it("is empty when there's nothing", () => {
    expect(formatShipTo(null)).toBe("");
    expect(formatShipTo({})).toBe("");
  });
});

describe("googleMapsUrl", () => {
  it("encodes the address as a search query", () => {
    expect(googleMapsUrl("123 Main St, Salina, KS 67401")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Salina%2C%20KS%2067401",
    );
  });
});
