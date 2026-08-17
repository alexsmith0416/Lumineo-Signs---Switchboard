import { describe, expect, it } from "vitest";
// Read our own source as text (Vite `?raw`) so this stays a plain browser-target
// test with no node imports.
import source from "./dataverse-live.ts?raw";

// Guard rail for the "my edit didn't take the first time" bug.
//
// Every Dataverse write must go through the retrying dv* helpers. When a write
// bypasses them, a single hiccup — most often the host bridge not being warm on
// the first action after load — fails the write, and the store's failure path
// throws the user's edit away. That invariant was written down in START-HERE and
// still drifted: 36 of 58 write calls had bypassed it by the time anyone looked.
// Prose doesn't hold a line; this test does.

/** The three helper bodies are the ONLY place allowed to touch the SDK write
 *  operations directly — they're what adds the retry. */
const ALLOWED_DIRECT_CALLS = 3;

describe("Dataverse write path", () => {
  it("routes every write through the retrying dv* helpers", () => {
    const direct = source.match(/S\.(Create|Update|Delete)RecordWithOrganization/g) ?? [];
    expect(
      direct.length,
      `Found ${direct.length} direct SDK write calls; only the ${ALLOWED_DIRECT_CALLS} inside ` +
        `dvCreate/dvUpdate/dvDelete are allowed. A write that skips them loses the user's ` +
        `edit on the first hiccup — route it through dvCreate/dvUpdate/dvDelete instead.`,
    ).toBe(ALLOWED_DIRECT_CALLS);
  });

  it("keeps those direct calls inside the helper definitions", () => {
    // Each allowed call sits in a `return S.XxxRecordWithOrganization(` line
    // inside its helper, rather than being awaited at a call site.
    const returned = source.match(/return S\.(Create|Update|Delete)RecordWithOrganization\(/g) ?? [];
    expect(returned).toHaveLength(ALLOWED_DIRECT_CALLS);
  });

  it("has the helpers go through writeWithRetry", () => {
    for (const helper of ["dvCreate", "dvUpdate", "dvDelete"]) {
      const body = source.slice(source.indexOf(`async function ${helper}`));
      const upToBrace = body.slice(0, body.indexOf("\n}"));
      expect(upToBrace, `${helper} must wrap its call in writeWithRetry`).toContain("writeWithRetry");
    }
  });
});
