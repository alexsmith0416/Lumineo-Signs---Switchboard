// Sales & Project-Manager reference data (from "Sales&PM - Resources.xlsx").
//
// BC stamps every job with a salesperson code (SalesLines.salespersonCode, e.g.
// "DWELU"). Some salespeople have a Project Manager; that relationship lives
// here. A PM is only surfaced on a job when the job's salesperson has one.
//
// Logins: each real person signs in with <code>@lumineosigns.com (the local part
// IS their code — ccarson@ → CCARSON). The "LNI House" pseudo-salespeople have no
// login. See current-user.ts for how the signed-in email resolves to a person.

export type SalesPmType = "sales" | "pm";

export interface SalesPmPerson {
  /** BC salesperson code (crfdf_salespersoncode) — also the login local-part. */
  code: string;
  name: string;
  type: SalesPmType;
  /** For salespeople who have a Project Manager: that PM's code. */
  pmCode?: string;
}

export const SALES_PM_PEOPLE: SalesPmPerson[] = [
  { code: "ASELLERS", name: "Andy Sellers", type: "sales", pmCode: "MSCHAFFER" },
  { code: "CCARSON", name: "Chuck Carson", type: "sales" },
  { code: "DDIMITT", name: "Don Dimitt", type: "sales" },
  { code: "DWELU", name: "Dan Welu", type: "sales", pmCode: "KHIMES" },
  { code: "KHIMES", name: "Kevin Himes", type: "pm" },
  { code: "MSCHAFFER", name: "Megan Schaffer", type: "pm" },
  { code: "NHASKELL", name: "Nathan Haskell", type: "sales" },
  { code: "QTOTTA", name: "Quintin Totta", type: "sales" },
  { code: "SPOPPELREITER", name: "Shelly Poppelreiter", type: "sales" },
  { code: "VBAUMGARTNER", name: "Virginia Baumgartner", type: "sales" },
  { code: "TCARSON", name: "Tristan Carson", type: "sales", pmCode: "KHIMES" },
  { code: "DPATTERSON", name: "David Patterson", type: "sales", pmCode: "MSCHAFFER" },
  { code: "JLYLE", name: "Jim Lyle", type: "sales" },
  { code: "JSANDERSON", name: "LNI House", type: "sales" },
  { code: "HOUSE", name: "LNI House", type: "sales" },
  { code: "JONTJES", name: "LNI House", type: "sales" },
];

const BY_CODE = new Map(SALES_PM_PEOPLE.map((p) => [p.code, p]));

/** Normalize a raw BC code / login local-part to the lookup key. */
export const normCode = (code: string | null | undefined): string =>
  (code ?? "").trim().toUpperCase();

export function personByCode(code: string | null | undefined): SalesPmPerson | undefined {
  const c = normCode(code);
  return c ? BY_CODE.get(c) : undefined;
}

export const SALESPEOPLE = SALES_PM_PEOPLE.filter((p) => p.type === "sales").sort((a, b) =>
  a.name.localeCompare(b.name),
);
export const PROJECT_MANAGERS = SALES_PM_PEOPLE.filter((p) => p.type === "pm").sort((a, b) =>
  a.name.localeCompare(b.name),
);

/** The PM managing a job's salesperson, or undefined when there's no PM. */
export function pmForSalespersonCode(salesCode: string | null | undefined): SalesPmPerson | undefined {
  const sp = personByCode(salesCode);
  return sp?.pmCode ? BY_CODE.get(sp.pmCode) : undefined;
}

/** Salespeople managed by a given PM code (their per-salesperson tabs). */
export function salespeopleForPm(pmCode: string | null | undefined): SalesPmPerson[] {
  const c = normCode(pmCode);
  return c ? SALESPEOPLE.filter((s) => s.pmCode === c) : [];
}

// ── Jobs list: Sales initials + Region ──────────────────────────────────────
// A job's Region follows its salesperson (the BC salesperson list, Sep 29 2026).
// Anyone not listed — and a job with no salesperson — is WK.
const NEK_SALESPEOPLE = new Set(["QTOTTA", "SPOPPELREITER", "VBAUMGARTNER", "JLYLE"]);
const HOUSE_CODES = new Set(["JSANDERSON", "HOUSE", "JONTJES"]);

/** "NEK" or "WK" for a BC salesperson code (default WK). */
export function regionForSalesperson(code: string | null | undefined): "WK" | "NEK" {
  return NEK_SALESPEOPLE.has(normCode(code)) ? "NEK" : "WK";
}

/** The Jobs list's Sales badge for a code: "NH" for NHASKELL (first initial +
 *  surname initial, which is how BC codes are built), "LNI" for the house accounts. */
export function salesInitials(code: string | null | undefined): string {
  const c = normCode(code);
  if (!c) return "";
  if (HOUSE_CODES.has(c)) return "LNI";
  return c.slice(0, 2);
}
