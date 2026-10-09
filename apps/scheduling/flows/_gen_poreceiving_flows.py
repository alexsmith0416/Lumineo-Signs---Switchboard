"""Generate BCPush_PoReceipts-clientdata.json and BCPush_PoDeliveries-clientdata.json.

Warehouse Management phase 3 (Oct 2026): the app's PO receiving is mirrored
into Business Central so the Purchase Order card and the Job Card show it
(bc/lumineo-planning-ext v1.0.0.18: tables 58420 "LUM PO Receipt" / 58421
"LUM PO Delivery", API pages 58422 poReceipts / 58423 poDeliveries).

Dataverse is the source of truth; BC only displays it. Each flow fires on a
Dataverse row change, re-reads the row (so a late run never writes an older
value) and upserts it in BC:

  BCPush_PoReceipts    crfdf_poreceipt added / modified  -> poReceipts('<PO>')
  BCPush_PoDeliveries  crfdf_podelivery added / modified -> poDeliveries(<id>)
                       crfdf_podelivery deleted          -> deleted in BC too

One run at a time per flow, so two quick edits of the same row land in order.
Nothing here posts a BC receipt or touches BC's purchase documents.

The expressions are quote-heavy, so the JSON is GENERATED - edit here:

    python _gen_poreceiving_flows.py

then build the solution with _build_poreceiving_solution.py. See
BCPush_PoReceiving.md.
"""
import json
import os

FLOWS = os.path.dirname(os.path.abspath(__file__))

DV = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "connectionName": "shared_commondataserviceforapps"}
AUTH = {"type": "ActiveDirectoryOAuth", "authority": "https://login.microsoftonline.com",
        "tenant": "@parameters('Bc_Tenant')", "audience": "@parameters('Bc_Audience')",
        "clientId": "@parameters('Bc_ClientId')", "secret": "@parameters('Bc_ClientSecret')"}
API = "@{parameters('Bc_ApiBase')}/lumineo/planning/v1.0/companies(@{parameters('Bc_CompanyId')})"
Q = "''''"      # WDL literal for one single quote
QQ = "''''''"   # WDL literal for two single quotes


def after(*names):
    return {n: ["Succeeded"] for n in names}


def dv(op, params, run_after=None):
    return {"type": "OpenApiConnection", "runAfter": run_after or {},
            "inputs": {"parameters": params, "host": {**DV, "operationId": op}}}


def http(method, uri, run_after, body=None, if_match=False):
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if if_match:
        headers["If-Match"] = "*"
    inputs = {"method": method, "uri": uri, "headers": headers, "authentication": AUTH}
    if body is not None:
        inputs["body"] = body
    return {"type": "Http", "runAfter": run_after, "inputs": inputs}


def lit(expr):
    """An OData string literal's contents, URL-encoded: ' -> '' then encode."""
    return f"@{{encodeUriComponent(replace({expr}, {Q}, {QQ}))}}"


def text(row, col, n):
    """A Dataverse text column, trimmed and cut to BC's field length."""
    return f"take(trim(coalesce({row}?['{col}'], '')), {n})"


def code(row, col):
    """A Dataverse text column for a BC Code[20] field (upper case, 20 chars)."""
    return f"toUpper({text(row, col, 20)})"


def trigger(entity, message):
    # message: 4 = added or modified, 7 = added, modified or deleted.
    return {"When_a_row_changes": {
        "type": "OpenApiConnectionWebhook",
        "inputs": {"parameters": {"subscriptionRequest/message": message,
                                  "subscriptionRequest/entityname": entity,
                                  "subscriptionRequest/scope": 4},
                   "host": {**DV, "operationId": "SubscribeWebhookTrigger"},
                   "authentication": "@parameters('$authentication')"},
        # One at a time: two quick edits of the same row can't race to POST.
        "runtimeConfiguration": {"concurrency": {"runs": 1}}}}


def flow_doc(comment, triggers, actions):
    return {
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
                "comment": comment,
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
                "triggers": triggers,
                "actions": actions,
            },
        },
        "schemaVersion": "1.0.0.0",
    }


def upsert(get_row, row, find_uri, key_uri, body_expr, post_body_expr):
    """Re-read the Dataverse row; if it's still there, PATCH or POST it in BC."""
    return {
        "Row_Still_There": {
            "type": "If", "runAfter": after(get_row),
            "expression": {"greater": [f"@length(body('{get_row}')?['value'])", 0]},
            "actions": {
                "Body": {"type": "Compose", "runAfter": {}, "inputs": f"@{body_expr}"},
                "Find_In_BC": http("GET", find_uri, after("Body")),
                "In_BC_Already": {
                    "type": "If", "runAfter": after("Find_In_BC"),
                    "expression": {"greater": ["@length(body('Find_In_BC')?['value'])", 0]},
                    "actions": {"Update_In_BC": http("PATCH", key_uri, {}, "@outputs('Body')", if_match=True)},
                    "else": {"actions": {"Add_To_BC": http("POST", find_uri.split("?")[0], {}, f"@{post_body_expr}")}},
                },
            },
            "else": {"actions": {}},
        },
    }


# --- BCPush_PoReceipts ------------------------------------------------------
R = "first(body('Get_Receipt')?['value'])"
R_ID = "triggerOutputs()?['body/crfdf_poreceiptid']"
R_PO = code(R, "crfdf_pono")
r_core = (f"addProperty(addProperty(addProperty(json('{{}}'), "
          f"'jobNo', {code(R, 'crfdf_jobno')}), "
          f"'vendorStatus', {text(R, 'crfdf_vendorstatus', 30)}), "
          f"'statusBy', {text(R, 'crfdf_statusby', 100)})")
# statusAt is ISO text in Dataverse; BC's DateTime takes it as is. Blank = not sent.
r_at = f"trim(coalesce({R}?['crfdf_statusat'], ''))"
r_body = f"if(empty({r_at}), {r_core}, addProperty({r_core}, 'statusAt', {r_at}))"

receipts_actions = {
    "Get_Receipt": dv("ListRecords", {
        "entityName": "crfdf_poreceipts",
        "$select": "crfdf_pono,crfdf_jobno,crfdf_vendorstatus,crfdf_statusby,crfdf_statusat",
        "$filter": f"crfdf_poreceiptid eq @{{{R_ID}}}"}),
    **upsert("Get_Receipt", R,
             f"{API}/poReceipts?$filter=@{{encodeUriComponent(concat('poNo eq ''', "
             f"replace({R_PO}, {Q}, {QQ}), {Q}))}}",
             f"{API}/poReceipts('{lit(R_PO)}')",
             r_body,
             f"addProperty(outputs('Body'), 'poNo', {R_PO})"),
}

receipts = flow_doc(
    "BCPush_PoReceipts - GENERATED by _gen_poreceiving_flows.py; edit that, not this. "
    "A PO's Vendor Status (crfdf_poreceipt) from the Switchboard app's Warehouse Management "
    "into BC (LUM PO Receipt, API poReceipts) for the Purchase Order card and Job Card. "
    "See BCPush_PoReceiving.md.",
    trigger("crfdf_poreceipt", 4),
    receipts_actions,
)

# --- BCPush_PoDeliveries ----------------------------------------------------
D = "first(body('Get_Delivery')?['value'])"
D_ID = "triggerOutputs()?['body/crfdf_podeliveryid']"
d_core = (f"addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(json('{{}}'), "
          f"'poNo', {code(D, 'crfdf_pono')}), "
          f"'receivedAt', {text(D, 'crfdf_site', 50)}), "
          f"'jobNo', {code(D, 'crfdf_jobno')}), "
          f"'storageLocation', {text(D, 'crfdf_location', 100)}), "
          f"'receivedBy', {text(D, 'crfdf_receivedby', 100)}), "
          f"'notes', {text(D, 'crfdf_notes', 250)}), "
          f"'final', equals({D}?['crfdf_final'], true))")
# The received date is YYYY-MM-DD text (no time zone shift). Blank = not sent.
d_date = f"take(trim(coalesce({D}?['crfdf_receiveddate'], '')), 10)"
d_body = f"if(empty({d_date}), {d_core}, addProperty({d_core}, 'dateReceived', {d_date}))"
by_id = f"{API}/poDeliveries?$filter=@{{encodeUriComponent(concat('id eq ', {D_ID}))}}"
one = f"{API}/poDeliveries(@{{{D_ID}}})"  # a Guid key literal is unquoted

deliveries_actions = {
    "Removed_In_The_App": {
        "type": "If", "runAfter": {},
        "expression": {"equals": ["@triggerOutputs()?['body/SdkMessage']", "Delete"]},
        "actions": {
            # Only delete what reached BC — a delivery removed before it was
            # ever pushed has nothing to delete (and a 404 would fail the run).
            "Find_Removed": http("GET", by_id, {}),
            "Was_In_BC": {
                "type": "If", "runAfter": after("Find_Removed"),
                "expression": {"greater": ["@length(body('Find_Removed')?['value'])", 0]},
                "actions": {"Delete_In_BC": http("DELETE", one, {}, if_match=True)},
                "else": {"actions": {}},
            },
        },
        "else": {"actions": {
            "Get_Delivery": dv("ListRecords", {
                "entityName": "crfdf_podeliveries",
                "$select": "crfdf_pono,crfdf_jobno,crfdf_receiveddate,crfdf_site,crfdf_location,crfdf_receivedby,crfdf_notes,crfdf_final",
                "$filter": f"crfdf_podeliveryid eq @{{{D_ID}}}"}),
            **upsert("Get_Delivery", D, by_id, one, d_body,
                     f"addProperty(outputs('Body'), 'id', {D_ID})"),
        }},
    },
}

deliveries = flow_doc(
    "BCPush_PoDeliveries - GENERATED by _gen_poreceiving_flows.py; edit that, not this. "
    "Deliveries received against POs (crfdf_podelivery) from the Switchboard app's Warehouse "
    "Management into BC (LUM PO Delivery, API poDeliveries) - added, edited and removed - for "
    "the Purchase Order card and Job Card. See BCPush_PoReceiving.md.",
    trigger("crfdf_podelivery", 7),
    deliveries_actions,
)

for name, doc in (("BCPush_PoReceipts", receipts), ("BCPush_PoDeliveries", deliveries)):
    out = os.path.join(FLOWS, f"{name}-clientdata.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", out)
