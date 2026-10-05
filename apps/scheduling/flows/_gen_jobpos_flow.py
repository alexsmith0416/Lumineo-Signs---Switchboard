"""Generate BCSync_JobPOs-clientdata.json.

BCSync_JobPOs fills crfdf_jobpo — the purchase orders written to each job, for
the job panel's "Purchase orders" section — from our BC API queries in
bc/lumineo-planning-ext (v1.0.0.8+), api/lumineo/planning/v1.0:
    jobPurchaseOrders         query 58401  open orders (Purchase Line)
    jobPurchaseOrderArchives  query 58402  archived orders (fully received /
                                           invoiced, or printed / released)

Nightly it:
  1. reads both queries (HTTP, app registration, like BCSync_NewOrders) and the
     open BC jobs on the Jobs list (crfdf_bcjobs);
  2. builds the wanted rows, one per (job, PO), only for those jobs. A PO can
     come back several times — open AND archived (20 in UAT), or archived
     under two versions whose vendor / order date differ (42 in UAT) — so each
     row carries a rank: open beats every archive version, then the highest
     version wins;
  3. compares a signature (key + vendor + order date + status) with the rows
     already in crfdf_jobpo and writes only the keys that differ — create or
     update with the winning row (a losing duplicate is checked and skipped);
  4. deletes rows whose (job, PO) isn't wanted any more (the job closed, or the
     PO left the job). Skipped if the wanted list came back empty.

Large lists are compared as '^'-delimited strings (one substring search per row)
instead of contains() on arrays, so 10k rows stay fast.

The expressions are long and quote-heavy, so the JSON is GENERATED - edit here:

    python _gen_jobpos_flow.py

then build the solution with _build_jobpos_solution.py. See BCSync_JobPOs.md.
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BCSync_JobPOs-clientdata.json")

DV = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "connectionName": "shared_commondataserviceforapps"}
AUTH = {"type": "ActiveDirectoryOAuth", "authority": "https://login.microsoftonline.com",
        "tenant": "@parameters('Bc_Tenant')", "audience": "@parameters('Bc_Audience')",
        "clientId": "@parameters('Bc_ClientId')", "secret": "@parameters('Bc_ClientSecret')"}
API = "@{parameters('Bc_ApiBase')}/lumineo/planning/v1.0/companies(@{parameters('Bc_CompanyId')})"
SEP = "^"  # between list entries; never in BC job / PO numbers or vendor names
OPEN_RANK = 1000000  # beats any archive version number


def after(*names, status="Succeeded"):
    return {n: [status] for n in names}


def dv(op, params, run_after=None, paginate=False):
    a = {"type": "OpenApiConnection", "runAfter": run_after or {},
         "inputs": {"parameters": params, "host": {**DV, "operationId": op}}}
    if paginate:
        a["runtimeConfiguration"] = {"paginationPolicy": {"minimumItemCount": 100000}}
    return a


def bc_get(entity_set):
    return {"type": "Http", "runAfter": {},
            "inputs": {"method": "GET", "uri": f"{API}/{entity_set}",
                       "headers": {"Accept": "application/json"}, "authentication": AUTH}}


def c(v):
    """coalesce(v, '') - Dataverse / BC give null for blanks."""
    return f"coalesce({v}, '')"


def sig(key, vendor_no, vendor_name, order_date, status):
    return f"concat({key}, '~', {c(vendor_no)}, '~', {c(vendor_name)}, '~', {c(order_date)}, '~', {c(status)})"


def joined(action):
    """'^a^b^c^' from a Select of strings, so membership = one substring search."""
    return f"@concat('{SEP}', join(body('{action}'), '{SEP}'), '{SEP}')"


def wrapped(v):
    return f"concat('{SEP}', {v}, '{SEP}')"


def row_select(source, status_expr, rank_expr):
    """Map a BC query row to a wanted crfdf_jobpo row."""
    job, doc, odate = c("item()?['jobNo']"), c("item()?['documentNo']"), c("item()?['orderDate']")
    key = f"concat(trim({job}), '|', trim({doc}))"
    date = f"if(startsWith({odate}, '0001'), '', {odate})"
    return {
        "type": "Select", "runAfter": after(source),
        "inputs": {"from": f"@body('{source}')?['value']", "select": {
            "k": f"@{key}",
            "jobNo": f"@trim({job})",
            "poNo": f"@trim({doc})",
            "vendorNo": "@" + c("item()?['buyFromVendorNo']"),
            "vendorName": "@" + c("item()?['buyFromVendorName']"),
            "orderDate": f"@{date}",
            "status": f"@{status_expr}",
            "rank": f"@{rank_expr}",
            "sig": "@" + sig(key, "item()?['buyFromVendorNo']", "item()?['buyFromVendorName']", date, status_expr),
        }}}


# BC sends enum names with spaces encoded ("Pending_x0020_Approval").
OPEN_STATUS = "replace(coalesce(item()?['status'], 'Open'), '_x0020_', ' ')"

KEY = "items('For_each_changed_key')"
WIN = "outputs('Winner')"
EXISTING = "first(body('Existing_Row'))"
FIELDS = {
    "item/crfdf_name": f"@{WIN}?['k']",
    "item/crfdf_jobno": f"@{WIN}?['jobNo']",
    "item/crfdf_pono": f"@{WIN}?['poNo']",
    "item/crfdf_vendorno": f"@{WIN}?['vendorNo']",
    "item/crfdf_vendorname": f"@{WIN}?['vendorName']",
    "item/crfdf_orderdate": f"@{WIN}?['orderDate']",
    "item/crfdf_postatus": f"@{WIN}?['status']",
}
EXISTING_SIG = sig(f"{EXISTING}?['crfdf_name']", f"{EXISTING}?['crfdf_vendorno']", f"{EXISTING}?['crfdf_vendorname']",
                   f"{EXISTING}?['crfdf_orderdate']", f"{EXISTING}?['crfdf_postatus']")

per_key = {
    "Same_Key": {
        "type": "Query", "runAfter": {},
        "inputs": {"from": "@body('Wanted_Rows')", "where": f"@equals(item()?['k'], {KEY})"}},
    # Open beats archived; among archive versions the highest wins.
    "Winner": {"type": "Compose", "runAfter": after("Same_Key"),
               "inputs": "@last(sort(body('Same_Key'), 'rank'))"},
    "Existing_Row": {
        "type": "Query", "runAfter": after("Winner"),
        "inputs": {"from": "@body('List_Existing')?['value']", "where": f"@equals(item()?['crfdf_name'], {KEY})"}},
    "Row_Exists": {
        "type": "If", "runAfter": after("Existing_Row"),
        "expression": {"greater": ["@length(body('Existing_Row'))", 0]},
        "actions": {
            # A losing duplicate lands here every night; the winner is already saved.
            "Differs": {
                "type": "If", "runAfter": {},
                "expression": {"not": {"equals": [f"@{WIN}?['sig']", f"@{EXISTING_SIG}"]}},
                "actions": {"Update_PO": dv("UpdateOnlyRecord", {
                    "entityName": "crfdf_jobpos", "recordId": f"@{EXISTING}?['crfdf_jobpoid']", **FIELDS})},
                "else": {"actions": {}}}},
        "else": {"actions": {"Create_PO": dv("CreateRecord", {"entityName": "crfdf_jobpos", **FIELDS})}},
    },
}

W_JOB = wrapped("item()?['jobNo']")
W_SIG = wrapped("item()?['sig']")
W_NAME = wrapped("coalesce(item()?['crfdf_name'], '')")

actions = {
    "Get_Open_POs": bc_get("jobPurchaseOrders"),
    "Get_Archived_POs": bc_get("jobPurchaseOrderArchives"),
    "List_BC_Jobs": dv("ListRecords", {"entityName": "crfdf_bcjobs", "$select": "crfdf_jobnumber",
                                       "$filter": "crfdf_jobnumber ne null"}, paginate=True),
    "List_Existing": dv("ListRecords", {
        "entityName": "crfdf_jobpos",
        "$select": "crfdf_jobpoid,crfdf_name,crfdf_vendorno,crfdf_vendorname,crfdf_orderdate,crfdf_postatus"},
        paginate=True),
    # BC pages API results; one page today (9.4k archive rows). Fail loudly rather
    # than sync half the list and delete the rest.
    "Check_Single_Page": {
        "type": "If", "runAfter": after("Get_Open_POs", "Get_Archived_POs"),
        "expression": {"or": [
            {"not": {"equals": ["@empty(coalesce(body('Get_Open_POs')?['@odata.nextLink'], ''))", True]}},
            {"not": {"equals": ["@empty(coalesce(body('Get_Archived_POs')?['@odata.nextLink'], ''))", True]}}]},
        "actions": {"Stop_Paged": {"type": "Terminate", "runAfter": {}, "inputs": {
            "runStatus": "Failed", "runError": {"code": "Paged",
                                                "message": "BC returned more than one page - add paging to BCSync_JobPOs."}}}},
        "else": {"actions": {}}},
    "Open_Rows": {**row_select("Get_Open_POs", OPEN_STATUS, str(OPEN_RANK)),
                  "runAfter": after("Check_Single_Page")},
    "Archived_Rows": {**row_select("Get_Archived_POs", "'Archived'", "int(coalesce(item()?['versionNo'], 0))"),
                      "runAfter": after("Check_Single_Page")},
    "Job_Numbers": {
        "type": "Select", "runAfter": after("List_BC_Jobs"),
        "inputs": {"from": "@body('List_BC_Jobs')?['value']", "select": "@trim(coalesce(item()?['crfdf_jobnumber'], ''))"}},
    "Job_Text": {"type": "Compose", "runAfter": after("Job_Numbers"), "inputs": joined("Job_Numbers")},
    "Wanted_Rows": {
        "type": "Query", "runAfter": after("Open_Rows", "Archived_Rows", "Job_Text"),
        "inputs": {"from": "@union(body('Open_Rows'), body('Archived_Rows'))",
                   "where": f"@and(not(empty(item()?['poNo'])), contains(outputs('Job_Text'), {W_JOB}))"}},
    "Existing_Sigs": {
        "type": "Select", "runAfter": after("List_Existing"),
        "inputs": {"from": "@body('List_Existing')?['value']", "select": "@" + sig(
            "item()?['crfdf_name']", "item()?['crfdf_vendorno']", "item()?['crfdf_vendorname']",
            "item()?['crfdf_orderdate']", "item()?['crfdf_postatus']")}},
    "Existing_Sig_Text": {"type": "Compose", "runAfter": after("Existing_Sigs"), "inputs": joined("Existing_Sigs")},
    "Changed_Rows": {
        "type": "Query", "runAfter": after("Wanted_Rows", "Existing_Sig_Text"),
        "inputs": {"from": "@body('Wanted_Rows')",
                   "where": f"@not(contains(outputs('Existing_Sig_Text'), {W_SIG}))"}},
    "Changed_Keys": {
        "type": "Select", "runAfter": after("Changed_Rows"),
        "inputs": {"from": "@body('Changed_Rows')", "select": "@item()?['k']"}},
    "For_each_changed_key": {
        "type": "Foreach", "foreach": "@union(body('Changed_Keys'), body('Changed_Keys'))",
        "runAfter": after("Changed_Keys"),
        "runtimeConfiguration": {"concurrency": {"repetitions": 10}},
        "actions": per_key},
    "Wanted_Keys": {
        "type": "Select", "runAfter": after("Wanted_Rows"),
        "inputs": {"from": "@body('Wanted_Rows')", "select": "@item()?['k']"}},
    "Wanted_Key_Text": {"type": "Compose", "runAfter": after("Wanted_Keys"), "inputs": joined("Wanted_Keys")},
    "Stale_Rows": {
        "type": "Query", "runAfter": after("Wanted_Key_Text", "List_Existing"),
        "inputs": {"from": "@body('List_Existing')?['value']",
                   "where": f"@not(contains(outputs('Wanted_Key_Text'), {W_NAME}))"}},
    "Any_Wanted": {
        "type": "If", "runAfter": after("Stale_Rows", "For_each_changed_key"),
        # An empty wanted list means a bad read, not "every PO is gone".
        "expression": {"greater": ["@length(body('Wanted_Rows'))", 0]},
        "actions": {"For_each_stale_row": {
            "type": "Foreach", "foreach": "@body('Stale_Rows')", "runAfter": {},
            "runtimeConfiguration": {"concurrency": {"repetitions": 10}},
            "actions": {"Delete_PO": dv("DeleteRecord", {
                "entityName": "crfdf_jobpos", "recordId": "@items('For_each_stale_row')?['crfdf_jobpoid']"})}}},
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
            "comment": ("BCSync_JobPOs - GENERATED by _gen_jobpos_flow.py; edit that, not this. Nightly: each open "
                        "job's purchase orders (open + archived) from our BC API queries into crfdf_jobpo, writing "
                        "only what changed. See BCSync_JobPOs.md."),
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
            "triggers": {"Nightly": {
                "type": "Recurrence",
                "recurrence": {"frequency": "Day", "interval": 1, "timeZone": "Central Standard Time",
                               "schedule": {"hours": ["5"], "minutes": [15]}}}},
            "actions": actions,
        },
    },
    "schemaVersion": "1.0.0.0",
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(flow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", OUT)
