// Sign Builder ↔ Business Central flows — GENERATED here; edit this, not the JSON.
//
//   node flows/build-bc-flows.mjs          writes the three *-clientdata.json (placeholders, committed)
//   node flows/build-bc-flows.mjs --zip    also builds the importable solution
//                                          C:\Users\Alex\Downloads\SignBuilderBCLink_<version>.zip
//
// Same pattern as Switchboard's apps/scheduling/flows (_gen_*.py / _build_*.py):
// BC is called over HTTP with the "PowerApps Permissions" app registration
// (client credentials); Dataverse through the connection reference the other
// BCSync flows use, so the import binds to the existing connection.
//
// THE SECRET NEVER LIVES IN THE REPO. For --zip set it just for the build:
//     $env:BC_CLIENT_SECRET="<secret>"; node flows/build-bc-flows.mjs --zip
// It goes into the zip in Downloads only (outside the repo) — delete the zip
// after importing. Without it the flows import with the placeholder; run
// apps/scheduling/scripts/copy-bc-secret-to-flows.ps1 -Targets BCSync_SBOpportunities,BCSync_SBJobs,BCPush_SBDescriptions.
//
// The flows:
//   BCSync_SBOpportunities — on a crfdf_syncrequest row of kind "sbopportunities"
//     (the app adds one when its opportunity picker opens / Refresh): reads the
//     extension's opportunities API (open ones + anything created in the last
//     year) into crfdf_bcopportunity, writing only changed rows, removing the
//     ones BC no longer returns. Status / Result back on the request row.
//   BCSync_SBJobs — the same for projects in every status but Completed
//     (Planning / Quote too — Switchboard's crfdf_bcjob only has Open ones) from
//     the extension's projects API (v0.12.1+) into crfdf_sbjob, on a "sbjobs"
//     request (the job picker asks).
//   BCPush_SBDescriptions — on a crfdf_sbdescpush row going to Status "pending"
//     (Generate to Project): finds the project on the extension's
//     jobDescriptions API page and PATCHes the descriptions it was asked to
//     send; Status synced / failed + message back on the row.
import { deflateRawSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.0.0.2";
const OUT_ZIP = `C:\\Users\\Alex\\Downloads\\SignBuilderBCLink_${VERSION.replace(/\./g, "_")}.zip`;
const BC_CLIENT_ID = "34a4de23-4db0-48d9-a941-285c9c2f9b5d";
const DV_CONN_REF = "new_sharedcommondataserviceforapps_4a52d";

const DV = { apiId: "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", connectionName: "shared_commondataserviceforapps" };
const AUTH = {
  type: "ActiveDirectoryOAuth",
  authority: "https://login.microsoftonline.com",
  tenant: "@parameters('Bc_Tenant')",
  audience: "@parameters('Bc_Audience')",
  clientId: "@parameters('Bc_ClientId')",
  secret: "@parameters('Bc_ClientSecret')",
};
const API = "@{parameters('Bc_ApiBase')}/lumineo/signbuilder/v1.0/companies(@{parameters('Bc_CompanyId')})";
const SEP = "^";

const after = (...names) => Object.fromEntries(names.map((n) => [n, ["Succeeded"]]));
const dv = (op, params, runAfter = {}, paginate = false) => ({
  type: "OpenApiConnection",
  runAfter,
  inputs: { parameters: params, host: { ...DV, operationId: op } },
  ...(paginate ? { runtimeConfiguration: { paginationPolicy: { minimumItemCount: 100000 } } } : {}),
});
const c = (v) => `coalesce(${v}, '')`;
const it = (name) => `item()?['${name}']`;
const lit = (t) => `'${t.replace(/'/g, "''")}'`;
const countText = (n, one, many, none) =>
  `if(equals(${n}, 0), ${lit(none)}, concat(string(${n}), if(equals(${n}, 1), ${lit(" " + one)}, ${lit(" " + many)})))`;

const parameters = () => ({
  $authentication: { defaultValue: {}, type: "SecureObject" },
  $connections: { defaultValue: {}, type: "Object" },
  Bc_ApiBase: { type: "String", defaultValue: "https://api.businesscentral.dynamics.com/v2.0/fe0182fa-d183-46ab-8493-9e8ea9c3d0b8/UAT/api" },
  Bc_CompanyId: { type: "String", defaultValue: "4738bfb5-a06d-ec11-bf27-000d3a132a9e" },
  Bc_Tenant: { type: "String", defaultValue: "fe0182fa-d183-46ab-8493-9e8ea9c3d0b8" },
  Bc_Audience: { type: "String", defaultValue: "https://api.businesscentral.dynamics.com" },
  Bc_ClientId: { type: "String", defaultValue: "<< Postman app registration client id >>" },
  Bc_ClientSecret: { type: "String", defaultValue: "<< store in Key Vault / secure env var - do NOT commit >>" },
});

const wrapFlow = (comment, triggers, actions) => ({
  properties: {
    connectionReferences: {
      shared_commondataserviceforapps: {
        api: { name: "shared_commondataserviceforapps" },
        connection: { connectionReferenceLogicalName: DV_CONN_REF },
        runtimeSource: "embedded",
      },
    },
    definition: {
      $schema: "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      contentVersion: "1.0.0.0",
      comment,
      parameters: parameters(),
      triggers,
      actions,
    },
  },
  schemaVersion: "1.0.0.0",
});

// ---------------------------------------------------------------------------
// BCSync_SBOpportunities
// ---------------------------------------------------------------------------

const REQUESTS = "crfdf_syncrequests";
const REQ_ID = "@triggerOutputs()?['body/crfdf_syncrequestid']";
const markRequest = (status, result, runAfter) => dv("UpdateOnlyRecord", { entityName: REQUESTS, recordId: REQ_ID, "item/crfdf_status": status, "item/crfdf_result": result }, runAfter);

const wrapped = (v) => `concat('${SEP}', ${v}, '${SEP}')`;
const joined = (action) => `@concat('${SEP}', join(body('${action}'), '${SEP}'), '${SEP}')`;

/**
 * A BC → Dataverse copy that runs on a crfdf_syncrequest of its kind: GET the
 * API set (one page), write only rows whose number~lastModified stamp changed,
 * delete rows BC no longer returns, report on the request.
 *   cfg.Plural / cfg.single — action names ("Opportunities" / "opportunity")
 *   cfg.fields — Dataverse column → expression on the BC row (ROW below)
 */
function syncFlow(cfg) {
  const { flow, kind, set, idCol, keyCol, apiSet, select, filter, Plural, single, fields, done, what } = cfg;
  const Get = `Get_${Plural}`;
  const Changed = `Changed_${Plural}`;
  const Each = `For_each_changed_${single}`;
  const ROW = `items('${Each}')`;
  const STAMP = `concat(trim(${c(it("number"))}), '~', ${c(it("lastModified"))})`;
  const ROW_STAMP = `concat(trim(${c(it(keyCol))}), '~', ${c(it("crfdf_bcmodified"))})`;
  const Cap = single.charAt(0).toUpperCase() + single.slice(1);
  const item = Object.fromEntries(Object.entries(fields(ROW)).map(([k, v]) => [`item/${k}`, v]));
  const work = {
    [Get]: {
      type: "Http",
      runAfter: {},
      inputs: { method: "GET", uri: `${API}/${apiSet}?$filter=${filter}&$select=${select}`, headers: { Accept: "application/json" }, authentication: AUTH },
    },
    List_Existing: dv("ListRecords", { entityName: set, $select: `${idCol},${keyCol},crfdf_bcmodified` }, {}, true),
    // Fail loudly rather than treat the rows on a missing page as gone.
    Check_Single_Page: {
      type: "If",
      runAfter: after(Get),
      expression: { not: { equals: [`@empty(coalesce(body('${Get}')?['@odata.nextLink'], ''))`, true] } },
      actions: {
        Stop_Paged: {
          type: "Terminate",
          runAfter: {},
          inputs: { runStatus: "Failed", runError: { code: "Paged", message: `BC returned more than one page - add paging to ${flow}.` } },
        },
      },
      else: { actions: {} },
    },
    [Plural]: {
      type: "Query",
      runAfter: after("Check_Single_Page"),
      inputs: { from: `@body('${Get}')?['value']`, where: `@not(empty(trim(${c(it("number"))})))` },
    },
    Existing_Stamps: { type: "Select", runAfter: after("List_Existing"), inputs: { from: "@body('List_Existing')?['value']", select: `@${ROW_STAMP}` } },
    Existing_Stamp_Text: { type: "Compose", runAfter: after("Existing_Stamps"), inputs: joined("Existing_Stamps") },
    [Changed]: {
      type: "Query",
      runAfter: after(Plural, "Existing_Stamp_Text"),
      inputs: { from: `@body('${Plural}')`, where: `@not(contains(outputs('Existing_Stamp_Text'), ${wrapped(STAMP)}))` },
    },
    [Each]: {
      type: "Foreach",
      foreach: `@body('${Changed}')`,
      runAfter: after(Changed),
      runtimeConfiguration: { concurrency: { repetitions: 10 } },
      actions: {
        Existing_Row: {
          type: "Query",
          runAfter: {},
          inputs: { from: "@body('List_Existing')?['value']", where: `@equals(trim(${c(it(keyCol))}), trim(${ROW}?['number']))` },
        },
        Row_Exists: {
          type: "If",
          runAfter: after("Existing_Row"),
          expression: { greater: ["@length(body('Existing_Row'))", 0] },
          actions: { [`Update_${Cap}`]: dv("UpdateOnlyRecord", { entityName: set, recordId: `@first(body('Existing_Row'))?['${idCol}']`, ...item }) },
          else: { actions: { [`Create_${Cap}`]: dv("CreateRecord", { entityName: set, ...item }) } },
        },
      },
    },
    Current_Numbers: { type: "Select", runAfter: after(Plural), inputs: { from: `@body('${Plural}')`, select: `@trim(${c(it("number"))})` } },
    Current_Number_Text: { type: "Compose", runAfter: after("Current_Numbers"), inputs: joined("Current_Numbers") },
    Stale_Rows: {
      type: "Query",
      runAfter: after("Current_Number_Text", "List_Existing"),
      inputs: { from: "@body('List_Existing')?['value']", where: `@not(contains(outputs('Current_Number_Text'), ${wrapped(`trim(${c(it(keyCol))})`)}))` },
    },
    [`Any_${Plural}`]: {
      type: "If",
      runAfter: after("Stale_Rows", Each),
      expression: { greater: [`@length(body('${Plural}'))`, 0] },
      actions: {
        For_each_stale_row: {
          type: "Foreach",
          foreach: "@body('Stale_Rows')",
          runAfter: {},
          runtimeConfiguration: { concurrency: { repetitions: 10 } },
          actions: { [`Delete_${Cap}`]: dv("DeleteRecord", { entityName: set, recordId: `@items('For_each_stale_row')?['${idCol}']` }) },
        },
      },
      else: { actions: {} },
    },
  };
  const DONE = countText(`length(coalesce(body('${Changed}'), json('[]')))`, done[0], done[1], done[2]);
  return wrapFlow(
    `${flow} - GENERATED by apps/signbuilder/flows/build-bc-flows.mjs; edit that, not this. On a crfdf_syncrequest of kind ${kind}: ${what}.`,
    {
      When_a_check_is_requested: {
        type: "OpenApiConnectionWebhook",
        inputs: {
          parameters: {
            "subscriptionRequest/message": 1,
            "subscriptionRequest/entityname": "crfdf_syncrequest",
            "subscriptionRequest/scope": 4,
            "subscriptionRequest/filterexpression": `crfdf_kind eq '${kind}'`,
          },
          host: { ...DV, operationId: "SubscribeWebhookTrigger" },
          authentication: "@parameters('$authentication')",
        },
        runtimeConfiguration: { concurrency: { runs: 1 } },
      },
    },
    {
      Mark_Running: markRequest("Running", "", {}),
      Check_BC: { type: "Scope", runAfter: after("Mark_Running"), actions: work },
      Mark_Done: markRequest("Done", `@${DONE}`, after("Check_BC")),
      Mark_Failed: markRequest("Failed", `@'Could not read BC - see the ${flow} run history.'`, { Check_BC: ["Failed", "TimedOut"] }),
    },
  );
}

const opportunitiesFlow = syncFlow({
  flow: "BCSync_SBOpportunities",
  kind: "sbopportunities",
  what: "BC opportunities (Sign Builder extension API) into crfdf_bcopportunity",
  set: "crfdf_bcopportunities",
  idCol: "crfdf_bcopportunityid",
  keyCol: "crfdf_opportunityno",
  apiSet: "opportunities",
  select: "number,description,contactNo,contactName,contactCompanyName,salespersonCode,status,closed,creationDate,projectNo,lastModified",
  // Open opportunities, plus closed ones from the last year (a won one is specced after it closes).
  filter: "@{encodeUriComponent(concat('closed eq false or creationDate ge ', formatDateTime(addDays(utcNow(), -365), 'yyyy-MM-dd')))}",
  Plural: "Opportunities",
  single: "opportunity",
  done: ["opportunity updated", "opportunities updated", "Opportunities up to date"],
  fields: (R) => ({
    crfdf_name: `@trim(${R}?['number'])`,
    crfdf_opportunityno: `@trim(${R}?['number'])`,
    crfdf_description: `@${c(`${R}?['description']`)}`,
    crfdf_contactno: `@${c(`${R}?['contactNo']`)}`,
    crfdf_contactname: `@${c(`${R}?['contactName']`)}`,
    crfdf_companyname: `@${c(`${R}?['contactCompanyName']`)}`,
    crfdf_salespersoncode: `@${c(`${R}?['salespersonCode']`)}`,
    crfdf_status: `@${c(`${R}?['status']`)}`,
    crfdf_closed: `@equals(${R}?['closed'], true)`,
    crfdf_creationdate: `@${c(`${R}?['creationDate']`)}`,
    crfdf_projectno: `@trim(${c(`${R}?['projectNo']`)})`,
    crfdf_bcmodified: `@${c(`${R}?['lastModified']`)}`,
  }),
});

// Every project that isn't Completed — Planning / Quote ones too (Switchboard's
// crfdf_bcjob only has Open). Extension v0.12.1+ (page 58489).
const projectsFlow = syncFlow({
  flow: "BCSync_SBJobs",
  kind: "sbjobs",
  what: "BC projects in every status but Completed (Sign Builder extension API) into crfdf_sbjob",
  set: "crfdf_sbjobs",
  idCol: "crfdf_sbjobid",
  keyCol: "crfdf_jobno",
  apiSet: "projects",
  select: "number,description,description2,billToCustomerNo,billToName,status,creationDate,personResponsible,lastModified",
  filter: "@{encodeUriComponent('status ne ''Completed''')}",
  Plural: "Projects",
  single: "project",
  done: ["project updated", "projects updated", "Projects up to date"],
  fields: (R) => ({
    crfdf_name: `@trim(${R}?['number'])`,
    crfdf_jobno: `@trim(${R}?['number'])`,
    crfdf_description: `@trim(concat(${c(`${R}?['description']`)}, ' ', ${c(`${R}?['description2']`)}))`,
    crfdf_customerno: `@${c(`${R}?['billToCustomerNo']`)}`,
    crfdf_customername: `@${c(`${R}?['billToName']`)}`,
    crfdf_status: `@${c(`${R}?['status']`)}`,
    crfdf_creationdate: `@${c(`${R}?['creationDate']`)}`,
    crfdf_personresponsible: `@${c(`${R}?['personResponsible']`)}`,
    crfdf_bcmodified: `@${c(`${R}?['lastModified']`)}`,
  }),
});

// ---------------------------------------------------------------------------
// BCPush_SBDescriptions
// ---------------------------------------------------------------------------

const PUSH_SET = "crfdf_sbdescpushs";
const T = (name) => `triggerOutputs()?['body/crfdf_${name}']`;
const PUSH_ID = `@${T("sbdescpushid")}`;
const markPush = (status, message, runAfter) =>
  dv("UpdateOnlyRecord", { entityName: PUSH_SET, recordId: PUSH_ID, "item/crfdf_status": status, "item/crfdf_statusmessage": message }, runAfter);
const JOB_FILTER = `@{encodeUriComponent(concat('number eq ''', trim(${c(T("jobno"))}), ''''))}`;
const ERR = (action) => `body('${action}')?['error']?['message']`;

const pushWork = {
  Get_Project: {
    type: "Http",
    runAfter: {},
    inputs: { method: "GET", uri: `${API}/jobDescriptions?$filter=${JOB_FILTER}&$select=id,number`, headers: { Accept: "application/json" }, authentication: AUTH },
  },
  // Only the descriptions the person ticked go in the body (BC leaves the others alone).
  Body_Production: {
    type: "Compose",
    runAfter: after("Get_Project"),
    inputs: `@if(equals(${T("sendproduction")}, true), setProperty(json('{}'), 'productionDescription', ${c(T("productiondesc"))}), json('{}'))`,
  },
  Body_Both: {
    type: "Compose",
    runAfter: after("Body_Production"),
    inputs: `@if(equals(${T("sendfield")}, true), setProperty(outputs('Body_Production'), 'fieldDescription', ${c(T("fielddesc"))}), outputs('Body_Production'))`,
  },
  Project_Found: {
    type: "If",
    runAfter: after("Body_Both"),
    expression: { greater: ["@length(coalesce(body('Get_Project')?['value'], json('[]')))", 0] },
    actions: {
      Write_Descriptions: {
        type: "Http",
        runAfter: {},
        inputs: {
          method: "PATCH",
          uri: `${API}/jobDescriptions(@{first(body('Get_Project')?['value'])?['id']})`,
          headers: { "Content-Type": "application/json", Accept: "application/json", "If-Match": "*" },
          body: "@outputs('Body_Both')",
          authentication: AUTH,
        },
      },
      Mark_Synced: markPush("synced", `@concat('Written to project ', trim(${c(T("jobno"))}), ' in BC.')`, after("Write_Descriptions")),
    },
    else: {
      actions: {
        Mark_Not_Found: markPush("failed", `@concat('Project ', trim(${c(T("jobno"))}), ' was not found in BC.')`, {}),
      },
    },
  },
};

const descriptionsFlow = wrapFlow(
  "BCPush_SBDescriptions - GENERATED by apps/signbuilder/flows/build-bc-flows.mjs; edit that, not this. On a crfdf_sbdescpush row going pending: PATCH the project's Production / Field Description through the Sign Builder extension's jobDescriptions API.",
  {
    When_a_push_is_queued: {
      type: "OpenApiConnectionWebhook",
      inputs: {
        parameters: {
          "subscriptionRequest/message": 4, // added or changed
          "subscriptionRequest/entityname": "crfdf_sbdescpush",
          "subscriptionRequest/scope": 4,
          "subscriptionRequest/filteringattributes": "crfdf_status",
        },
        host: { ...DV, operationId: "SubscribeWebhookTrigger" },
        authentication: "@parameters('$authentication')",
      },
      runtimeConfiguration: { concurrency: { runs: 5 } },
    },
  },
  {
    Only_Pending: {
      type: "If",
      runAfter: {},
      expression: { equals: [`@toLower(trim(${c(T("status"))}))`, "pending"] },
      actions: {
        Write: { type: "Scope", runAfter: {}, actions: pushWork },
        Error_Text: {
          type: "Compose",
          runAfter: { Write: ["Failed", "TimedOut"] },
          inputs: `@coalesce(${ERR("Write_Descriptions")}, ${ERR("Get_Project")}, 'Could not write to BC - see the BCPush_SBDescriptions run history.')`,
        },
        Mark_Failed: markPush(
          "failed",
          "@if(greater(length(outputs('Error_Text')), 300), substring(outputs('Error_Text'), 0, 300), outputs('Error_Text'))",
          after("Error_Text"),
        ),
      },
      else: { actions: {} },
    },
  },
);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const FLOWS = [
  { name: "BCSync_SBOpportunities", guid: "6f0f6f3a-2b6e-4a49-9c55-5b8d1c0e7a01", doc: opportunitiesFlow,
    desc: "On request: BC opportunities (Sign Builder extension API) into crfdf_bcopportunity for the Sign Builder app's opportunity picker." },
  { name: "BCSync_SBJobs", guid: "6f0f6f3a-2b6e-4a49-9c55-5b8d1c0e7a03", doc: projectsFlow,
    desc: "On request: BC projects in every status but Completed (Sign Builder extension API) into crfdf_sbjob for the Sign Builder app's job picker." },
  { name: "BCPush_SBDescriptions", guid: "6f0f6f3a-2b6e-4a49-9c55-5b8d1c0e7a02", doc: descriptionsFlow,
    desc: "Generate to Project: writes the Sign Builder's Production / Field Description to the BC project (crfdf_sbdescpush outbox)." },
];

for (const f of FLOWS) {
  const file = path.join(HERE, `${f.name}-clientdata.json`);
  fs.writeFileSync(file, JSON.stringify(f.doc, null, 2) + "\n");
  console.log("wrote", file);
}

if (process.argv.includes("--zip")) {
  const secret = process.env.BC_CLIENT_SECRET || "";
  const files = [];
  const add = (name, text) => files.push({ name, data: Buffer.from(text, "utf8") });
  const workflows = FLOWS.map((f) => {
    const doc = JSON.parse(JSON.stringify(f.doc));
    const p = doc.properties.definition.parameters;
    p.Bc_ClientId.defaultValue = BC_CLIENT_ID;
    if (secret) p.Bc_ClientSecret.defaultValue = secret;
    const json = `${f.name}-${f.guid.toUpperCase()}.json`;
    add(`Workflows/${json}`, JSON.stringify(doc, null, 2));
    return `    <Workflow WorkflowId="{${f.guid}}" Name="${f.name}" Description="${f.desc}">
      <JsonFileName>/Workflows/${json}</JsonFileName>
      <Type>1</Type>
      <Subprocess>0</Subprocess>
      <Category>5</Category>
      <Mode>0</Mode>
      <Scope>4</Scope>
      <OnDemand>0</OnDemand>
      <TriggerOnCreate>0</TriggerOnCreate>
      <TriggerOnDelete>0</TriggerOnDelete>
      <AsyncAutodelete>0</AsyncAutodelete>
      <SyncWorkflowLogOnFailure>0</SyncWorkflowLogOnFailure>
      <StateCode>0</StateCode>
      <StatusCode>1</StatusCode>
      <RunAs>1</RunAs>
      <IsTransacted>1</IsTransacted>
      <IntroducedVersion>1.0</IntroducedVersion>
      <IsCustomizable>1</IsCustomizable>
      <BusinessProcessType>0</BusinessProcessType>
      <IsCustomProcessingStepAllowedForOtherPublishers>1</IsCustomProcessingStepAllowedForOtherPublishers>
      <ModernFlowType>0</ModernFlowType>
      <PrimaryEntity>none</PrimaryEntity>
      <LocalizedNames>
        <LocalizedName languagecode="1033" description="${f.name}" />
      </LocalizedNames>
      <Descriptions>
        <Description languagecode="1033" description="${f.desc}" />
      </Descriptions>
    </Workflow>`;
  });
  add(
    "customizations.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities />
  <Roles />
  <Workflows>
${workflows.join("\n")}
  </Workflows>
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <EntityDataProviders />
  <connectionreferences>
    <connectionreference connectionreferencelogicalname="${DV_CONN_REF}">
      <connectionreferencedisplayname>Microsoft Dataverse</connectionreferencedisplayname>
      <connectorid>/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps</connectorid>
      <iscustomizable>1</iscustomizable>
      <statecode>0</statecode>
      <statuscode>1</statuscode>
    </connectionreference>
  </connectionreferences>
  <Languages>
    <Language>1033</Language>
  </Languages>
</ImportExportXml>
`,
  );
  add(
    "solution.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.26061.153" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>SignBuilderBCLink</UniqueName>
    <LocalizedNames>
      <LocalizedName description="Sign Builder BC Link" languagecode="1033" />
    </LocalizedNames>
    <Descriptions />
    <Version>${VERSION}</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>LumineoSigns</UniqueName>
      <LocalizedNames>
        <LocalizedName description="Lumineo Signs" languagecode="1033" />
      </LocalizedNames>
      <Descriptions />
      <EMailAddress xsi:nil="true"></EMailAddress>
      <SupportingWebsiteUrl xsi:nil="true"></SupportingWebsiteUrl>
      <CustomizationPrefix>lum</CustomizationPrefix>
      <CustomizationOptionValuePrefix>20000</CustomizationOptionValuePrefix>
      <Addresses />
    </Publisher>
    <RootComponents>
${FLOWS.map((f) => `      <RootComponent type="29" id="{${f.guid}}" behavior="0" />`).join("\n")}
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
`,
  );
  add(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/octet-stream" /><Default Extension="json" ContentType="application/octet-stream" /></Types>',
  );
  fs.writeFileSync(OUT_ZIP, zip(files));
  console.log(`Built ${OUT_ZIP} ${secret ? "(secret injected)" : "(secret NOT set - fill Bc_ClientSecret after import)"}`);
  for (const f of files) console.log("  ", f.name);
}

// A minimal zip writer (deflate, forward-slash names) — no packages needed.
function zip(entries) {
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = deflateRawSync(e.data);
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
