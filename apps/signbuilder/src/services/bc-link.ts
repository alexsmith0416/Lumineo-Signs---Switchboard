/**
 * The Business Central link — never a call to BC itself (Switchboard's rule):
 *
 *  - Opportunities: crfdf_bcopportunity, filled by the BCSync_SBOpportunities
 *    flow when the app adds a crfdf_syncrequest row of kind "sbopportunities"
 *    (the picker does, on open / Refresh) — the flow writes Status / Result back.
 *  - Projects: crfdf_sbjob — every status but Completed (Planning / Quote too),
 *    filled by BCSync_SBJobs on a "sbjobs" request (the job picker asks the
 *    same way). BC's current descriptions: Switchboard's crfdf_jobdesc (Open
 *    projects only).
 *  - Generate to Project: a crfdf_sbdescpush row (Status "pending");
 *    BCPush_SBDescriptions writes it to the project through the Sign Builder
 *    extension's jobDescriptions API page and sets Status synced / failed.
 *
 * Live mode reads / writes Dataverse; the dev mock and the demo sandbox use
 * sample data so the screens can be tried without BC.
 */
import type { BcJob, BcOpportunity, DescPush, DescPushStatus, JobDescriptions } from "../domain/types";
import { dvCreate, listAll, odataLit, type Row } from "./dataverse-core";
import { repo } from "./repo";

export type SyncKind = "sbopportunities" | "sbjobs";
export const SYNC_FLOW: Record<SyncKind, string> = { sbopportunities: "BCSync_SBOpportunities", sbjobs: "BCSync_SBJobs" };

export interface SyncState {
  status: "requested" | "running" | "done" | "failed";
  result: string;
}

export interface QueuePush {
  jobNo: string;
  specId: string;
  production?: string;
  field?: string;
  requestedBy: string;
}

export interface BcLink {
  kind: "mock" | "live";
  searchOpportunities(query: string): Promise<BcOpportunity[]>;
  getOpportunity(no: string): Promise<BcOpportunity | null>;
  /** Asks the flow for the kind (BCSync_SBOpportunities / BCSync_SBJobs) to copy BC now; returns the request id. */
  requestSync(kind: SyncKind, requestedBy: string): Promise<string>;
  readSyncRequest(id: string): Promise<SyncState | null>;
  searchJobs(query: string): Promise<BcJob[]>;
  getJob(no: string): Promise<BcJob | null>;
  getJobDescriptions(jobNo: string): Promise<JobDescriptions | null>;
  queueDescriptions(push: QueuePush): Promise<string>;
  readPush(id: string): Promise<DescPush | null>;
  /** This spec's writes to BC, newest first. */
  pushesForSpec(specId: string): Promise<DescPush[]>;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const LIMIT = 40;
/** Not picked up after this long → the flow is probably off. */
export const PICKUP_LIMIT_MS = 5 * 60_000;
export const POLL_MS = 3000;

const matches = (q: string, ...fields: string[]) => {
  const t = q.trim().toLowerCase();
  return !t || fields.some((f) => f.toLowerCase().includes(t));
};

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

const SET = { opp: "crfdf_bcopportunities", job: "crfdf_sbjobs", desc: "crfdf_jobdescs", push: "crfdf_sbdescpushs", request: "crfdf_syncrequests" };

const oppFrom = (r: Row): BcOpportunity => ({
  no: s(r.crfdf_opportunityno).trim(),
  description: s(r.crfdf_description),
  contactNo: s(r.crfdf_contactno),
  contactName: s(r.crfdf_contactname),
  companyName: s(r.crfdf_companyname),
  salespersonCode: s(r.crfdf_salespersoncode).trim().toUpperCase(),
  status: s(r.crfdf_status),
  closed: r.crfdf_closed === true,
  creationDate: s(r.crfdf_creationdate),
  projectNo: s(r.crfdf_projectno).trim(),
});
const OPP_SELECT = "crfdf_opportunityno,crfdf_description,crfdf_contactno,crfdf_contactname,crfdf_companyname,crfdf_salespersoncode,crfdf_status,crfdf_closed,crfdf_creationdate,crfdf_projectno";

const jobFrom = (r: Row): BcJob => ({
  no: s(r.crfdf_jobno).trim(),
  name: s(r.crfdf_customername) || s(r.crfdf_description),
  customerName: s(r.crfdf_customername),
  description: s(r.crfdf_description),
  status: s(r.crfdf_status),
  personResponsible: s(r.crfdf_personresponsible).trim().toUpperCase(),
  creationDate: s(r.crfdf_creationdate),
});
const JOB_SELECT = "crfdf_jobno,crfdf_customername,crfdf_description,crfdf_status,crfdf_personresponsible,crfdf_creationdate";

const STATUSES: DescPushStatus[] = ["pending", "synced", "failed"];
const pushFrom = (r: Row): DescPush => {
  const st = s(r.crfdf_status).trim().toLowerCase();
  return {
    id: s(r.crfdf_sbdescpushid),
    jobNo: s(r.crfdf_jobno),
    specId: s(r.crfdf_specid),
    sendProduction: r.crfdf_sendproduction === true,
    sendField: r.crfdf_sendfield === true,
    status: (STATUSES as string[]).includes(st) ? (st as DescPushStatus) : "pending",
    message: s(r.crfdf_statusmessage),
    createdAt: s(r.createdon),
    requestedBy: s(r.crfdf_requestedby),
  };
};
const PUSH_SELECT = "crfdf_sbdescpushid,crfdf_jobno,crfdf_specid,crfdf_sendproduction,crfdf_sendfield,crfdf_status,crfdf_statusmessage,crfdf_requestedby,createdon";

function containsAny(q: string, cols: string[]): string | undefined {
  const t = q.trim();
  if (!t) return undefined;
  return cols.map((c) => `contains(${c},'${odataLit(t)}')`).join(" or ");
}

const live: BcLink = {
  kind: "live",
  async searchOpportunities(query) {
    const filter = containsAny(query, ["crfdf_opportunityno", "crfdf_description", "crfdf_companyname", "crfdf_contactname"]) ?? "crfdf_closed eq false";
    const rows = await listAll(SET.opp, { select: OPP_SELECT, filter, orderby: "crfdf_creationdate desc" });
    return rows.slice(0, LIMIT).map(oppFrom);
  },
  async getOpportunity(no) {
    const rows = await listAll(SET.opp, { select: OPP_SELECT, filter: `crfdf_opportunityno eq '${odataLit(no)}'` });
    return rows[0] ? oppFrom(rows[0]) : null;
  },
  async requestSync(kind, requestedBy) {
    const id = crypto.randomUUID();
    await dvCreate(SET.request, { crfdf_syncrequestid: id, crfdf_name: kind, crfdf_kind: kind, crfdf_status: "Requested", crfdf_requestedby: requestedBy || "Sign Builder" });
    return id;
  },
  async readSyncRequest(id) {
    const rows = await listAll(SET.request, { select: "crfdf_status,crfdf_result", filter: `crfdf_syncrequestid eq ${id}` });
    if (!rows[0]) return null;
    const st = s(rows[0].crfdf_status).trim().toLowerCase();
    return { status: st === "running" || st === "done" || st === "failed" ? st : "requested", result: s(rows[0].crfdf_result) };
  },
  async searchJobs(query) {
    const filter = containsAny(query, ["crfdf_jobno", "crfdf_customername", "crfdf_description"]);
    const rows = await listAll(SET.job, { select: JOB_SELECT, filter, orderby: "crfdf_creationdate desc" });
    return rows.slice(0, LIMIT).map(jobFrom);
  },
  async getJob(no) {
    const rows = await listAll(SET.job, { select: JOB_SELECT, filter: `crfdf_jobno eq '${odataLit(no)}'` });
    return rows[0] ? jobFrom(rows[0]) : null;
  },
  async getJobDescriptions(jobNo) {
    const rows = await listAll(SET.desc, { select: "crfdf_jobno,crfdf_proddesc,crfdf_fielddesc,crfdf_bcmodified", filter: `crfdf_jobno eq '${odataLit(jobNo)}'` });
    const r = rows[0];
    return r ? { jobNo, production: s(r.crfdf_proddesc), field: s(r.crfdf_fielddesc), bcModified: s(r.crfdf_bcmodified) } : null;
  },
  async queueDescriptions(p) {
    const id = crypto.randomUUID();
    await dvCreate(SET.push, {
      crfdf_sbdescpushid: id,
      crfdf_name: `${p.jobNo} – descriptions`,
      crfdf_jobno: p.jobNo,
      crfdf_specid: p.specId,
      crfdf_sendproduction: p.production !== undefined,
      crfdf_sendfield: p.field !== undefined,
      crfdf_productiondesc: p.production ?? "",
      crfdf_fielddesc: p.field ?? "",
      crfdf_status: "pending",
      crfdf_requestedby: p.requestedBy,
    });
    return id;
  },
  async readPush(id) {
    const rows = await listAll(SET.push, { select: PUSH_SELECT, filter: `crfdf_sbdescpushid eq ${id}` });
    return rows[0] ? pushFrom(rows[0]) : null;
  },
  async pushesForSpec(specId) {
    const rows = await listAll(SET.push, { select: PUSH_SELECT, filter: `crfdf_specid eq '${odataLit(specId)}'`, orderby: "createdon desc" });
    return rows.map(pushFrom);
  },
};

// ---------------------------------------------------------------------------
// Mock (dev + demo): sample BC data; writes "go through" after a moment.
// ---------------------------------------------------------------------------

const MOCK_OPPS: BcOpportunity[] = [
  { no: "OP000412", description: "Main ID channel letters + monument", contactNo: "CT1001", contactName: "Dana Ruiz", companyName: "Riverbend Dental", salespersonCode: "JM", status: "In Progress", closed: false, creationDate: "2026-09-28", projectNo: "" },
  { no: "OP000418", description: "Wall cabinet replacement faces", contactNo: "CT1022", contactName: "Sam Patel", companyName: "Northgate Credit Union", salespersonCode: "AS", status: "Won", closed: true, creationDate: "2026-09-12", projectNo: "J24-3105" },
  { no: "OP000421", description: "Pylon re-face and new EMC", contactNo: "CT1040", contactName: "Lee Morgan", companyName: "Prairie Fuel Stop", salespersonCode: "JM", status: "Not Started", closed: false, creationDate: "2026-10-06", projectNo: "" },
];
const MOCK_JOBS: BcJob[] = [
  { no: "J24-3118", name: "Riverbend Dental", customerName: "Riverbend Dental", description: "Channel letters + monument", status: "Planning", personResponsible: "JM", creationDate: "2026-10-09" },
  { no: "J24-3110", name: "Harbor Coffee Co.", customerName: "Harbor Coffee Co.", description: "Halo-lit channel letters", status: "Open", personResponsible: "JM", creationDate: "2026-09-30" },
  { no: "J24-3105", name: "Northgate Credit Union", customerName: "Northgate Credit Union", description: "Wall cabinet faces", status: "Open", personResponsible: "AS", creationDate: "2026-09-12" },
];
const mockDescs = new Map<string, JobDescriptions>([
  ["J24-3105", { jobNo: "J24-3105", production: "SIGN OVERVIEW\n• Work: Replacement faces\n", field: "Remove existing faces and install new faces.", bcModified: "2026-10-01T15:00:00Z" }],
]);
const mockPushes = new Map<string, DescPush & { production: string; field: string }>();
const mockRequests = new Map<string, { at: number }>();
const wait = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

const mock: BcLink = {
  kind: "mock",
  searchOpportunities: (q) => wait(MOCK_OPPS.filter((o) => matches(q, o.no, o.description, o.companyName, o.contactName))),
  getOpportunity: (no) => wait(MOCK_OPPS.find((o) => o.no === no) ?? null),
  async requestSync() {
    const id = crypto.randomUUID();
    mockRequests.set(id, { at: Date.now() });
    return wait(id);
  },
  async readSyncRequest(id) {
    const r = mockRequests.get(id);
    if (!r) return null;
    const t = Date.now() - r.at;
    return wait(t < 1200 ? { status: "running", result: "" } : { status: "done", result: "Up to date (sample data)" });
  },
  searchJobs: (q) => wait(MOCK_JOBS.filter((j) => matches(q, j.no, j.name, j.customerName, j.description))),
  getJob: (no) => wait(MOCK_JOBS.find((j) => j.no === no) ?? null),
  getJobDescriptions: (jobNo) => wait(mockDescs.get(jobNo) ?? null),
  async queueDescriptions(p) {
    const id = crypto.randomUUID();
    mockPushes.set(id, {
      id, jobNo: p.jobNo, specId: p.specId, sendProduction: p.production !== undefined, sendField: p.field !== undefined, status: "pending", message: "",
      createdAt: new Date().toISOString(), requestedBy: p.requestedBy, production: p.production ?? "", field: p.field ?? "",
    });
    // The "flow": a moment later it lands (unknown projects fail, as in BC).
    setTimeout(() => {
      const row = mockPushes.get(id);
      if (!row) return;
      if (!MOCK_JOBS.some((j) => j.no === p.jobNo)) {
        row.status = "failed";
        row.message = `Project ${p.jobNo} was not found in BC. (sample data)`;
        return;
      }
      row.status = "synced";
      row.message = `Written to project ${p.jobNo} in BC. (sample data)`;
      const cur = mockDescs.get(p.jobNo) ?? { jobNo: p.jobNo, production: "", field: "", bcModified: "" };
      mockDescs.set(p.jobNo, {
        ...cur,
        production: p.production ?? cur.production,
        field: p.field ?? cur.field,
        bcModified: new Date().toISOString(),
      });
    }, 1500);
    return wait(id);
  },
  async readPush(id) {
    const r = mockPushes.get(id);
    return wait(r ? { ...r } : null);
  },
  pushesForSpec: (specId) => wait([...mockPushes.values()].filter((p) => p.specId === specId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
};

/** Live only with the live repo (the demo sandbox and the dev mock use sample data). */
export function bcLink(): BcLink {
  return repo().kind === "live" ? live : mock;
}

/** What a sync request row means for the person waiting on it. */
export function syncMessage(state: SyncState | null, waitedMs: number, kind: SyncKind = "sbopportunities"): { phase: "waiting" | "running" | "done" | "failed"; text: string } {
  const flow = SYNC_FLOW[kind];
  if (!state) return { phase: "failed", text: "The request was removed before it finished." };
  if (state.status === "done") return { phase: "done", text: state.result || "Up to date." };
  if (state.status === "failed") return { phase: "failed", text: state.result || `${flow} couldn't read BC.` };
  if (state.status === "running") return { phase: "running", text: "Reading BC…" };
  if (waitedMs > PICKUP_LIMIT_MS) return { phase: "failed", text: `${flow} didn't pick the request up — is it turned on in Power Automate?` };
  return { phase: "waiting", text: "Asking BC…" };
}

/** What a description write means for the person waiting on it. */
export function pushMessage(push: DescPush | null, waitedMs: number): { phase: "waiting" | "done" | "failed"; text: string } {
  if (!push) return { phase: "failed", text: "The request was removed before it finished." };
  if (push.status === "synced") return { phase: "done", text: push.message || "Written to BC." };
  if (push.status === "failed") return { phase: "failed", text: push.message || "BC didn't accept the descriptions." };
  if (waitedMs > PICKUP_LIMIT_MS) return { phase: "failed", text: "BCPush_SBDescriptions hasn't picked it up — is it turned on in Power Automate? It will still go through once it is." };
  return { phase: "waiting", text: "Sending to BC…" };
}
