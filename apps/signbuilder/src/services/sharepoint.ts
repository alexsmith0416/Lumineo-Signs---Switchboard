/**
 * The job's SharePoint folder (JobFiles site) — for Design Reference: find a
 * job's folder and list its files so the designer can pick the reference
 * file(s).
 *
 * Same approach as Switchboard (apps/scheduling/src/services/sharepoint.ts):
 * the SharePoint connector is registered for this app (power.config.json, data
 * source "documents" on JobFiles); code apps only generate its table CRUD, so
 * "Send an HTTP request to SharePoint" (HttpRequest) is described here and
 * added to the generated data-source info. The SDK is imported lazily (it
 * needs the Power Apps runtime — never in `npm run dev` / tests).
 *
 * Finding the folder: Switchboard's crfdf_bcjob.crfdf_sharepointurl when the
 * job is there (Open jobs — BCSync_SharePoint fills it daily), else the same
 * SharePoint search that flow uses ("J40254 IsContainer:true"), so Planning /
 * Quote jobs are found too.
 */
import type { DesignFile } from "../domain/types";
import { listAll, odataLit } from "./dataverse-core";
import { repo } from "./repo";

export const SP_ORIGIN = "https://luminousneon.sharepoint.com";
export const SP_SITE = `${SP_ORIGIN}/sites/JobFiles`;
const SP_LIBRARY = "/sites/JobFiles/Shared Documents";
const DS = "documents";

export interface SpFile extends DesignFile {
  /** "pdf", "jpg", … */
  type: string;
  /** As SharePoint shows it ("7/17/2026 11:43 AM"). */
  modified: string;
  /** The subfolder under the job folder it's in ("" = the job folder itself). */
  folder: string;
}

interface Result {
  success: boolean;
  data?: unknown;
  error?: { message?: string };
}

type Client = { executeAsync: (req: unknown) => Promise<unknown> };
let clientPromise: Promise<Client> | null = null;
function client(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ getClient }, { dataSourcesInfo }] = await Promise.all([
        import("@microsoft/power-apps/data"),
        import("../../.power/schemas/appschemas/dataSourcesInfo"),
      ]);
      const path = (name: string) => ({ name, in: "path", required: true, type: "string" });
      // The runtime keeps references to each data source's object, so the
      // action goes INTO the generated "documents" entry.
      const info = dataSourcesInfo as unknown as Record<string, { apis: Record<string, unknown> }>;
      Object.assign(info[DS]!.apis, {
        HttpRequest: {
          path: "/{connectionId}/datasets/{dataset}/httprequest",
          method: "POST",
          parameters: [path("connectionId"), path("dataset"), { name: "parameters", in: "body", required: true, type: "object" }],
          responseInfo: { "200": { type: "object" }, default: { type: "void" } },
        },
      });
      return getClient(dataSourcesInfo) as unknown as Client;
    })();
  }
  return clientPromise;
}

async function spRequest(method: "GET" | "POST", uri: string, body?: unknown): Promise<unknown> {
  const res = (await (await client()).executeAsync({
    connectorOperation: {
      tableName: DS,
      operationName: "HttpRequest",
      parameters: {
        parameters: {
          method,
          uri,
          headers: { Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata" },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
      },
    },
  })) as Result;
  if (!res.success) throw new Error(res.error?.message ?? `SharePoint ${method} ${uri} failed`);
  return res.data;
}

/** A folder link → its server-relative path ("/sites/JobFiles/Shared Documents/…"). */
export function folderPathOf(folderUrl: string): string {
  return "/" + folderUrl.trim().split("/").slice(3).join("/");
}

/** Browser link for a server-relative path (file or folder). */
export function spUrlOf(ref: string): string {
  return SP_ORIGIN + ref.replace(/%/g, "%25").replace(/ /g, "%20").replace(/#/g, "%23");
}

/** SharePoint's search for the job number — the fallback when no folder is found. */
export function spSearchUrl(jobNo: string): string {
  return `${SP_SITE}/_layouts/15/search.aspx/?q=${encodeURIComponent(jobNo)}`;
}

/** The folder whose last part is the job number (or starts with it: "J40254 Phase 2"). */
export function pickJobFolder(paths: string[], jobNo: string): string {
  const no = jobNo.trim().toUpperCase();
  const last = (p: string) => decodeURIComponent(p.replace(/\/+$/, "").split("/").pop() ?? "").toUpperCase();
  return paths.find((p) => last(p) === no) ?? paths.find((p) => new RegExp(`^${no.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(last(p))) ?? "";
}

export interface SharePoint {
  /** The job's folder link, or "" when SharePoint doesn't have one (yet). */
  findJobFolder(jobNo: string): Promise<string>;
  /** Every file in the folder and its subfolders, newest first. */
  listFiles(folderUrl: string): Promise<SpFile[]>;
}

const live: SharePoint = {
  async findJobFolder(jobNo) {
    try {
      const rows = await listAll("crfdf_bcjobs", { select: "crfdf_sharepointurl", filter: `crfdf_jobnumber eq '${odataLit(jobNo)}'` });
      const url = String(rows[0]?.crfdf_sharepointurl ?? "").trim();
      if (url) return url;
    } catch {
      /* not in Switchboard's copy — search */
    }
    const q = encodeURIComponent(`${jobNo} IsContainer:true`);
    const data = (await spRequest("GET", `_api/search/query?querytext='${q}'&selectproperties='Path,Title'&rowlimit=10`)) as Record<string, unknown>;
    type Rows = Array<{ Cells: Array<{ Key: string; Value: string }> | { results: Array<{ Key: string; Value: string }> } }>;
    const root = ((data?.d as Record<string, unknown>)?.query ?? data) as { PrimaryQueryResult?: { RelevantResults?: { Table?: { Rows?: Rows | { results: Rows } } } } };
    const rowsRaw = root?.PrimaryQueryResult?.RelevantResults?.Table?.Rows;
    const rows = (Array.isArray(rowsRaw) ? rowsRaw : rowsRaw?.results ?? []) as Rows;
    const paths = rows
      .map((r) => {
        const cells = Array.isArray(r.Cells) ? r.Cells : r.Cells?.results ?? [];
        return cells.find((c) => c.Key === "Path")?.Value ?? "";
      })
      .filter((p) => p.toLowerCase().startsWith(SP_SITE.toLowerCase() + "/"));
    return pickJobFolder(paths, jobNo);
  },
  async listFiles(folderUrl) {
    const folder = folderPathOf(folderUrl);
    const viewXml =
      '<View Scope="RecursiveAll"><Query><Where><Eq><FieldRef Name="FSObjType"/><Value Type="Integer">0</Value></Eq></Where>' +
      '<OrderBy><FieldRef Name="Modified" Ascending="FALSE"/></OrderBy></Query><ViewFields><FieldRef Name="FileLeafRef"/>' +
      '<FieldRef Name="FileRef"/><FieldRef Name="File_x0020_Type"/><FieldRef Name="Modified"/></ViewFields><RowLimit>1000</RowLimit></View>';
    const data = (await spRequest("POST", `_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@a1='${encodeURIComponent(SP_LIBRARY)}'`, {
      parameters: { RenderOptions: 2, FolderServerRelativeUrl: folder, ViewXml: viewXml },
    })) as { Row?: Array<Record<string, string>> };
    return (data?.Row ?? []).map((r) => {
      const ref = r.FileRef ?? "";
      const dir = ref.slice(0, ref.lastIndexOf("/"));
      return {
        name: r.FileLeafRef ?? "",
        ref,
        type: (r.File_x0020_Type ?? "").toLowerCase(),
        modified: r.Modified ?? "",
        folder: dir.length > folder.length ? dir.slice(folder.length + 1) : "",
      };
    });
  },
};

// Dev mock / demo sandbox: a made-up job folder.
const MOCK_FOLDER = `${SP_SITE}/Shared Documents/S/SAMPLE CUSTOMER/SAMPLE SITE/Wichita`;
const mockFile = (jobNo: string, folder: string, name: string, modified: string): SpFile => ({
  name,
  ref: `${folderPathOf(MOCK_FOLDER)}/${jobNo}${folder ? "/" + folder : ""}/${name}`,
  type: name.split(".").pop()!.toLowerCase(),
  modified,
  folder,
});
const mock: SharePoint = {
  async findJobFolder(jobNo) {
    return jobNo ? `${MOCK_FOLDER}/${jobNo}` : "";
  },
  async listFiles(folderUrl) {
    const jobNo = folderUrl.split("/").pop() ?? "";
    return [
      mockFile(jobNo, "Art", `${jobNo} Monument Sign_Rev 2.pdf`, "10/14/2026 3:12 PM"),
      mockFile(jobNo, "Art", `${jobNo} Monument Sign_Rev 1.pdf`, "10/9/2026 10:40 AM"),
      mockFile(jobNo, "Art", `${jobNo} Wall Sign.ai`, "10/8/2026 9:05 AM"),
      mockFile(jobNo, "Photos", "Site photo 1.jpg", "10/2/2026 1:22 PM"),
      mockFile(jobNo, "", `${jobNo} Survey.pdf`, "9/30/2026 4:51 PM"),
    ];
  },
};

export function sharePoint(): SharePoint {
  return repo().kind === "live" ? live : mock;
}
