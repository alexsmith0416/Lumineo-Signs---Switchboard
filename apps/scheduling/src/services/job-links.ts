// Deep links from a job card to Business Central and the SharePoint job folder.
// Tweak these constants if BC's company/page id or the SharePoint site changes.

const BC_ORIGIN = "https://businesscentral.dynamics.com";
const BC_COMPANY = "Luminous Neon";
const BC_JOB_PAGE = 88; // Job / Project card

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
