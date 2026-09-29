"""Generate BCPush_PlanningSteps-clientdata.json.

The flow's expressions are long and quote-heavy (WDL doubles single quotes),
so the JSON is GENERATED from this file — edit here, then run:

    python _gen_planningsteps_flow.py

and rebuild the solution with _build_pushflow_solution.py. See
BCPush_PlanningSteps.md for what the flow does and why.
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BCPush_PlanningSteps-clientdata.json")


def T(col):
    """Trigger (outbox row) column."""
    return f"triggerOutputs()?['body/crfdf_{col}']"


AUTH = {"type": "ActiveDirectoryOAuth", "authority": "https://login.microsoftonline.com",
        "tenant": "@parameters('Bc_Tenant')", "audience": "@parameters('Bc_Audience')",
        "clientId": "@parameters('Bc_ClientId')", "secret": "@parameters('Bc_ClientSecret')"}
SVC = "@{parameters('Bc_ODataBase')}/Company('@{encodeUriComponent(parameters('Bc_Company'))}')/@{parameters('Bc_Service')}"
Q = "''''"      # WDL literal for one single quote
QQ = "''''''"   # WDL literal for two single quotes


def esc(expr):
    """OData string-literal escaping: ' -> ''."""
    return f"replace({expr}, {Q}, {QQ})"


JOBLIT = "@{encodeUriComponent(" + esc(T('jobno')) + ")}"
DV_HOST = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
           "connectionName": "shared_commondataserviceforapps"}


def dv_update(status, msg, after=None):
    return {"type": "OpenApiConnection",
            "inputs": {"parameters": {
                "entityName": "crfdf_bcpushqueues",
                "recordId": f"@{T('bcpushqueueid')}",
                "item/crfdf_status": status, "item/crfdf_statusmessage": msg},
                "host": {**DV_HOST, "operationId": "UpdateRecord"}},
            "runAfter": after or {}}


def http(method, uri, body=None, headers=None):
    inputs = {"method": method, "uri": uri, "headers": headers or {}, "authentication": AUTH}
    if body is not None:
        inputs["body"] = body
    return inputs


is_sched = f"equals({T('kind')}, 'schedule')"
cur = "first(body('Match_Step'))"

# schedule: Sched_Start/Sched_End (+Assigned_To only when set, so a team or
# multi-person step never clears BC's assignee). The page converts to Central
# and never touches Started.
sched2 = (f"addProperty(addProperty(json('{{}}'), 'Sched_Start', {T('startdatetime')}), "
          f"'Sched_End', {T('enddatetime')})")
sched_body = f"if(empty({T('assignedto')}), {sched2}, addProperty({sched2}, 'Assigned_To', {T('assignedto')}))"

# state: only the flags that DIFFER from BC. Re-sending Complete=true would
# make ICG re-stamp Completed Date; a re-open also blanks the Completed Date
# ICG leaves behind. With no row yet, cur is null, so both flags are sent.
want_started = f"equals({T('started')}, true)"
want_complete = f"equals({T('complete')}, true)"
started_part = (f"if(equals({cur}?['Started'], {want_started}), json('{{}}'), "
                f"if({want_started}, json('{{\"Started\":true}}'), json('{{\"Started\":false}}')))")
complete_part = (f"if(equals({cur}?['Complete'], {want_complete}), json('{{}}'), "
                 f"if({want_complete}, json('{{\"Complete\":true}}'), "
                 f"json('{{\"Complete\":false,\"Completed_Date\":\"0001-01-01T00:00:00Z\"}}')))")
state_body = f"union({started_part}, {complete_part})"

# A newer outbox row for the same job + step + kind supersedes this one: each
# row carries the step's WHOLE current state, so only the newest matters, and
# the Dataverse trigger doesn't deliver rows strictly in order.
newer_filter = ("@concat('crfdf_jobno eq ''', " + esc(T('jobno')) +
                ", ''' and crfdf_planningstep eq ''', " + esc(T('planningstep')) +
                ", ''' and crfdf_kind eq ''', " + T('kind') +
                ", ''' and createdon gt ', triggerOutputs()?['body/createdon'])")

apply_actions = {
    "Get_Job_Rows": {"type": "Http", "runAfter": {}, "inputs": http(
        "GET",
        SVC + "?$filter=@{encodeUriComponent(concat('Project_No eq ''', " + esc(T('jobno')) + ", " + Q + "))}",
        headers={"Accept": "application/json"})},
    "Match_Step": {"type": "Query", "runAfter": {"Get_Job_Rows": ["Succeeded"]}, "inputs": {
        "from": "@body('Get_Job_Rows')?['value']",
        "where": f"@equals(item()?['Step_Description'], {T('planningstep')})"}},
    "Push_Body": {"type": "Compose", "runAfter": {"Match_Step": ["Succeeded"]},
                  "inputs": f"@if({is_sched}, {sched_body}, {state_body})"},
    "Row_Exists": {
        "type": "If", "runAfter": {"Push_Body": ["Succeeded"]},
        "expression": {"greater": ["@length(body('Match_Step'))", 0]},
        "actions": {
            "Anything_To_Send": {
                "type": "If", "runAfter": {},
                "expression": {"not": {"equals": ["@empty(outputs('Push_Body'))", True]}},
                "actions": {
                    "Patch_Row": {"type": "Http", "runAfter": {}, "inputs": http(
                        "PATCH",
                        SVC + "(Project_No='" + JOBLIT + "',Code=@{" + cur + "?['Code']})",
                        body="@outputs('Push_Body')",
                        headers={"Content-Type": "application/json", "If-Match": "*"})},
                    "Mark_Updated": dv_update("synced", f"@concat('updated ', {T('planningstep')})",
                                              {"Patch_Row": ["Succeeded"]}),
                },
                "else": {"actions": {
                    "Mark_No_Change": dv_update("synced", f"@concat({T('planningstep')}, ' already matches')"),
                }}},
        },
        "else": {"actions": {
            # No row: create one when there's something to put in it. A state
            # push that is neither Started nor Complete has nothing to say.
            "Needs_Create": {
                "type": "If", "runAfter": {},
                "expression": {"or": [{"equals": [f"@{T('kind')}", "schedule"]},
                                      {"equals": [f"@{T('started')}", True]},
                                      {"equals": [f"@{T('complete')}", True]}]},
                "actions": {
                    "Create_Row": {"type": "Http", "runAfter": {}, "inputs": http(
                        "POST", SVC,
                        body=(f"@addProperty(addProperty(outputs('Push_Body'), 'Project_No', "
                              f"{T('jobno')}), 'Step_Description', {T('planningstep')})"),
                        headers={"Content-Type": "application/json"})},
                    "Mark_Created": dv_update("synced", f"@concat('created ', {T('planningstep')})",
                                              {"Create_Row": ["Succeeded"]}),
                },
                "else": {"actions": {
                    "Mark_Nothing_To_Set": dv_update(
                        "synced", f"@concat('no BC row for ', {T('planningstep')}, ' - nothing to set')"),
                }}}}}},
}

flow = {
    "properties": {
        "connectionReferences": {"shared_commondataserviceforapps": {
            "api": {"name": "shared_commondataserviceforapps"},
            "connection": {"connectionReferenceLogicalName": "new_sharedcommondataserviceforapps_bcpush"},
            "runtimeSource": "embedded"}},
        "definition": {
            "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
            "contentVersion": "1.0.0.0",
            "comment": ("BCPush_PlanningSteps - GENERATED by _gen_planningsteps_flow.py; edit that, not this. "
                        "Drains crfdf_bcpushqueue rows of kind schedule/state into our BC web service "
                        "LumineoProjectPlanning (page 58400, bc/lumineo-planning-ext): one row per (job, BC "
                        "catalogue step), matched on Step_Description, PATCHed or created. schedule = "
                        "Sched_Start/Sched_End(+Assigned_To); state = Started/Complete mirrored from the "
                        "production stepper, only the flags that differ. A newer row for the same job+step+kind "
                        "supersedes an older one. See BCPush_PlanningSteps.md."),
            "parameters": {
                "$authentication": {"defaultValue": {}, "type": "SecureObject"},
                "$connections": {"defaultValue": {}, "type": "Object"},
                "Bc_ODataBase": {"type": "String", "defaultValue":
                                 "https://api.businesscentral.dynamics.com/v2.0/fe0182fa-d183-46ab-8493-9e8ea9c3d0b8/UAT/ODataV4"},
                "Bc_Company": {"type": "String", "defaultValue": "Luminous Neon"},
                "Bc_Service": {"type": "String", "defaultValue": "LumineoProjectPlanning"},
                "Bc_Tenant": {"type": "String", "defaultValue": "fe0182fa-d183-46ab-8493-9e8ea9c3d0b8"},
                "Bc_Audience": {"type": "String", "defaultValue": "https://api.businesscentral.dynamics.com"},
                "Bc_ClientId": {"type": "String", "defaultValue": "<< Postman app registration client id >>"},
                "Bc_ClientSecret": {"type": "String", "defaultValue": "<< store in Key Vault / secure env var - do NOT commit >>"},
            },
            "triggers": {"When_a_push_row_is_added": {
                "type": "OpenApiConnectionWebhook",
                "inputs": {"parameters": {"subscriptionRequest/message": 4,
                                          "subscriptionRequest/entityname": "crfdf_bcpushqueue",
                                          "subscriptionRequest/scope": 4,
                                          "subscriptionRequest/filteringattributes": "crfdf_status"},
                           "host": {**DV_HOST, "operationId": "SubscribeWebhookTrigger"},
                           "authentication": "@parameters('$authentication')"},
                "runtimeConfiguration": {"concurrency": {"runs": 1}}}},
            "actions": {"Only_pending_step_rows": {
                "type": "If",
                "expression": {"and": [
                    {"equals": [f"@{T('status')}", "pending"]},
                    {"or": [{"equals": [f"@{T('kind')}", "schedule"]},
                            {"equals": [f"@{T('kind')}", "state"]}]},
                    {"not": {"equals": [f"@empty({T('planningstep')})", True]}}]},
                "runAfter": {},
                "actions": {
                    "Try": {"type": "Scope", "runAfter": {}, "actions": {
                        "Newer_Push": {"type": "OpenApiConnection", "runAfter": {}, "inputs": {
                            "parameters": {"entityName": "crfdf_bcpushqueues",
                                           "$select": "crfdf_bcpushqueueid",
                                           "$filter": newer_filter, "$top": 1},
                            "host": {**DV_HOST, "operationId": "ListRecords"}}},
                        "Is_Stale": {
                            "type": "If", "runAfter": {"Newer_Push": ["Succeeded"]},
                            "expression": {"greater": ["@length(body('Newer_Push')?['value'])", 0]},
                            "actions": {
                                "Mark_Superseded": {**dv_update("superseded", "a newer push for this step exists")},
                            },
                            "else": {"actions": apply_actions}},
                    }},
                    "Catch": {"type": "Scope", "runAfter": {"Try": ["Failed", "TimedOut"]}, "actions": {
                        "Mark_Failed": dv_update(
                            "failed",
                            "@concat('BC push failed: ', coalesce(body('Patch_Row')?['error']?['message'], "
                            "body('Create_Row')?['error']?['message'], body('Get_Job_Rows')?['error']?['message'], "
                            "'see run history'))")}},
                },
                "else": {"actions": {}}}},
        },
    },
    "schemaVersion": "1.0.0.0",
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(flow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", OUT)
