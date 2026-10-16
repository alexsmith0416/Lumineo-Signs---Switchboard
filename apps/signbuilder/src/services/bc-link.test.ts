import { describe, expect, it } from "vitest";
import type { BcOpportunity, Spec } from "../domain/types";
import { jobFields, opportunityFields } from "./bc-fill";
import { bcLink, pushMessage, syncMessage } from "./bc-link";

const spec = { description: "", customerName: "", contactName: "", jobNo: "", opportunityNo: "" } as Spec;
const opp: BcOpportunity = {
  no: "OP1", description: "Monument", contactNo: "C1", contactName: "Dana", companyName: "Riverbend", salespersonCode: "JM", status: "Won", closed: true, creationDate: "", projectNo: "J1",
};

describe("filling a spec from BC", () => {
  it("fills blanks, keeps what's typed, takes the project made from the opportunity", () => {
    expect(opportunityFields(spec, opp)).toEqual({ opportunityNo: "OP1", description: "Monument", customerName: "Riverbend", contactName: "Dana", jobNo: "J1" });
    const typed = { ...spec, customerName: "Riverbend Dental LLC", jobNo: "J9" };
    expect(opportunityFields(typed, opp)).toMatchObject({ customerName: "Riverbend Dental LLC", jobNo: "J9" });
    expect(jobFields(spec, { no: "J2", name: "Harbor", customerName: "", description: "Letters", status: "Planning", personResponsible: "", creationDate: "" })).toEqual({
      jobNo: "J2", customerName: "Harbor", description: "Letters",
    });
  });
});

describe("mock BC link (dev / demo)", () => {
  it("searches, syncs and writes descriptions that come back in 'In BC now'", async () => {
    const bc = bcLink();
    expect(bc.kind).toBe("mock");
    expect((await bc.searchOpportunities("riverbend")).map((o) => o.no)).toEqual(["OP000412"]);
    // Projects before they're Open are listed too.
    expect((await bc.searchJobs("")).some((j) => j.status === "Planning")).toBe(true);
    const req = await bc.requestSync("sbopportunities", "Alex");
    await new Promise((r) => setTimeout(r, 1300));
    expect(syncMessage(await bc.readSyncRequest(req), 1300).phase).toBe("done");

    const id = await bc.queueDescriptions({ jobNo: "J24-3110", specId: "S1", field: "New field text", requestedBy: "Alex" });
    expect(pushMessage(await bc.readPush(id), 0).phase).toBe("waiting");
    await new Promise((r) => setTimeout(r, 1600));
    expect(pushMessage(await bc.readPush(id), 1600).phase).toBe("done");
    expect((await bc.getJobDescriptions("J24-3110"))!.field).toBe("New field text");
    expect((await bc.pushesForSpec("S1"))[0]!.sendProduction).toBe(false);

    const bad = await bc.queueDescriptions({ jobNo: "NOPE", specId: "S1", production: "x", requestedBy: "Alex" });
    await new Promise((r) => setTimeout(r, 1600));
    expect(pushMessage(await bc.readPush(bad), 1600)).toMatchObject({ phase: "failed" });
  }, 15_000);

  it("says when a flow never picked the request up", () => {
    expect(syncMessage({ status: "requested", result: "" }, 6 * 60_000).text).toContain("turned on");
    expect(syncMessage({ status: "requested", result: "" }, 6 * 60_000, "sbjobs").text).toContain("BCSync_SBJobs");
    expect(pushMessage({ status: "pending" } as never, 6 * 60_000).text).toContain("turned on");
  });
});
