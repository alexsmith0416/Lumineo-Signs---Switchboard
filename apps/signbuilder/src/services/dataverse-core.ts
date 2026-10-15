/**
 * Dataverse access through the Power Apps Dataverse connector — the same
 * pattern as Switchboard (apps/scheduling/src/services/dataverse-live.ts):
 *
 *  - The SDK is imported lazily: the generated client calls getClient() at
 *    module load and needs the Power Apps runtime (only under `pac code run`
 *    or the deployed app — never in `npm run dev` / tests).
 *  - Calls use the *WithOrganization variants with the org URL resolved once
 *    (GetOrganizations → app context → known fallback).
 *  - EVERY write goes through dvCreate / dvUpdate / dvDelete, which retry
 *    anything not positively permanent (services/dv-write.ts). Never call the
 *    SDK's write methods directly.
 *  - listAll follows paging past Dataverse's 5,000-row page cap.
 */
import { WRITE_ATTEMPTS, isRetryableWriteError, writeErrorMessage, writeRetryDelay } from "./dv-write";

export type Row = Record<string, unknown>;

const ACCEPT = "application/json";
const PREFER_READ = 'odata.include-annotations="*"';
const PREFER_WRITE = "return=representation";
const ORG_FALLBACK = "https://org8fa22efd.crm.dynamics.com";

type Svc = typeof import("../generated").MicrosoftDataverseService;

async function resolveOrg(S: Svc): Promise<string> {
  try {
    const r = await S.GetOrganizations();
    const url = r.success ? r.data?.value?.[0]?.Url : undefined;
    if (url) return url;
  } catch {
    /* fall through */
  }
  try {
    const { getContext } = await import("@microsoft/power-apps/app");
    const ctx = await getContext();
    if (ctx.app.dataverseOrgUrl) return ctx.app.dataverseOrgUrl;
  } catch {
    /* fall through */
  }
  return ORG_FALLBACK;
}

let sdkPromise: Promise<{ S: Svc; org: string }> | null = null;
async function sdk(): Promise<{ S: Svc; org: string }> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const S = (await import("../generated")).MicrosoftDataverseService;
      const org = await resolveOrg(S);
      if (!org) throw new Error("Could not resolve Dataverse organization URL");
      return { S, org };
    })();
  }
  try {
    return await sdkPromise;
  } catch (e) {
    sdkPromise = null;
    throw e;
  }
}

const isOrgUrlError = (msg: string) => /organization url/i.test(msg);

interface SdkResult {
  success: boolean;
  error?: { message?: string };
  data?: unknown;
}

async function writeWithRetry(op: () => Promise<SdkResult>, attempts = WRITE_ATTEMPTS): Promise<SdkResult> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: SdkResult;
    try {
      res = await op();
    } catch (e) {
      res = { success: false, error: { message: writeErrorMessage(e) } };
    }
    if (res.success) return res;
    lastMessage = res.error?.message ?? "";
    if (!isRetryableWriteError(lastMessage)) return res;
    if (attempt === attempts) break;
    if (isOrgUrlError(lastMessage)) sdkPromise = null;
    console.warn(`[dv] write attempt ${attempt} failed, retrying — ${lastMessage || "(no message)"}`);
    await new Promise((r) => setTimeout(r, writeRetryDelay(attempt)));
  }
  return { success: false, error: { message: lastMessage } };
}

function ensure(res: SdkResult, what: string): void {
  if (!res.success) throw new Error(res.error?.message || `${what} failed`);
}

export async function dvCreate(set: string, rec: Row): Promise<void> {
  ensure(
    await writeWithRetry(async () => {
      const { S, org } = await sdk();
      return S.CreateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, set, rec);
    }),
    `Create in ${set}`,
  );
}

export async function dvUpdate(set: string, id: string, rec: Row): Promise<void> {
  ensure(
    await writeWithRetry(async () => {
      const { S, org } = await sdk();
      return S.UpdateRecordWithOrganization(PREFER_WRITE, ACCEPT, org, set, id, rec);
    }),
    `Update in ${set}`,
  );
}

export async function dvDelete(set: string, id: string): Promise<void> {
  ensure(
    await writeWithRetry(async () => {
      const { S, org } = await sdk();
      return S.DeleteRecordWithOrganization(org, set, id);
    }),
    `Delete in ${set}`,
  );
}

/** Every row (follows @odata.nextLink past the 5,000-row page cap). */
export async function listAll(entitySet: string, opts: { select?: string; filter?: string; orderby?: string } = {}): Promise<Row[]> {
  const out: Row[] = [];
  let skiptoken: string | undefined;
  for (let page = 0; page < 50; page++) {
    const run = async () => {
      const { S, org } = await sdk();
      return S.ListRecordsWithOrganization(
        org, entitySet, PREFER_READ, ACCEPT, false, false,
        opts.select, opts.filter, opts.orderby, undefined, undefined, undefined, skiptoken,
      );
    };
    let res = await run();
    if (!res.success && isOrgUrlError(res.error?.message ?? "")) {
      sdkPromise = null;
      res = await run();
    }
    if (!res.success) throw new Error(res.error?.message ?? `ListRecords(${entitySet}) failed`);
    const data = res.data as { value?: Row[]; "@odata.nextLink"?: string } | undefined;
    out.push(...(data?.value ?? []).map((it) => ((it as { dynamicProperties?: Row }).dynamicProperties ?? it) as Row));
    const next = data?.["@odata.nextLink"];
    const token = next ? new URL(next).searchParams.get("$skiptoken") : null;
    if (!token) break;
    skiptoken = token;
  }
  return out;
}

export const odataLit = (v: string) => v.replace(/'/g, "''");
