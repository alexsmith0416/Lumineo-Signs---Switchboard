// Synthetic Jobs-view data for the dev server (made-up customers — no real job
// data in the repo). Shaped like the imported Airtable list: a spread of
// statuses, holds, vendors and regions, plus BC jobs with no tracking row yet.
import type { BcJobSummary, JobTrack } from "../services/job-tracking";

const STATUSES = [
  "New Order this week", "Upcoming Mfg.", "MFG - Routing", "MFG - Len Metal Fab", "MFG - Paint Prep / Paint",
  "MFG - Vinyl Application", "MFG - Assembly & Graphics", "NEK - Production", "Outsourced - Vendor",
  "Installation", "Install - waiting on product", "Complete-need paperwork", "Complete to Admin",
  "Service or Contract Order", "Service Complete to Admin",
];
const CUSTOMERS = [
  "Prairie Bank", "Harvest Grill", "Summit Dental", "Cedar Health", "Northgate Motors", "Bluestem Library",
  "Riverbend Church", "Maple Credit Union", "Flint Hills Coffee", "Sunflower Schools", "Keystone Storage",
  "Oakridge Clinic", "Plains Tire", "Meadowlark Hotel", "Ironside Fitness", "Willow Vet",
];
const CITIES = ["Wichita", "Hutchinson", "Salina", "Dodge City", "Topeka", "Lawrence", "Olathe"];
// BC salesperson codes (their initials and regions come from services/sales-pm).
const SALES = ["VBAUMGARTNER", "NHASKELL", "DWELU", "QTOTTA", "CCARSON", "ASELLERS"];
const VENDORS = ["", "", "GREGORY", "GEMINI", "MIRATEC", "SIGN HOUSE"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));

export const MOCK_BC_JOBS: BcJobSummary[] = Array.from({ length: 60 }, (_, i) => ({
  jobNo: `J${39000 + i * 7}`,
  name: `${CUSTOMERS[i % CUSTOMERS.length]}${i >= CUSTOMERS.length ? ` #${Math.floor(i / CUSTOMERS.length) + 1}` : ""}`,
  description: ["Channel letters", "Monument refurb", "Pylon re-face", "Wall sign + vinyl", "EMC upgrade"][i % 5]!,
  remaining: 2_500 + ((i * 7919) % 60_000),
  orderAmount: 8_000 + ((i * 7919) % 90_000),
  city: CITIES[i % CITIES.length]!,
  state: "KS",
  address: `${100 + ((i * 37) % 900)} ${["Main St", "N Broadway", "E Douglas Ave", "W 21st St"][i % 4]}`,
  zip: ["67202", "67501", "67401", "67801", "66603", "66044", "66061"][i % 7]!,
  salesperson: SALES[i % SALES.length]!,
}));

// The first 48 are tracked; the rest are brand-new BC jobs ("Not tracked yet").
export const MOCK_JOB_TRACKS: JobTrack[] = MOCK_BC_JOBS.slice(0, 48).map((j, i) => {
  const status = STATUSES[i % STATUSES.length]!;
  const nek = /NEK|Topeka|Lawrence|Olathe/.test(status + j.city);
  const onHold = i % 11 === 5;
  return {
    jobNo: j.jobNo,
    statusOverride: i === 7 ? "Morton - National" : "",
    priority: i % 9 === 0 ? "RED DATE" : i % 13 === 0 ? "Rush" : "",
    holdReason: onHold ? "Hold - Customer" : "",
    dateToHold: onHold ? daysAgo(6) : "",
    dateOffHold: "",
    orderDate: daysAgo(5 + ((i * 13) % 70)),
    mfgFinalDate: daysAgo(-((i * 5) % 40)),
    expeditorDate: i % 3 === 0 ? daysAgo((i * 3) % 20) : "",
    dateInstalled: /Complete/.test(status) ? daysAgo(3) : "",
    dateToAdmin: status === "Complete to Admin" ? daysAgo(1) : "",
    dateInvoiced: "",
    vendor: VENDORS[i % VENDORS.length]!,
    poNumber: VENDORS[i % VENDORS.length] ? String(20900 + i) : "",
    vendorStatus: VENDORS[i % VENDORS.length] ? ["ORDERED", "SHIPPING", "RECEIVED"][i % 3]! : "",
    storageLocation: i % 6 === 2 ? "Warehouse - South Wall" : "",
    vendorShipDate: "",
    vendorShipDate2: "",
    outsourcedArrival: "",
    graphics: i % 4 === 0 ? "Hutch" : "",
    routingType: i % 5 === 1 ? "Metal & Backed" : "",
    powerlines: i % 7 === 0 ? "?" : "",
    sales: j.salesperson.slice(0, 2),
    location: j.city,
    region: nek ? "NEK" : "WK",
    mfgRegion: nek ? "NEK" : "WK",
    installRegion: nek ? "NEK" : "WK",
    ulSign: i % 8 === 3,
    notes: i % 5 === 0 ? "Survey requested" : "",
    legacyStatus: status,
    legacyProcess: /Service/.test(status) ? "Service" : "In Process",
  };
});
