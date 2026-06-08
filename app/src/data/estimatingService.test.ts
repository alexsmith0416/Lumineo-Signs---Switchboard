import { describe, expect, it } from "vitest";
import { buildEstimatingPayload, buildEstimatingUrl, ESTIMATING_PAYLOAD_VERSION } from "./estimatingService";
import { emptySignSpec } from "../domain/SignSpec";

describe("buildEstimatingPayload", () => {
  it("packs every cross-app linkage into the payload", () => {
    const spec = {
      ...emptySignSpec(),
      id: "spec-123",
      name: "Main Entry Cabinet",
      productCode: "WC-DF-IL-RFPB",
      customerName: "Westview",
      projectName: "Main Entry",
      jobId: "job-456",
      opportunityId: "opp-789",
      signTypeCode: "WC" as const,
      faces: "DF" as const,
      faceType: "RFPB" as const,
      heightIn: "48",
      widthIn: "84",
    };
    const p = buildEstimatingPayload(spec);
    expect(p.version).toBe(ESTIMATING_PAYLOAD_VERSION);
    expect(p.source).toBe("sign-builder-pro");
    expect(p.specId).toBe("spec-123");
    expect(p.jobId).toBe("job-456");
    expect(p.opportunityId).toBe("opp-789");
    expect(p.customerName).toBe("Westview");
    expect(p.signName).toBe("Main Entry Cabinet");
    expect(p.pieces[0].pieceType).toBe("Df Routed Cabinet");
  });

  it("launch-context jobId / opportunityId override the spec's stored values", () => {
    const spec = { ...emptySignSpec(), signTypeCode: "WC" as const, faces: "SF" as const, faceType: "AT" as const, jobId: "spec-job" };
    const p = buildEstimatingPayload(spec, { jobId: "launch-job", opportunityId: "launch-opp" });
    expect(p.jobId).toBe("launch-job");
    expect(p.opportunityId).toBe("launch-opp");
  });
});

describe("buildEstimatingUrl", () => {
  const payload = {
    version: 1,
    source: "sign-builder-pro" as const,
    sentAt: "2026-01-01T00:00:00.000Z",
    pieces: [],
  };

  it("appends a hash + payload param when the base URL has no hash", () => {
    const url = buildEstimatingUrl(payload, "https://estimating.lumineosigns.com/");
    expect(url).toMatch(/^https:\/\/estimating\.lumineosigns\.com\/#\/import\?payload=[A-Za-z0-9_-]+$/);
  });

  it("merges into an existing hash + query string", () => {
    const url = buildEstimatingUrl(payload, "https://estimating.lumineosigns.com/#/import?foo=bar");
    expect(url).toContain("foo=bar");
    expect(url).toContain("payload=");
  });

  it("uses base64url encoding (no + or / or padding)", () => {
    const url = buildEstimatingUrl(payload, "https://example.com/");
    const encoded = url.split("payload=")[1];
    expect(encoded).not.toMatch(/[+/=]/);
  });
});
