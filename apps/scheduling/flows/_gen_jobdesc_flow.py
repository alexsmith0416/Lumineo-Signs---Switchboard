"""Generate BCSync_JobDescriptions-clientdata.json.

BCSync_JobDescriptions fills crfdf_jobdesc — each open job's Field / Production
/ Extended Description, for the job panel's click-to-open sections — from our
BC API page jobDescriptions (bc/lumineo-planning-ext v1.0.0.11+, page 58403,
api/lumineo/planning/v1.0). The page reads the Blob fields Infotech's "Lumineo
Signs - Projects" extension adds to Job.

Every hour it:
  1. reads the open jobs' descriptions from BC (one call, ~6 s for ~700 jobs)
     and the rows already in crfdf_jobdesc;
  2. a job is CHANGED when its BC lastModified (the Job's SystemModifiedAt,
     which moves when a description is saved) differs from the row's
     crfdf_bcmodified — only those are written (create or update);
  3. rows for jobs that are no longer open are deleted. Skipped if BC returned
     no jobs at all (a bad read, not "every job closed").

Lists are compared as '^'-delimited strings (one substring search per row), as
in BCSync_JobPOs.

The expressions are long and quote-heavy, so the JSON is GENERATED - edit here:

    python _gen_jobdesc_flow.py

then build the solution with _build_jobdesc_solution.py. See
BCSync_JobDescriptions.md.
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BCSync_JobDescriptions-clientdata.json")

DV = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "connectionName": "shared_commondataserviceforapps"}
AUTH = {"type": "ActiveDirectoryOAuth", "authority": "https://login.microsoftonline.com",
        "tenant": "@parameters('Bc_Tenant')", "audience": "@parameters('Bc_Audience')",
        "clientId": "@parameters('Bc_ClientId')", "secret": "@parameters('Bc_ClientSecret')"}
API = "@{parameters('Bc_ApiBase')}/lumineo/planning/v1.0/companies(@{parameters('Bc_CompanyId')})"
SEP = "^"  # between list entries; never in BC job numbers
SELECT = "jobNo,lastModified,fieldDescription,productionDescription,extendedDescription"
SET = "crfdf_jobdescs"


def after(*names, status="Succeeded"):
    return {n: [status] for n in names}


def dv(op, params, run_after=None, paginate=False):
    a = {"type": "OpenApiConnection", "runAfter": run_after or {},
         "inputs": {"parameters": params, "host": {**DV, "operationId": op}}}
    if paginate:
        a["runtimeConfiguration"] = {"paginationPolicy": {"minimumItemCount": 100000}}
    return a


def c(v):
    return f"coalesce({v}, '')"


def it(name):
    """item()?['name']"""
    return "item()?['" + name + "']"


def joined(action):
    return f"@concat('{SEP}', join(body('{action}'), '{SEP}'), '{SEP}')"


def wrapped(v):
    return f"concat('{SEP}', {v}, '{SEP}')"


JOB_STAMP = f"concat(trim({c(it('jobNo'))}), '~', {c(it('lastModified'))})"
ROW_STAMP = f"concat(trim({c(it('crfdf_jobno'))}), '~', {c(it('crfdf_bcmodified'))})"
W_STAMP = wrapped(JOB_STAMP)
W_JOB = wrapped(f"trim({c(it('crfdf_jobno'))})")

ROW = "items('For_each_changed_job')"
EXISTING = "first(body('Existing_Row'))"
FIELDS = {
    "item/crfdf_name": f"@trim({ROW}?['jobNo'])",
    "item/crfdf_jobno": f"@trim({ROW}?['jobNo'])",
    "item/crfdf_fielddesc": "@" + c(ROW + "?['fieldDescription']"),
    "item/crfdf_proddesc": "@" + c(ROW + "?['productionDescription']"),
    "item/crfdf_extdesc": "@" + c(ROW + "?['extendedDescription']"),
    "item/crfdf_bcmodified": "@" + c(ROW + "?['lastModified']"),
}

per_job = {
    "Existing_Row": {
        "type": "Query", "runAfter": {},
        "inputs": {"from": "@body('List_Existing')?['value']",
                   "where": f"@equals(trim({c(it('crfdf_jobno'))}), trim({ROW}?['jobNo']))"}},
    "Row_Exists": {
        "type": "If", "runAfter": after("Existing_Row"),
        "expression": {"greater": ["@length(body('Existing_Row'))", 0]},
        "actions": {"Update_Descriptions": dv("UpdateOnlyRecord", {
            "entityName": SET, "recordId": f"@{EXISTING}?['crfdf_jobdescid']", **FIELDS})},
        "else": {"actions": {"Create_Descriptions": dv("CreateRecord", {"entityName": SET, **FIELDS})}},
    },
}

actions = {
    "Get_Descriptions": {
        "type": "Http", "runAfter": {},
        "inputs": {"method": "GET",
                   "uri": (f"{API}/jobDescriptions?$filter=@{{encodeUriComponent('status eq ''Open''')}}"
                           f"&$select={SELECT}"),
                   "headers": {"Accept": "application/json"}, "authentication": AUTH}},
    "List_Existing": dv("ListRecords", {"entityName": SET,
                                        "$select": "crfdf_jobdescid,crfdf_jobno,crfdf_bcmodified"}, paginate=True),
    # One page today (~700 open jobs). Fail loudly rather than treat the jobs on
    # a missing page as closed and delete them.
    "Check_Single_Page": {
        "type": "If", "runAfter": after("Get_Descriptions"),
        "expression": {"not": {"equals": [
            "@empty(coalesce(body('Get_Descriptions')?['@odata.nextLink'], ''))", True]}},
        "actions": {"Stop_Paged": {"type": "Terminate", "runAfter": {}, "inputs": {
            "runStatus": "Failed", "runError": {"code": "Paged",
                                                "message": "BC returned more than one page - add paging to BCSync_JobDescriptions."}}}},
        "else": {"actions": {}}},
    "Jobs": {
        "type": "Query", "runAfter": after("Check_Single_Page"),
        "inputs": {"from": "@body('Get_Descriptions')?['value']",
                   "where": f"@not(empty(trim({c(it('jobNo'))})))"}},
    "Existing_Stamps": {
        "type": "Select", "runAfter": after("List_Existing"),
        "inputs": {"from": "@body('List_Existing')?['value']", "select": "@" + ROW_STAMP}},
    "Existing_Stamp_Text": {"type": "Compose", "runAfter": after("Existing_Stamps"),
                            "inputs": joined("Existing_Stamps")},
    "Changed_Jobs": {
        "type": "Query", "runAfter": after("Jobs", "Existing_Stamp_Text"),
        "inputs": {"from": "@body('Jobs')", "where": f"@not(contains(outputs('Existing_Stamp_Text'), {W_STAMP}))"}},
    "For_each_changed_job": {
        "type": "Foreach", "foreach": "@body('Changed_Jobs')", "runAfter": after("Changed_Jobs"),
        "runtimeConfiguration": {"concurrency": {"repetitions": 10}},
        "actions": per_job},
    "Open_Job_Numbers": {
        "type": "Select", "runAfter": after("Jobs"),
        "inputs": {"from": "@body('Jobs')", "select": f"@trim({c(it('jobNo'))})"}},
    "Open_Job_Text": {"type": "Compose", "runAfter": after("Open_Job_Numbers"), "inputs": joined("Open_Job_Numbers")},
    "Stale_Rows": {
        "type": "Query", "runAfter": after("Open_Job_Text", "List_Existing"),
        "inputs": {"from": "@body('List_Existing')?['value']",
                   "where": f"@not(contains(outputs('Open_Job_Text'), {W_JOB}))"}},
    "Any_Jobs": {
        "type": "If", "runAfter": after("Stale_Rows", "For_each_changed_job"),
        "expression": {"greater": ["@length(body('Jobs'))", 0]},
        "actions": {"For_each_stale_row": {
            "type": "Foreach", "foreach": "@body('Stale_Rows')", "runAfter": {},
            "runtimeConfiguration": {"concurrency": {"repetitions": 10}},
            "actions": {"Delete_Descriptions": dv("DeleteRecord", {
                "entityName": SET, "recordId": "@items('For_each_stale_row')?['crfdf_jobdescid']"})}}},
        "else": {"actions": {}}},
}

flow = {
    "properties": {
        "connectionReferences": {
            "shared_commondataserviceforapps": {
                "api": {"name": "shared_commondataserviceforapps"},
                "connection": {"connectionReferenceLogicalName": "new_sharedcommondataserviceforapps_4a52d"},
                "runtimeSource": "embedded"},
        },
        "definition": {
            "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
            "contentVersion": "1.0.0.0",
            "comment": ("BCSync_JobDescriptions - GENERATED by _gen_jobdesc_flow.py; edit that, not this. Hourly: "
                        "each open job's Field / Production / Extended Description from our BC API page into "
                        "crfdf_jobdesc, writing only jobs whose BC lastModified changed. See BCSync_JobDescriptions.md."),
            "parameters": {
                "$authentication": {"defaultValue": {}, "type": "SecureObject"},
                "$connections": {"defaultValue": {}, "type": "Object"},
                "Bc_ApiBase": {"type": "String", "defaultValue":
                               "https://api.businesscentral.dynamics.com/v2.0/fe0182fa-d183-46ab-8493-9e8ea9c3d0b8/UAT/api"},
                "Bc_CompanyId": {"type": "String", "defaultValue": "4738bfb5-a06d-ec11-bf27-000d3a132a9e"},
                "Bc_Tenant": {"type": "String", "defaultValue": "fe0182fa-d183-46ab-8493-9e8ea9c3d0b8"},
                "Bc_Audience": {"type": "String", "defaultValue": "https://api.businesscentral.dynamics.com"},
                "Bc_ClientId": {"type": "String", "defaultValue": "<< Postman app registration client id >>"},
                "Bc_ClientSecret": {"type": "String", "defaultValue": "<< store in Key Vault / secure env var - do NOT commit >>"},
            },
            "triggers": {"Hourly": {
                "type": "Recurrence",
                "recurrence": {"frequency": "Hour", "interval": 1}}},
            "actions": actions,
        },
    },
    "schemaVersion": "1.0.0.0",
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(flow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", OUT)
