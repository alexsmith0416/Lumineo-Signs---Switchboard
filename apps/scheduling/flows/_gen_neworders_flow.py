"""Generate BCSync_NewOrders-clientdata.json.

BCSync_NewOrders puts a job on the app's Jobs list as soon as the expeditor
checks Started on its "New Order This Week" step in BC Project Planning,
instead of waiting for the nightly syncs, and fills in everything BC knows.

Every 15 minutes it:
  1. reads our BC web service LumineoProjectPlanning (page 58400,
     bc/lumineo-planning-ext) for rows that are Started and changed in the last
     Lookback_Days. Step_Description is computed on the page (step GUIDs differ
     per environment), so BC can't filter on it - the flow keeps the rows whose
     step is New_Order_Step itself;
  2. drops the jobs already on the Jobs list (a crfdf_jobtrack row exists);
  3. for each new job that is Open in BC:
     - creates its crfdf_jobtrack row with Current Status = New_Order_Status,
     - fills its crfdf_bcjobs row (create or update) from BC right away: the job
       (description, bill-to, status, ending date), the sign365 release date,
       its first Order sales line (document no, remaining balance, salesperson)
       and that Sales Order (ship-to name / address / city / state / zip, the
       order amount, the salesperson) - the same fields the nightly
       BCSync_Jobs / BCSync_SalesLines / BCSync_JobReleaseDates write,
     - adds its planning lines (crfdf_bcplanninglines), like
       BCSync_JobPlanningLines, so the stepper and targets appear at once.
The nightly flows keep everything current afterwards.

The expressions are long and quote-heavy, so the JSON is GENERATED - edit here:

    python _gen_neworders_flow.py

then build the solution with _build_neworders_solution.py. See
BCSync_NewOrders.md.
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BCSync_NewOrders-clientdata.json")

DV = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "connectionName": "shared_commondataserviceforapps"}
BC = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_dynamicssmbsaas",
      "connectionName": "shared_dynamicssmbsaas"}
AUTH = {"type": "ActiveDirectoryOAuth", "authority": "https://login.microsoftonline.com",
        "tenant": "@parameters('Bc_Tenant')", "audience": "@parameters('Bc_Audience')",
        "clientId": "@parameters('Bc_ClientId')", "secret": "@parameters('Bc_ClientSecret')"}
SVC = "@{parameters('Bc_ODataBase')}/Company('@{encodeUriComponent(parameters('Bc_Company'))}')/@{parameters('Bc_Service')}"

JOB = "items('For_each_new_job')"
# The job number as an OData string literal body (' doubled).
JOBLIT = f"replace({JOB}, '''', '''''')"


def after(*names, status="Succeeded"):
    return {n: [status] for n in names}


def bc_get(table, flt, dataset="@parameters('Bc_AnalyticsDataset')", top=None, run_after=None):
    params = {"bcenvironment": "@parameters('Bc_Environment')", "company": "@parameters('Bc_CompanyId')",
              "dataset": dataset, "table": table, "$filter": flt}
    if top:
        params["$top"] = top
    return {"type": "OpenApiConnection", "runAfter": run_after or {},
            "inputs": {"parameters": params, "host": {**BC, "operationId": "GetItemsV3"}}}


def dv(op, params, run_after=None, paginate=False):
    a = {"type": "OpenApiConnection", "runAfter": run_after or {},
         "inputs": {"parameters": params, "host": {**DV, "operationId": op}}}
    if paginate:
        a["runtimeConfiguration"] = {"paginationPolicy": {"minimumItemCount": 5000}}
    return a


def first(action):
    return f"first(body('{action}')?['value'])"


def pick(a, b):
    """a unless it's blank, else b."""
    return f"if(empty({a}), {b}, {a})"


def bc_date(v):
    """BC's 0001-01-01 means 'no date'."""
    return f"if(or(empty(coalesce({v}, '')), startsWith(coalesce({v}, ''), '0001')), null, {v})"


def f(obj, name):
    """obj?['name']"""
    return f"{obj}?['{name}']"


J, R, C, L, O = (first("Get_BC_Job"), first("Get_Release_Date"), first("Get_Customer"),
                 first("Get_Sales_Lines"), first("Get_Sales_Order"))

# crfdf_bcjobs fields - the same ones the nightly flows write. Ship-to comes
# from the Sales Order (the install address), falling back to the bill-to
# customer's address like BCSync_Jobs.
JOB_FIELDS = {
    "item/crfdf_jobnumber": f"@{JOB}",
    "item/crfdf_description": f"@{f(J, 'description')}",
    "item/crfdf_billtocustomerno": f"@{f(J, 'billToCustomerNo')}",
    "item/crfdf_customername": f"@coalesce({f(C, 'crfdf_customername')}, {JOB})",
    "item/crfdf_status": f"@{f(J, 'status')}",
    "item/crfdf_promiseddate": f"@{bc_date(f(J, 'endingDate'))}",
    "item/crfdf_releasedate": f"@{bc_date(f(R, 'icgSgpOrderReleasedDate'))}",
    "item/crfdf_appjobname": "@" + pick(f(O, "shipToName"), pick(f(O, "customerName"), f"coalesce({f(C, 'crfdf_customername')}, {JOB})")),
    "item/crfdf_shiptoaddress": "@" + pick(f(O, "shipToAddressLine1"), f(C, "crfdf_addressline1")),
    "item/crfdf_shiptocity": "@" + pick(f(O, "shipToCity"), f(C, "crfdf_city")),
    "item/crfdf_shiptostate": "@" + pick(f(O, "shipToState"), f(C, "crfdf_state")),
    "item/crfdf_shiptozip": "@" + pick(f(O, "shipToPostCode"), f(C, "crfdf_postalcode")),
    "item/crfdf_saleslinefound": "@greater(length(coalesce(body('Get_Sales_Lines')?['value'], json('[]'))), 0)",
    "item/crfdf_salesdocumentno": f"@{f(L, 'documentNo')}",
    "item/crfdf_saleslinedescription": f"@{f(L, 'description')}",
    "item/crfdf_saleslinesselltono": f"@{f(L, 'sellToCustomerNo')}",
    "item/crfdf_remainingbalance": f"@{f(L, 'outstandingAmountLCY')}",
    "item/crfdf_salesorderamount": f"@{f(O, 'totalAmountExcludingTax')}",
    "item/crfdf_salespersoncode": "@" + pick(f(O, "salesperson"), f(L, "salespersonCode")),
}

# Updating a row that already exists (the nightly syncs got there first): keep
# the value it has wherever BC gave nothing back this time, so a failed or
# empty read never blanks what the nightly syncs filled in.
EXISTING = first("Find_BC_Job_Row")
NUMERIC = {"item/crfdf_remainingbalance", "item/crfdf_salesorderamount",
           "item/crfdf_promiseddate", "item/crfdf_releasedate"}


def keep_existing(field, expr):
    col = field.split("/", 1)[1]
    new = expr[1:]  # drop the leading "@"
    old = f(EXISTING, col)
    if field == "item/crfdf_jobnumber":
        return expr
    if field == "item/crfdf_saleslinefound":
        return f"@or({new}, equals({old}, true))"
    if field in NUMERIC:  # numbers / dates: null means "nothing came back"
        return f"@coalesce({new}, {old})"
    return f"@if(empty(coalesce({new}, '')), {old}, {new})"


UPDATE_FIELDS = {k: keep_existing(k, v) for k, v in JOB_FIELDS.items()}
# Ship-to on an update: the order's, else what the row already has (the nightly
# sync's order ship-to), and only then the bill-to customer's address.
for _field, _order, _cust in [("shiptoaddress", "shipToAddressLine1", "crfdf_addressline1"),
                              ("shiptocity", "shipToCity", "crfdf_city"),
                              ("shiptostate", "shipToState", "crfdf_state"),
                              ("shiptozip", "shipToPostCode", "crfdf_postalcode")]:
    UPDATE_FIELDS[f"item/crfdf_{_field}"] = "@" + pick(f(O, _order), pick(f(EXISTING, f"crfdf_{_field}"), f(C, _cust)))
UPDATE_FIELDS["item/crfdf_appjobname"] = "@" + pick(f(O, "shipToName"), pick(
    f(O, "customerName"), pick(f(EXISTING, "crfdf_appjobname"), f"coalesce({f(C, 'crfdf_customername')}, {JOB})")))
EXISTING_COLS = ",".join(["crfdf_bcjobid"] + [k.split("/", 1)[1] for k in JOB_FIELDS if k != "item/crfdf_jobnumber"])

LINE = "items('For_each_line')"
LINE_FIELDS = {
    "item/crfdf_description": f"@{LINE}?['description']",
    "item/crfdf_jobno": f"@{JOB}",
    "item/crfdf_jobtaskno": f"@{LINE}?['jobTaskNo']",
    "item/crfdf_lineno": f"@{LINE}?['lineNo']",
    "item/crfdf_linetype": f"@{LINE}?['lineType']",
    "item/crfdf_name": f"@{LINE}?['description']",
    "item/crfdf_planningdate": f"@{bc_date(f(LINE, 'planningDate'))}",
    "item/crfdf_quantity": f"@{LINE}?['quantity']",
    "item/crfdf_resourceno": f"@{LINE}?['no']",
    "item/crfdf_totalprice": f"@{LINE}?['totalPriceLCY']",
    "item/crfdf_type": f"@{LINE}?['jobType']",
}

refresh = {
    "Get_Release_Date": bc_get("jobs", f"no eq '@{{{JOBLIT}}}'", dataset="@parameters('Bc_Sign365Dataset')"),
    "Get_Customer": dv("ListRecords", {
        "entityName": "crfdf_bccustomers",
        "$select": "crfdf_customername,crfdf_addressline1,crfdf_city,crfdf_state,crfdf_postalcode",
        "$filter": f"crfdf_customerno eq '@{{replace(coalesce({J}?['billToCustomerNo'], ''), '''', '''''')}}'",
        "$top": 1}),
    "Get_Sales_Lines": bc_get("salesLines", f"projectNo eq '@{{{JOBLIT}}}' and documentType eq 'Order'"),
    "Get_Sales_Order": bc_get(
        "salesOrders", f"number eq '@{{replace(coalesce({L}?['documentNo'], ''), '''', '''''')}}'",
        dataset="v2.0", top=1, run_after=after("Get_Sales_Lines")),
    "Find_BC_Job_Row": dv("ListRecords", {
        "entityName": "crfdf_bcjobs", "$select": EXISTING_COLS,
        "$filter": f"crfdf_jobnumber eq '@{{{JOBLIT}}}'", "$top": 1}),
    "BC_Job_Row_Exists": {
        "type": "If",
        # Write what came back even if an optional read failed (e.g. no Sales
        # Order yet); the nightly syncs fill the rest in.
        "runAfter": {**{n: ["Succeeded", "Failed", "Skipped"] for n in ("Get_Release_Date", "Get_Customer", "Get_Sales_Order")},
                     "Find_BC_Job_Row": ["Succeeded"]},
        "expression": {"greater": ["@length(body('Find_BC_Job_Row')?['value'])", 0]},
        "actions": {"Update_BC_Job": dv("UpdateOnlyRecord", {
            "entityName": "crfdf_bcjobs", "recordId": f"@{first('Find_BC_Job_Row')}?['crfdf_bcjobid']", **UPDATE_FIELDS})},
        "else": {"actions": {"Create_BC_Job": dv("CreateRecord", {"entityName": "crfdf_bcjobs", **JOB_FIELDS})}},
    },
    "Get_Planning_Lines": bc_get("jobPlanningLines", f"jobNo eq '@{{{JOBLIT}}}'"),
    "Keep_Resource_Lines": {
        "type": "Query", "runAfter": after("Get_Planning_Lines"),
        "inputs": {"from": "@body('Get_Planning_Lines')?['value']",
                   "where": "@or(equals(item()?['lineType'], 'Billable'), equals(item()?['jobType'], 'Resource'))"}},
    "For_each_line": {
        "type": "Foreach", "foreach": "@body('Keep_Resource_Lines')", "runAfter": after("Keep_Resource_Lines"),
        "actions": {
            "Find_Line": dv("ListRecords", {
                "entityName": "crfdf_bcplanninglines", "$select": "crfdf_bcplanninglineid", "$top": 1,
                "$filter": (f"crfdf_jobno eq '@{{{JOBLIT}}}' and crfdf_jobtaskno eq "
                            f"'@{{replace(coalesce({LINE}?['jobTaskNo'], ''), '''', '''''')}}' and "
                            f"crfdf_lineno eq @{{{LINE}?['lineNo']}}")}),
            "Line_Exists": {
                "type": "If", "runAfter": after("Find_Line"),
                "expression": {"greater": ["@length(body('Find_Line')?['value'])", 0]},
                "actions": {"Update_Line": dv("UpdateOnlyRecord", {
                    "entityName": "crfdf_bcplanninglines",
                    "recordId": f"@{first('Find_Line')}?['crfdf_bcplanninglineid']", **LINE_FIELDS})},
                "else": {"actions": {"Create_Line": dv("CreateRecord", {
                    "entityName": "crfdf_bcplanninglines", **LINE_FIELDS})}},
            },
        },
    },
}

per_job = {
    "Get_BC_Job": bc_get("jobs", f"no eq '@{{{JOBLIT}}}'"),
    "Job_Is_Open": {
        "type": "If", "runAfter": after("Get_BC_Job"),
        # A job that isn't open (or isn't in BC) is left alone.
        "expression": {"and": [
            {"greater": ["@length(body('Get_BC_Job')?['value'])", 0]},
            {"equals": [f"@{J}?['status']", "Open"]},
            {"not": {"equals": [f"@{J}?['complete']", True]}}]},
        "actions": {
            "Add_To_Jobs_List": dv("CreateRecord", {
                "entityName": "crfdf_jobtracks",
                "item/crfdf_jobno": f"@{JOB}",
                "item/crfdf_name": f"@{JOB}",
                "item/crfdf_statusoverride": "@parameters('New_Order_Status')"}),
            # Filling in from BC is best-effort: if a read fails the job is
            # still on the list, and the nightly syncs fill it in.
            "Fill_In_From_BC": {"type": "Scope", "runAfter": after("Add_To_Jobs_List"), "actions": refresh},
        },
        "else": {"actions": {}},
    },
}

since = "formatDateTime(addDays(utcNow(), mul(-1, int(parameters('Lookback_Days')))), 'yyyy-MM-ddTHH:mm:ssZ')"
actions = {
    "Get_Started_Steps": {
        "type": "Http", "runAfter": {},
        "inputs": {
            "method": "GET",
            "uri": (SVC + "?$filter=@{encodeUriComponent(concat('Started eq true and SystemModifiedAt gt ', "
                    + since + "))}&$select=Project_No,Step_Description"),
            "headers": {"Accept": "application/json"},
            "authentication": AUTH}},
    "New_Order_Steps": {
        "type": "Query", "runAfter": after("Get_Started_Steps"),
        "inputs": {"from": "@body('Get_Started_Steps')?['value']",
                   "where": "@equals(toLower(trim(coalesce(item()?['Step_Description'], ''))), toLower(trim(parameters('New_Order_Step'))))"}},
    "New_Order_Job_Numbers": {
        "type": "Select", "runAfter": after("New_Order_Steps"),
        "inputs": {"from": "@body('New_Order_Steps')", "select": "@item()?['Project_No']"}},
    "Any_New_Orders": {
        "type": "If", "runAfter": after("New_Order_Job_Numbers"),
        "expression": {"greater": ["@length(body('New_Order_Job_Numbers'))", 0]},
        "actions": {
            "List_Tracked_Jobs": dv("ListRecords", {"entityName": "crfdf_jobtracks", "$select": "crfdf_jobno"}, paginate=True),
            "Tracked_Job_Numbers": {
                "type": "Select", "runAfter": after("List_Tracked_Jobs"),
                "inputs": {"from": "@body('List_Tracked_Jobs')?['value']", "select": "@trim(coalesce(item()?['crfdf_jobno'], ''))"}},
            "Untracked_Jobs": {
                "type": "Query", "runAfter": after("Tracked_Job_Numbers"),
                "inputs": {"from": "@union(body('New_Order_Job_Numbers'), body('New_Order_Job_Numbers'))",
                           "where": "@not(contains(body('Tracked_Job_Numbers'), trim(item())))"}},
            "For_each_new_job": {
                "type": "Foreach", "foreach": "@body('Untracked_Jobs')", "runAfter": after("Untracked_Jobs"),
                # One at a time: two runs can't race to create the same job's row.
                "runtimeConfiguration": {"concurrency": {"repetitions": 1}},
                "actions": per_job},
        },
        "else": {"actions": {}},
    },
}

flow = {
    "properties": {
        "connectionReferences": {
            "shared_commondataserviceforapps": {
                "api": {"name": "shared_commondataserviceforapps"},
                "connection": {"connectionReferenceLogicalName": "new_sharedcommondataserviceforapps_4a52d"},
                "runtimeSource": "embedded"},
            "shared_dynamicssmbsaas": {
                "api": {"name": "shared_dynamicssmbsaas"},
                "connection": {"connectionReferenceLogicalName": "new_shareddynamicssmbsaas_69260"},
                "runtimeSource": "embedded"},
        },
        "definition": {
            "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
            "contentVersion": "1.0.0.0",
            "comment": ("BCSync_NewOrders - GENERATED by _gen_neworders_flow.py; edit that, not this. Adds a job "
                        "to the Jobs list (crfdf_jobtrack, status New_Order_Status) once its New Order This Week "
                        "step is Started in BC Project Planning, and fills its crfdf_bcjobs row + planning lines "
                        "from BC right away. See BCSync_NewOrders.md."),
            "parameters": {
                "$authentication": {"defaultValue": {}, "type": "SecureObject"},
                "$connections": {"defaultValue": {}, "type": "Object"},
                # Our planning web service (HTTP, app registration) ...
                "Bc_ODataBase": {"type": "String", "defaultValue":
                                 "https://api.businesscentral.dynamics.com/v2.0/fe0182fa-d183-46ab-8493-9e8ea9c3d0b8/UAT/ODataV4"},
                "Bc_Company": {"type": "String", "defaultValue": "Luminous Neon"},
                "Bc_Service": {"type": "String", "defaultValue": "LumineoProjectPlanning"},
                "Bc_Tenant": {"type": "String", "defaultValue": "fe0182fa-d183-46ab-8493-9e8ea9c3d0b8"},
                "Bc_Audience": {"type": "String", "defaultValue": "https://api.businesscentral.dynamics.com"},
                "Bc_ClientId": {"type": "String", "defaultValue": "<< Postman app registration client id >>"},
                "Bc_ClientSecret": {"type": "String", "defaultValue": "<< store in Key Vault / secure env var - do NOT commit >>"},
                # ... and the BC connector reads (the signed-in connection).
                "Bc_Environment": {"type": "String", "defaultValue": "UAT"},
                "Bc_CompanyId": {"type": "String", "defaultValue": "4738bfb5-a06d-ec11-bf27-000d3a132a9e"},
                "Bc_AnalyticsDataset": {"type": "String", "defaultValue": "microsoft/analytics/v1.0"},
                "Bc_Sign365Dataset": {"type": "String", "defaultValue": "infotechConsultingGroup/sign365/v1.0"},
                "New_Order_Step": {"type": "String", "defaultValue": "New Order This Week"},
                "New_Order_Status": {"type": "String", "defaultValue": "New Order this week"},
                "Lookback_Days": {"type": "Int", "defaultValue": 3},
            },
            "triggers": {"Every_15_minutes": {
                "type": "Recurrence",
                "recurrence": {"frequency": "Minute", "interval": 15}}},
            "actions": actions,
        },
    },
    "schemaVersion": "1.0.0.0",
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(flow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", OUT)
