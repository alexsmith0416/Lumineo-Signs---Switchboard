"""Generate BCSync_JobSketches-clientdata.json.

BCSync_JobSketches finds each job's sketch in its SharePoint folder and saves a
thumbnail of it for the Jobs list's Sketch column (crfdf_jobsketch).

Nightly (and on Run), for every open BC job whose SharePoint folder
(crfdf_bcjobs.crfdf_sharepointurl) is in the JobFiles site:
  1. lists the files in the job's folder AND its subfolders (SharePoint REST
     RenderListDataAsStream, Scope=RecursiveAll), newest first;
  2. picks the sketch: the file chosen / uploaded in the app (crfdf_pinned), while
     it still exists; else the newest PDF whose name starts with the job number
     ("J38740 YMCA_Wall Sign.pdf", "J39151-SECURITY 1ST TITLE(HUTCHINSON).pdf")
     - else the newest image (jpg / png / ...) in the folder - else none;
  3. when the pick is new or changed, fetches a thumbnail of it from SharePoint
     (the v2.0 drive thumbnails API, by the file's path in the library, renders
     page 1 of a PDF) and saves the
     file's link, name and the thumbnail (a data: URL) to crfdf_jobsketch; a job
     whose sketch disappeared has its row removed.
An unchanged sketch costs no thumbnail call, so re-runs are cheap.

The expressions are long and quote-heavy, so the JSON is GENERATED - edit here:

    python _gen_jobsketches_flow.py

then build with _build_jobsketches_solution.py. See BCSync_JobSketches.md.
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BCSync_JobSketches-clientdata.json")

DV = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "connectionName": "shared_commondataserviceforapps"}
SP = {"apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
      "connectionName": "shared_sharepointonline"}

JOB = "items('For_each_job')"
JOBNO = f"trim({JOB}?['crfdf_jobnumber'])"
FOLDER_URL = f"trim({JOB}?['crfdf_sharepointurl'])"


def after(*names, status=("Succeeded",)):
    return {n: list(status) for n in names}


def dv(op, params, run_after=None, paginate=False):
    a = {"type": "OpenApiConnection", "runAfter": run_after or {},
         "inputs": {"parameters": params, "host": {**DV, "operationId": op}}}
    if paginate:
        a["runtimeConfiguration"] = {"paginationPolicy": {"minimumItemCount": 5000}}
    return a


def sp_http(method, uri, body=None, run_after=None):
    params = {"dataset": "@parameters('Sp_Site')", "parameters/method": method, "parameters/uri": uri,
              "parameters/headers": {"Accept": "application/json;odata=nometadata",
                                     "Content-Type": "application/json;odata=nometadata"}}
    if body is not None:
        params["parameters/body"] = body
    return {"type": "OpenApiConnection", "runAfter": run_after or {},
            "inputs": {"parameters": params, "host": {**SP, "operationId": "HttpRequest"}}}


# The file list, newest first, of the folder and everything under it.
VIEW_XML = ('<View Scope="RecursiveAll"><Query><Where><Eq><FieldRef Name="FSObjType"/>'
            '<Value Type="Integer">0</Value></Eq></Where><OrderBy><FieldRef Name="Modified" Ascending="FALSE"/>'
            '</OrderBy></Query><ViewFields><FieldRef Name="FileLeafRef"/><FieldRef Name="FileRef"/>'
            '<FieldRef Name="File_x0020_Type"/><FieldRef Name="Modified"/><FieldRef Name="UniqueId"/>'
            '</ViewFields><RowLimit>1000</RowLimit></View>')

PICK = "outputs('Pick_Sketch')"
EXISTING = "first(body('Existing_Sketch'))"
# The version a thumbnail was made from: the file's id + its last-modified.
# "v4" = thumbnail info + download; bump it to make every job's sketch redo.
VERSION = f"concat('v4|', {PICK}?['UniqueId'], '|', {PICK}?['Modified'])"
ORIGIN = "join(take(split(parameters('Sp_Site'), '/'), 3), '/')"
FILE_URL = (f"concat({ORIGIN}, replace(replace(replace({PICK}?['FileRef'], '%', '%25'), ' ', '%20'), '#', '%23'))")
# The file's path inside the library ("G/GREATER WICHITA YMCA/.../J38740 YMCA_Wall Sign.pdf"),
# addressed through the site's default drive (Shared Documents). RenderListDataAsStream
# doesn't return the file's drive-item link, so the path is how we reach it.
LIB_PATH = (f"substring({PICK}?['FileRef'], add(length(parameters('Sp_Library_Path')), 1))")
# The thumbnail, in two steps (tested Sep 30 on J38740):
#   1. Thumb_Info - v2.0 drive API, the file by its path in the default drive:
#      .../thumbnails/0/<size> returns {url, width, height}. (The ".../content"
#      form answers 302 -> a redirect the SharePoint action counts as a failure.)
#   2. Download_Thumbnail - plain HTTP GET of that short-lived, pre-signed url.
THUMB_INFO_URI = (f"concat('_api/v2.0/drive/root:/', replace(encodeUriComponent({LIB_PATH}), '%2F', '/'), "
                  "':/thumbnails/0/', parameters('Thumb_Size'))")
TRIES = ("Thumb_Info", "Download_Thumbnail")
THUMB_OK = ("and(equals(actions('Download_Thumbnail')?['status'], 'Succeeded'), "
            "not(empty(body('Download_Thumbnail')?['$content'])))")
# If it didn't work, why - saved as "error: ..." (never shown as a picture) so it
# can be read straight off the row.
_why = ", ' || ', ".join(
    f"'{a}=', coalesce(actions('{a}')?['status'], ''), ' ', "
    f"string(coalesce(actions('{a}')?['outputs']?['body'], actions('{a}')?['error'], ''))" for a in TRIES)
THUMB = (f"if({THUMB_OK}, concat('data:', coalesce(body('Download_Thumbnail')?['$content-type'], 'image/jpeg'), "
         f"';base64,', body('Download_Thumbnail')?['$content']), concat('error: ', take(concat({_why}), 3000)))")

SKETCH_FIELDS = {
    "item/crfdf_jobno": f"@{JOBNO}",
    "item/crfdf_name": f"@{JOBNO}",
    "item/crfdf_fileurl": f"@{FILE_URL}",
    "item/crfdf_filename": f"@{PICK}?['FileLeafRef']",
    # A file whose thumbnail couldn't be made is saved with a marker, so the
    # next run sees it as changed and tries again.
    "item/crfdf_fileversion": f"@if({THUMB_OK}, {VERSION}, concat({VERSION}, '|no-thumbnail'))",
    "item/crfdf_thumbnail": f"@{THUMB}",
}

per_job = {
    "Server_Relative_Folder": {
        "type": "Compose", "runAfter": {},
        # https://host/sites/JobFiles/Shared Documents/... -> /sites/JobFiles/Shared Documents/...
        "inputs": f"@concat('/', join(skip(split({FOLDER_URL}, '/'), 3), '/'))"},
    "List_Body": {
        "type": "Compose", "runAfter": after("Server_Relative_Folder"),
        "inputs": {"parameters": {"RenderOptions": 2,
                                  "FolderServerRelativeUrl": "@{outputs('Server_Relative_Folder')}",
                                  "ViewXml": VIEW_XML}}},
    "List_Files": sp_http(
        "POST",
        "@{concat('_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@a1=''', "
        "encodeUriComponent(parameters('Sp_Library_Path')), '''')}",
        body="@{outputs('List_Body')}", run_after=after("List_Body")),
    "Sketch_PDFs": {
        "type": "Query", "runAfter": after("List_Files"),
        "inputs": {"from": "@coalesce(body('List_Files')?['Row'], json('[]'))",
                   "where": (f"@and(equals(toLower(coalesce(item()?['File_x0020_Type'], '')), 'pdf'), "
                             f"startsWith(toLower(coalesce(item()?['FileLeafRef'], '')), toLower({JOBNO})))")}},
    "Images": {
        "type": "Query", "runAfter": after("List_Files"),
        "inputs": {"from": "@coalesce(body('List_Files')?['Row'], json('[]'))",
                   "where": ("@contains(createArray('jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'tif', 'tiff'), "
                             "toLower(coalesce(item()?['File_x0020_Type'], '')))")}},
    "Existing_Sketch": {
        "type": "Query", "runAfter": after("List_Files"),
        "inputs": {"from": "@body('List_Sketches')?['value']",
                   "where": f"@equals(trim(coalesce(item()?['crfdf_jobno'], '')), {JOBNO})"}},
    # A file someone chose (or uploaded) in the app wins while it still exists.
    "Pinned_File": {
        "type": "Query", "runAfter": after("Existing_Sketch"),
        "inputs": {"from": "@coalesce(body('List_Files')?['Row'], json('[]'))",
                   "where": ("@and(not(empty(coalesce(first(body('Existing_Sketch'))?['crfdf_pinned'], ''))), "
                             "equals(toLower(coalesce(item()?['FileRef'], '')), "
                             "toLower(coalesce(first(body('Existing_Sketch'))?['crfdf_pinned'], ''))))")}},
    "Pick_Sketch": {
        "type": "Compose", "runAfter": after("Sketch_PDFs", "Images", "Pinned_File"),
        "inputs": ("@if(greater(length(body('Pinned_File')), 0), first(body('Pinned_File')), "
                   "if(greater(length(body('Sketch_PDFs')), 0), first(body('Sketch_PDFs')), first(body('Images'))))")},
    "Has_Sketch": {
        "type": "If", "runAfter": after("Pick_Sketch"),
        "expression": {"not": {"equals": [f"@empty({PICK})", True]}},
        "actions": {
            "Sketch_Changed": {
                "type": "If", "runAfter": {},
                "expression": {"or": [
                    {"equals": [f"@empty({EXISTING})", True]},
                    {"not": {"equals": [f"@coalesce({EXISTING}?['crfdf_fileversion'], '')", f"@{VERSION}"]}}]},
                "actions": {
                    "Thumb_Info": sp_http("GET", f"@{{{THUMB_INFO_URI}}}"),
                    "Download_Thumbnail": {
                        "type": "Http", "runAfter": after("Thumb_Info"),
                        "inputs": {"method": "GET", "uri": "@body('Thumb_Info')?['url']"}},
                    "Save_Sketch": {
                        "type": "If",
                        # Save even when no thumbnail could be made - the
                        # column still links to the file.
                        "runAfter": {a: ["Succeeded", "Failed", "Skipped"] for a in TRIES},
                        "expression": {"equals": [f"@empty({EXISTING})", True]},
                        "actions": {"Create_Sketch": dv("CreateRecord", {"entityName": "crfdf_jobsketchs", **SKETCH_FIELDS})},
                        "else": {"actions": {"Update_Sketch": dv("UpdateOnlyRecord", {
                            "entityName": "crfdf_jobsketchs",
                            "recordId": f"@{EXISTING}?['crfdf_jobsketchid']", **SKETCH_FIELDS})}},
                    },
                },
                "else": {"actions": {}},
            },
        },
        "else": {"actions": {
            "Had_Sketch": {
                "type": "If", "runAfter": {},
                "expression": {"not": {"equals": [f"@empty({EXISTING})", True]}},
                "actions": {"Remove_Sketch": dv("DeleteRecord", {
                    "entityName": "crfdf_jobsketchs", "recordId": f"@{EXISTING}?['crfdf_jobsketchid']"})},
                "else": {"actions": {}},
            }}},
    },
}

jobs_filter = ("@{if(empty(parameters('Only_Job')), "
               "'crfdf_sharepointurl ne null and crfdf_status eq ''Open''', "
               "concat('crfdf_jobnumber eq ''', replace(parameters('Only_Job'), '''', ''''''), ''''))}")

actions = {
    "List_Jobs": dv("ListRecords", {
        "entityName": "crfdf_bcjobs", "$select": "crfdf_jobnumber,crfdf_sharepointurl", "$filter": jobs_filter},
        paginate=True),
    "List_Sketches": dv("ListRecords", {
        "entityName": "crfdf_jobsketchs", "$select": "crfdf_jobsketchid,crfdf_jobno,crfdf_fileversion,crfdf_pinned"},
        paginate=True),
    "Jobs_In_Site": {
        "type": "Query", "runAfter": after("List_Jobs", "List_Sketches"),
        # Only folders in the JobFiles site (a couple point at a personal OneDrive).
        "inputs": {"from": "@body('List_Jobs')?['value']",
                   "where": ("@startsWith(toLower(trim(coalesce(item()?['crfdf_sharepointurl'], ''))), "
                             "toLower(concat(parameters('Sp_Site'), '/')))")}},
    "For_each_job": {
        "type": "Foreach", "foreach": "@body('Jobs_In_Site')", "runAfter": after("Jobs_In_Site"),
        "runtimeConfiguration": {"concurrency": {"repetitions": 8}},
        # One job's folder failing (moved, renamed, no access) must not stop the rest.
        "actions": {"Try_Job": {"type": "Scope", "runAfter": {}, "actions": per_job}},
    },
}

flow = {
    "properties": {
        "connectionReferences": {
            "shared_commondataserviceforapps": {
                "api": {"name": "shared_commondataserviceforapps"},
                "connection": {"connectionReferenceLogicalName": "new_sharedcommondataserviceforapps_4a52d"},
                "runtimeSource": "embedded"},
            "shared_sharepointonline": {
                "api": {"name": "shared_sharepointonline"},
                "connection": {"connectionReferenceLogicalName": "lum_sharedsharepointonline_jobsketches"},
                "runtimeSource": "embedded"},
        },
        "definition": {
            "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
            "contentVersion": "1.0.0.0",
            "comment": ("BCSync_JobSketches - GENERATED by _gen_jobsketches_flow.py; edit that, not this. Finds each "
                        "open job's sketch in its SharePoint folder (newest PDF named with the job number, else the "
                        "newest image) and saves its link + a thumbnail to crfdf_jobsketch for the Jobs list Sketch "
                        "column. See BCSync_JobSketches.md."),
            "parameters": {
                "$authentication": {"defaultValue": {}, "type": "SecureObject"},
                "$connections": {"defaultValue": {}, "type": "Object"},
                "Sp_Site": {"type": "String", "defaultValue": "https://luminousneon.sharepoint.com/sites/JobFiles"},
                "Sp_Library_Path": {"type": "String", "defaultValue": "/sites/JobFiles/Shared Documents"},
                "Thumb_Size": {"type": "String", "defaultValue": "c320x240"},
                # Set to a job number to run for that job only (testing).
                "Only_Job": {"type": "String", "defaultValue": ""},
            },
            "triggers": {"Nightly": {
                "type": "Recurrence",
                "recurrence": {"frequency": "Day", "interval": 1, "timeZone": "Central Standard Time",
                               "schedule": {"hours": ["4"], "minutes": [30]}}}},
            "actions": actions,
        },
    },
    "schemaVersion": "1.0.0.0",
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(flow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", OUT)
