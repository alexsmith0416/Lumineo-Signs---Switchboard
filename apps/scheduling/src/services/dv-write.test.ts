import { describe, expect, it } from "vitest";
import {
  WRITE_ATTEMPTS,
  isRetryableWriteError,
  writeErrorMessage,
  writeRetryDelay,
} from "./dv-write";

describe("isRetryableWriteError", () => {
  it("retries the infrastructure failures that ate people's edits", () => {
    for (const msg of [
      "Failed to fetch",
      "The operation timed out",
      "429 Too Many Requests",
      "503 Service Unavailable",
      "socket hang up",
      "Invalid organization URL 'null' provided",
      "network error",
    ]) {
      expect(isRetryableWriteError(msg), msg).toBe(true);
    }
  });

  it("retries an UNRECOGNISED failure — the old whitelist's fatal gap", () => {
    // A message nobody anticipated must not cost the user their edit.
    expect(isRetryableWriteError("Something nobody has ever seen before")).toBe(true);
    expect(isRetryableWriteError("")).toBe(true);
  });

  it("does not retry a request that is itself wrong", () => {
    for (const msg of [
      "400 Bad Request",
      "403 Forbidden",
      "404 Not Found",
      "409 Conflict: duplicate record",
      "413 payload too large",
      "Could not find a property named 'crfdf_nope'",
      "Invalid value for column",
      "The field is read-only",
      "Principal user is missing prvWriteCustom privilege",
    ]) {
      expect(isRetryableWriteError(msg), msg).toBe(false);
    }
  });
});

describe("writeErrorMessage", () => {
  it("reads a thrown Error", () => {
    expect(writeErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads an SDK-shaped result", () => {
    expect(writeErrorMessage({ error: { message: "503 unavailable" } })).toBe("503 unavailable");
  });

  it("reads a plain object with a message", () => {
    expect(writeErrorMessage({ message: "nope" })).toBe("nope");
  });

  it("handles strings, null and undefined without throwing", () => {
    expect(writeErrorMessage("raw")).toBe("raw");
    expect(writeErrorMessage(null)).toBe("");
    expect(writeErrorMessage(undefined)).toBe("");
  });

  it("survives a circular object", () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(() => writeErrorMessage(o)).not.toThrow();
  });
});

describe("writeRetryDelay", () => {
  it("backs off exponentially and caps", () => {
    expect(writeRetryDelay(1)).toBe(200);
    expect(writeRetryDelay(2)).toBe(400);
    expect(writeRetryDelay(3)).toBe(800);
    expect(writeRetryDelay(4)).toBe(1600);
    expect(writeRetryDelay(5)).toBe(2000);
    expect(writeRetryDelay(99)).toBe(2000);
  });

  it("spans a few seconds across the full attempt budget", () => {
    let total = 0;
    for (let i = 1; i < WRITE_ATTEMPTS; i++) total += writeRetryDelay(i);
    expect(total).toBeGreaterThan(2000);
    expect(total).toBeLessThan(6000);
  });
});
