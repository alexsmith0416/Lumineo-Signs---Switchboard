// Deep links from a job card to Business Central and the SharePoint job folder.
// Tweak these constants if BC's company/page id or the SharePoint site changes.

// Tenant + environment in the path: without them BC first looks up the
// user's default environment and redirects (slower, and can land in UAT).
export const BC_ORIGIN =
  "https://businesscentral.dynamics.com/fe0182fa-d183-46ab-8493-9e8ea9c3d0b8/Production";
const BC_COMPANY = "Luminous Neon";
const BC_JOB_PAGE = 88; // Job / Project card

/**
 * True when `jobNo` can be a BC project number (J38696 style). Install cards
 * with no job number carry their title in `jobNo` ("EDUCATION CENTER-Olathe
 * Schools"); BC rejects a filter over 20 characters, and a short name opens
 * BC's blank new-project card. A real number has no spaces and has digits.
 */
export function isBcJobNo(jobNo: string | null | undefined): boolean {
  const v = (jobNo ?? "").trim();
  return v.length > 0 && v.length <= 20 && !/\s/.test(v) && /\d/.test(v);
}

/** BC Job/Project card, filtered to this job number (opens that job). */
export function bcJobUrl(jobNo: string): string {
  const filter = `'No.' IS '${jobNo}'`;
  const qs = `company=${encodeURIComponent(BC_COMPANY)}&page=${BC_JOB_PAGE}&filter=${encodeURIComponent(filter)}`;
  return `${BC_ORIGIN}/?${qs}`;
}

const SP_SITE = "https://luminousneon.sharepoint.com/sites/JobFiles";

/**
 * SharePoint search for the job number within the JobFiles site. The folder
 * path isn't derivable from the number (it's nested under
 * letter / customer / category / city), so we search and let the user open the
 * matching folder.
 */
export function sharepointJobUrl(jobNo: string): string {
  return `${SP_SITE}/_layouts/15/search.aspx/?q=${encodeURIComponent(jobNo)}`;
}
