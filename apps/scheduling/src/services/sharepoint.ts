/**
 * SharePoint, straight from the app (JobFiles site) — for the Jobs list's
 * Sketch column: list a job's folder, upload a file into it, and download a
 * file's bytes (services/sketch-render.ts draws its thumbnail).
 *
 * The SharePoint connector is registered for this app (power.config.json, data
 * source "documents" on the JobFiles site), but code apps only generate its
 * table CRUD. Its actions are still callable through the same runtime: the
 * runtime builds a call from an `apis` entry (path template + parameters), so
 * the two actions we need — "Send an HTTP request to SharePoint" (HttpRequest)
 * and "Create file" (CreateFile) — are described here and added to the
 * generated data-source info for our own client. The site (dataset) comes from
 * the connection reference.
 */
import { getClient } from "@microsoft/power-apps/data";
import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo";

const DS = "documents";
export const SP_ORIGIN = "https://luminousneon.sharepoint.com";
export const SP_LIBRARY = "/sites/JobFiles/Shared Documents";

const path = (name: string) => ({ name, in: "path", required: true, type: "string" });
const SP_ACTIONS = {
  HttpRequest: {
    path: "/{connectionId}/datasets/{dataset}/httprequest",
    method: "POST",
    parameters: [path("connectionId"), path("dataset"), { name: "parameters", in: "body", required: true, type: "object" }],
    responseInfo: { "200": { type: "object" }, default: { type: "void" } },
  },
  CreateFile: {
    path: "/{connectionId}/datasets/{dataset}/files",
    method: "POST",
    parameters: [
      path("connectionId"),
      path("dataset"),
      { name: "folderPath", in: "query", required: true, type: "string" },
      { name: "name", in: "query", required: true, type: "string" },
      { name: "queryParametersSingleEncoded", in: "query", required: false, type: "boolean" },
      { name: "body", in: "body", required: true, type: "string", format: "binary" },
    ],
    responseInfo: { "200": { type: "object" }, default: { type: "void" } },
  },
  // inferContentType=false → application/octet-stream → the runtime hands back
  // the raw bytes (a Uint8Array); anything else non-JSON comes back as text.
  GetFileContentByPath: {
    path: "/{connectionId}/datasets/{dataset}/GetFileContentByPath",
    method: "GET",
    parameters: [
      path("connectionId"),
      path("dataset"),
      { name: "path", in: "query", required: true, type: "string" },
      { name: "inferContentType", in: "query", required: false, type: "boolean" },
      { name: "queryParametersSingleEncoded", in: "query", required: false, type: "boolean" },
    ],
    responseInfo: { "200": { type: "string", format: "binary" }, default: { type: "void" } },
  },
};

// The runtime loads the data-source info ONCE (from whichever client calls
// first — the generated Dataverse service) and keeps references to each data
// source's object. So the actions are added INTO the generated "documents"
// entry itself; a separate merged copy would never be seen.
const info = dataSourcesInfo as unknown as Record<string, { apis: Record<string, unknown> }>;
Object.assign(info[DS]!.apis, SP_ACTIONS);
const client = getClient(dataSourcesInfo);

interface Result {
  success: boolean;
  data?: unknown;
  error?: { message?: string };
}

async function spRequest(method: "GET" | "POST", uri: string, body?: unknown): Promise<unknown> {
  const res = (await client.executeAsync({
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

export interface SpFile {
  name: string;
  /** Server-relative path: "/sites/JobFiles/Shared Documents/G/…/J38740 YMCA_Wall Sign.pdf". */
  fileRef: string;
  /** "pdf", "jpg", … */
  type: string;
  /** As SharePoint shows it ("7/17/2026 11:43 AM"). */
  modified: string;
  /** The subfolder under the job folder it's in ("" = the job folder itself). */
  folder: string;
}

/** A job folder link (crfdf_sharepointurl) → its server-relative path. */
export function folderPathOf(folderUrl: string): string {
  return "/" + folderUrl.trim().split("/").slice(3).join("/");
}

/** Browser link for a server-relative file path. */
export function fileUrlOf(fileRef: string): string {
  return SP_ORIGIN + fileRef.replace(/%/g, "%25").replace(/ /g, "%20").replace(/#/g, "%23");
}

/** Server-relative path of a SharePoint file link (the reverse of fileUrlOf). */
export function fileRefOf(fileUrl: string): string {
  const path = fileUrl.startsWith(SP_ORIGIN) ? fileUrl.slice(SP_ORIGIN.length) : fileUrl;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** SharePoint's own download link for a file (opens in a new tab and downloads it). */
export function downloadUrlOf(fileUrl: string): string {
  return `${SP_ORIGIN}/sites/JobFiles/_layouts/15/download.aspx?SourceUrl=${encodeURIComponent(fileUrl)}`;
}

/** Every file in a job's folder and its subfolders, newest first. */
export async function listJobFiles(folderUrl: string): Promise<SpFile[]> {
  const folder = folderPathOf(folderUrl);
  const viewXml =
    '<View Scope="RecursiveAll"><Query><Where><Eq><FieldRef Name="FSObjType"/><Value Type="Integer">0</Value></Eq></Where>' +
    '<OrderBy><FieldRef Name="Modified" Ascending="FALSE"/></OrderBy></Query><ViewFields><FieldRef Name="FileLeafRef"/>' +
    '<FieldRef Name="FileRef"/><FieldRef Name="File_x0020_Type"/><FieldRef Name="Modified"/></ViewFields><RowLimit>1000</RowLimit></View>';
  const data = (await spRequest(
    "POST",
    `_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@a1='${encodeURIComponent(SP_LIBRARY)}'`,
    { parameters: { RenderOptions: 2, FolderServerRelativeUrl: folder, ViewXml: viewXml } },
  )) as { Row?: Array<Record<string, string>> };
  return (data?.Row ?? []).map((r) => {
    const fileRef = r.FileRef ?? "";
    const dir = fileRef.slice(0, fileRef.lastIndexOf("/"));
    return {
      name: r.FileLeafRef ?? "",
      fileRef,
      type: (r.File_x0020_Type ?? "").toLowerCase(),
      modified: r.Modified ?? "",
      folder: dir.length > folder.length ? dir.slice(folder.length + 1) : "",
    };
  });
}

/** A file's bytes, downloaded through the connector (the app can't load
 *  SharePoint URLs directly — Power Apps blocks outside images and requests). */
export async function fileBytes(fileRef: string): Promise<Uint8Array> {
  const res = (await client.executeAsync({
    connectorOperation: {
      tableName: DS,
      operationName: "GetFileContentByPath",
      parameters: {
        path: fileRef.replace(/^\/sites\/[^/]+/, ""),
        inferContentType: false,
        queryParametersSingleEncoded: true,
      },
    },
  })) as Result;
  if (!res.success) throw new Error(res.error?.message ?? "Couldn't download the file from SharePoint");
  const data = res.data;
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === "string") {
    // base64 (image responses) — decode.
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  throw new Error("SharePoint returned the file in an unexpected form");
}

/** Upload a file into a job's folder (not a subfolder). Returns its server-relative path. */
export async function uploadToJobFolder(folderUrl: string, file: File): Promise<string> {
  const folder = folderPathOf(folderUrl);
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error ?? new Error("Couldn't read the file"));
    r.readAsDataURL(file);
  });
  // CreateFile's folder path is relative to the site: "/Shared Documents/G/…".
  const siteRelative = folder.replace(/^\/sites\/[^/]+/, "");
  const res = (await client.executeAsync({
    connectorOperation: {
      tableName: DS,
      operationName: "CreateFile",
      parameters: { folderPath: siteRelative, name: file.name, queryParametersSingleEncoded: true, body: base64 },
    },
  })) as Result;
  if (!res.success) throw new Error(res.error?.message ?? "Upload to SharePoint failed");
  return `${folder}/${file.name}`;
}
