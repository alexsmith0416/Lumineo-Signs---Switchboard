#!/usr/bin/env node
// ============================================================
// Sign365 schema discovery — run this ONCE to see exactly what
// every endpoint returns, so your Power Automate flows map real
// field names into the right Dataverse columns.
//
// Usage (PowerShell):
//   $env:BC_TENANT       = "luminousneon.com"
//   $env:BC_ENVIRONMENT  = "UAT"
//   $env:BC_CLIENT_ID    = "<app registration client id>"
//   $env:BC_CLIENT_SECRET= "<client secret — never commit this>"
//   node scripts/discover-sign365.mjs
//
// Usage (bash):
//   BC_TENANT=luminousneon.com BC_ENVIRONMENT=UAT \
//   BC_CLIENT_ID=... BC_CLIENT_SECRET=... node scripts/discover-sign365.mjs
//
// Output:
//   - Console: field-name inventory + sample values per endpoint
//   - ./sign365-discovery/<endpoint>.sample.json   (2 raw records)
//   - ./sign365-discovery/<endpoint>.schema.json   (Parse JSON schema —
//     paste straight into the flow's Parse JSON action)
//   - ./sign365-discovery/mapping-report.md        (field → crfdf_* map
//     with UNMATCHED columns flagged)
// ============================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TENANT = process.env.BC_TENANT;
const ENVIRONMENT = process.env.BC_ENVIRONMENT ?? "UAT";
const CLIENT_ID = process.env.BC_CLIENT_ID;
const CLIENT_SECRET = process.env.BC_CLIENT_SECRET;
const COMPANY_ID = process.env.BC_COMPANY_ID ?? "4738bfb5-a06d-ec11-bf27-000d3a132a9e";

if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing env vars. Set BC_TENANT, BC_CLIENT_ID, BC_CLIENT_SECRET " +
      "(and optionally BC_ENVIRONMENT, BC_COMPANY_ID).",
  );
  process.exit(1);
}

const BASE =
  `https://api.businesscentral.dynamics.com/v2.0/${TENANT}/${ENVIRONMENT}` +
  `/api/infotechConsultingGroup/sign365/v1.0/companies(${COMPANY_ID})`;

// endpoint path → the Dataverse mirror columns the Weekly Calendar app
// expects (see production-scheduling-app/README.md "What each Power
// Automate flow must write").
const ENDPOINTS = {
  jobs: {
    table: "crfdf_bcjob",
    expect: {
      crfdf_jobno: ["no", "number", "jobNo"],
      crfdf_shiptoname: ["shipToName", "shipToCustomerName"],
      crfdf_billtoname: ["billToName", "billToCustomerName", "customerName"],
      crfdf_shiptoaddress: ["shipToAddress", "shipToAddressLine1"],
      crfdf_shiptocity: ["shipToCity"],
      crfdf_shiptostate: ["shipToState", "shipToCounty"],
      crfdf_shiptozip: ["shipToZip", "shipToPostCode", "shipToZipCode"],
      crfdf_promiseddate: ["promisedDate", "endingDate", "endDate"],
    },
  },
  projectPlanningLines: {
    table: "crfdf_bcplanningline",
    expect: {
      crfdf_jobno: ["jobNo", "no", "projectNo"],
      crfdf_lineno: ["lineNo"],
      crfdf_type: ["type"],
      crfdf_description: ["description"],
      crfdf_quantity: ["quantity", "estimatedHours"],
    },
  },
  jobCostAndSales: {
    table: "crfdf_bccostandsales",
    expect: {
      crfdf_jobno: ["no", "jobNo", "number"],
      crfdf_contractvalue: ["contractValue", "totalSalesPrice", "totalPrice", "scheduledPrice"],
      crfdf_invoicedamount: ["invoicedAmount", "billedAmount", "invoicedPrice"],
    },
  },
  TripsResources: {
    table: "crfdf_bctripresource",
    expect: {
      crfdf_jobno: ["jobNo", "no", "projectNo"],
      crfdf_tripno: ["tripNo", "trip"],
      crfdf_resourceno: ["resourceNo", "no"],
      crfdf_resourcetype: ["resourceType", "type"],
      crfdf_tripdate: ["tripDate", "date", "planningDate"],
    },
  },
  projectPlanningSteps: { table: "crfdf_bcplanningstep", expect: {} },
  projectPlanningEntries: { table: "crfdf_bcplanningentry", expect: {} },
  jobTasks: { table: "crfdf_bcjobtask", expect: {} },
  projectDetails: { table: "crfdf_bcjobdetail", expect: {} },
  dimensionSetEntries: { table: "crfdf_bcdimensionentry", expect: {} },
  jobOutstandingPurchaseLines: { table: "crfdf_bcoutstandingpo", expect: {} },
  jobLedgerEntries: { table: "crfdf_bcjobledger", expect: {} },
};

async function getToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://api.businesscentral.dynamics.com/.default",
      }),
    },
  );
  const data = await res.json();
  if (!data.access_token) {
    console.error("Token exchange failed:", data.error, "—", data.error_description);
    process.exit(1);
  }
  return data.access_token;
}

function jsonType(v) {
  if (v === null) return "string"; // BC nulls are usually optional strings
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  if (typeof v === "boolean") return "boolean";
  return "string";
}

function buildParseJsonSchema(records) {
  const props = {};
  for (const rec of records) {
    for (const [k, v] of Object.entries(rec)) {
      if (k.startsWith("@odata")) continue;
      if (!props[k]) props[k] = { type: [jsonType(v), "null"] };
    }
  }
  return {
    type: "object",
    properties: {
      value: { type: "array", items: { type: "object", properties: props } },
    },
  };
}

const outDir = "sign365-discovery";
mkdirSync(outDir, { recursive: true });

const token = await getToken();
console.log("✓ token acquired\n");

const report = [
  "# Sign365 → Dataverse mapping report",
  "",
  `Generated ${new Date().toISOString()} against ${ENVIRONMENT}.`,
  "",
];

for (const [path, cfg] of Object.entries(ENDPOINTS)) {
  const url = `${BASE}/${path}?$top=2`;
  let body;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.log(`✗ ${path} — HTTP ${res.status} ${res.statusText}`);
      report.push(`## /${path}`, "", `**HTTP ${res.status}** — endpoint unavailable or unauthorized.`, "");
      continue;
    }
    body = await res.json();
  } catch (err) {
    console.log(`✗ ${path} — ${err.message}`);
    continue;
  }

  const records = body.value ?? [];
  writeFileSync(join(outDir, `${path}.sample.json`), JSON.stringify(records, null, 2));
  writeFileSync(
    join(outDir, `${path}.schema.json`),
    JSON.stringify(buildParseJsonSchema(records), null, 2),
  );

  const fields = records[0] ? Object.keys(records[0]).filter((k) => !k.startsWith("@odata")) : [];
  console.log(`✓ ${path} — ${records.length} sample record(s), ${fields.length} fields`);
  for (const f of fields) {
    const v = records[0][f];
    const preview = v === null ? "null" : String(v).slice(0, 48);
    console.log(`    ${f.padEnd(36)} = ${preview}`);
  }
  console.log("");

  report.push(`## /${path} → \`${cfg.table}\``, "");
  if (records.length === 0) {
    report.push("_No records returned — cannot infer mapping._", "");
    continue;
  }
  report.push("| Dataverse column | Sign365 field | Status |", "|---|---|---|");
  for (const [dvCol, candidates] of Object.entries(cfg.expect)) {
    const hit = candidates.find((c) => fields.some((f) => f.toLowerCase() === c.toLowerCase()));
    const actual = hit ? fields.find((f) => f.toLowerCase() === hit.toLowerCase()) : null;
    report.push(
      `| \`${dvCol}\` | ${actual ? `\`${actual}\`` : "**NOT FOUND**"} | ${actual ? "✅" : `⚠ looked for: ${candidates.join(", ")}`} |`,
    );
  }
  const unmapped = fields.filter(
    (f) =>
      !Object.values(cfg.expect).some((cands) =>
        cands.some((c) => c.toLowerCase() === f.toLowerCase()),
      ),
  );
  if (unmapped.length) {
    report.push("", `Extra fields available: ${unmapped.map((f) => `\`${f}\``).join(", ")}`);
  }
  report.push("");
}

writeFileSync(join(outDir, "mapping-report.md"), report.join("\n"));
console.log(`\nWrote ${outDir}/mapping-report.md + per-endpoint sample/schema files.`);
console.log("Paste each <endpoint>.schema.json into that flow's Parse JSON action.");
