import { describe, expect, it } from "vitest";
import { matrixBody, parseMatrix, parseRoute, routeBody, thin } from "./ors-routing";

const A = { lat: 38, lng: -97.9 };
const B = { lat: 38.5, lng: -97.6 };

describe("openrouteservice routing", () => {
  it("sends lng,lat pairs in miles", () => {
    expect(matrixBody([A, B])).toEqual({ locations: [[-97.9, 38], [-97.6, 38.5]], metrics: ["duration", "distance"], units: "mi" });
    expect(routeBody([A, B]).coordinates).toEqual([[-97.9, 38], [-97.6, 38.5]]);
  });

  it("reads a matrix in hours and fills an unroutable pair with the estimate", () => {
    const m = parseMatrix({ durations: [[0, 3600], [null, 0]], distances: [[0, 50], [null, 0]] }, [A, B])!;
    expect(m.source).toBe("road");
    expect(m.hours[0]![1]).toBe(1);
    expect(m.miles[0]![1]).toBe(50);
    expect(m.hours[1]![0]).toBeGreaterThan(0); // estimate
    expect(parseMatrix({ durations: [[0]] }, [A, B])).toBeNull();
  });

  it("reads a route's line and legs", () => {
    const r = parseRoute({
      features: [
        {
          geometry: { coordinates: [[-97.9, 38], [-97.8, 38.2], [-97.6, 38.5]] },
          properties: { segments: [{ duration: 1800, distance: 30 }] },
        },
      ],
    })!;
    expect(r.line[0]).toEqual({ lat: 38, lng: -97.9 });
    expect(r.legs).toEqual([{ hours: 0.5, miles: 30 }]);
    expect(parseRoute({ features: [] })).toBeNull();
  });

  it("thins a long line but keeps both ends", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => i);
    const t = thin(pts, 100);
    expect(t).toHaveLength(100);
    expect(t[0]).toBe(0);
    expect(t[99]).toBe(999);
  });
});
