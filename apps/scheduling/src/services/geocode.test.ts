import { describe, expect, it } from "vitest";
import { addressKey, orsGeocodeUrl, parseOrsGeocode } from "./geocode";

const HUTCH = { lat: 37.9782, lng: -97.9265 };
const feature = (lng: number, lat: number, layer = "address") => ({
  features: [{ geometry: { coordinates: [lng, lat] }, properties: { layer } }],
});

describe("geocoding", () => {
  it("builds a structured search with the address parts it has", () => {
    const url = new URL(orsGeocodeUrl({ address: " 1 Main St ", city: "Hutchinson", state: "KS", zip: "67501-1234" }));
    expect(url.origin + url.pathname).toBe("https://api.heigit.org/pelias/v1/search/structured");
    expect(url.searchParams.has("api_key")).toBe(false); // the key goes in the Authorization header
    expect(url.searchParams.get("address")).toBe("1 Main St");
    expect(url.searchParams.get("postalcode")).toBe("67501");
    expect(url.searchParams.get("country")).toBe("USA");
    expect(new URL(orsGeocodeUrl({ city: "Salina" })).searchParams.has("address")).toBe(false);
  });

  it("trusts a nearby street-level answer and rejects far or vague ones", () => {
    expect(parseOrsGeocode(feature(-97.93, 37.99), HUTCH)).toEqual({ lat: 37.99, lng: -97.93 });
    expect(parseOrsGeocode(feature(-94.5, 39.1), HUTCH)).toBeNull(); // Kansas City — another town's Main St
    expect(parseOrsGeocode(feature(-98, 38.5, "region"), HUTCH)).toBeNull(); // just "Kansas"
    expect(parseOrsGeocode({ features: [] }, HUTCH)).toBeNull();
    expect(parseOrsGeocode(feature(-94.5, 39.1), null)).toEqual({ lat: 39.1, lng: -94.5 }); // no ZIP to check against
  });

  it("compares addresses loosely", () => {
    expect(addressKey({ address: "1  Main St", city: "Hutchinson", state: "KS", zip: "67501-1" })).toBe(
      addressKey({ address: "1 main st", city: "HUTCHINSON", state: "ks", zip: "67501" }),
    );
  });
});
