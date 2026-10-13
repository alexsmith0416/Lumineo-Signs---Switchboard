"""Assemble ONE importable UNMANAGED solution (BCCheckNow) with every BC pull
that the app's Check BC now button runs, plus BCSync_Scheduler (Oct 12, 2026):

    BCSync_NewOrders  BCSync_TaskCompletions  BCSync_JobDescriptions
    BCSync_JobPOs     BCSync_JobSketches      BCSync_Scheduler

Run the generators first (_gen_*_flow.py, _gen_sync_scheduler_flow.py). The
flows keep the SAME workflow ids as their own solutions (BCNewOrders,
BCTaskCompletions, ...), so importing this UPDATES the existing flows - no
copies. It reuses the existing connection references (BC, Dataverse and the
Job Sketches SharePoint one), so on import it binds to your connections.

Run from the flows/ folder:  python _build_syncnow_solution.py

THE SECRET NEVER LIVES IN THE REPO. Four flows call BC with the app
registration. Either set it just for the build:
    PowerShell:  $env:BC_CLIENT_SECRET="<secret>"; python _build_syncnow_solution.py
(it goes into the STAGED copy only, and the zip is written to Downloads -
outside the repo), or build without it and afterwards run
    scripts/copy-bc-secret-to-flows.ps1 -Targets BCSync_NewOrders,BCSync_TaskCompletions,BCSync_JobDescriptions,BCSync_JobPOs

Updated flows keep their On / Off state; BCSync_Scheduler imports OFF - turn it
on after the import (see CHECK-BC-NOW.md).
"""
import json
import os
import shutil
import zipfile

FLOWS   = os.path.dirname(os.path.abspath(__file__))
STAGE   = r"C:\Users\Alex\Downloads\bccheckbcnow_build"
VERSION = "1.0.0.1"
OUT_ZIP = rf"C:\Users\Alex\Downloads\BCCheckNow_{VERSION.replace('.', '_')}.zip"
BC_CLIENT_ID = "34a4de23-4db0-48d9-a941-285c9c2f9b5d"

# name, workflow id (the one its own solution used), description
FLOW_LIST = [
    ("BCSync_NewOrders", "5e0f3a52-6c1d-4b8e-9a47-2d8c0b7e41f6",
     "On each check request (BCSync_Scheduler every 15 min, or the app's Check BC now): adds jobs whose New "
     "Order This Week step is Started in BC Project Planning to the Jobs list and fills them in from BC."),
    ("BCSync_TaskCompletions", "075bd1ae-99dc-433a-bfb9-e99290edab9a",
     "On each check request (every 5 min, or Check BC now): the shop floor's Task complete ticks from BC job "
     "punches into crfdf_taskcompletion for the app to apply to the stepper and status."),
    ("BCSync_JobDescriptions", "d8b49661-ae47-4d70-ab6a-b585509d97ba",
     "On each check request (hourly, or Check BC now): each open job's Field / Production / Extended "
     "Description from BC into crfdf_jobdesc."),
    ("BCSync_JobPOs", "c7ef4e95-8313-4164-8374-dfbd8b6cf269",
     "On each check request (nightly, or Check BC now): each open job's purchase orders (open + archived) "
     "from BC into crfdf_jobpo."),
    ("BCSync_JobSketches", "50b2d0d0-2373-4c57-b756-2baaa335efda",
     "On each check request (nightly, or Check BC now): finds each open job's sketch in its SharePoint "
     "folder and saves its link and a thumbnail for the Jobs list Sketch column."),
    ("BCSync_Scheduler", "3f6d2a91-8b4e-4c27-9e15-7a0c5d3b8e42",
     "Every 5 minutes: asks the BC pulls that are due (task completions, new orders, descriptions, POs, "
     "sketches) to run."),
]


def workflow_xml(guid, name, desc, json_name):
    return f'''<Workflow WorkflowId="{{{guid}}}" Name="{name}" Description="{desc}">
      <JsonFileName>/Workflows/{json_name}</JsonFileName>
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
        <LocalizedName languagecode="1033" description="{name}" />
      </LocalizedNames>
      <Descriptions>
        <Description languagecode="1033" description="{desc}" />
      </Descriptions>
    </Workflow>'''


def json_name(name, guid):
    return f"{name}-{guid.upper()}.json"


workflows = "\n    ".join(workflow_xml(g, n, d, json_name(n, g)) for n, g, d in FLOW_LIST)
roots = "\n      ".join(f'<RootComponent type="29" id="{{{g}}}" behavior="0" />' for _, g, _ in FLOW_LIST)


def conn_ref(logical, display, connector):
    return f'''<connectionreference connectionreferencelogicalname="{logical}">
      <connectionreferencedisplayname>{display}</connectionreferencedisplayname>
      <connectorid>/providers/Microsoft.PowerApps/apis/{connector}</connectorid>
      <iscustomizable>1</iscustomizable>
      <statecode>0</statecode>
      <statuscode>1</statuscode>
    </connectionreference>'''


conn_xml = "<connectionreferences>\n    " + "\n    ".join([
    conn_ref("new_shareddynamicssmbsaas_69260", "Dynamics 365 Business Central", "shared_dynamicssmbsaas"),
    conn_ref("new_sharedcommondataserviceforapps_4a52d", "Microsoft Dataverse", "shared_commondataserviceforapps"),
    conn_ref("lum_sharedsharepointonline_jobsketches", "SharePoint (Job Sketches)", "shared_sharepointonline"),
]) + "\n  </connectionreferences>"

customizations = f'''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities />
  <Roles />
  <Workflows>
    {workflows}
  </Workflows>
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <EntityDataProviders />
  {conn_xml}
  <Languages>
    <Language>1033</Language>
  </Languages>
</ImportExportXml>
'''

solution = f'''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.26061.153" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>BCCheckNow</UniqueName>
    <LocalizedNames>
      <LocalizedName description="BC Check Now" languagecode="1033" />
    </LocalizedNames>
    <Descriptions />
    <Version>{VERSION}</Version>
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
      {roots}
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
'''

content_types = ('<?xml version="1.0" encoding="utf-8"?>'
                 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="xml" ContentType="application/octet-stream" />'
                 '<Default Extension="json" ContentType="application/octet-stream" /></Types>')

secret = os.environ.get("BC_CLIENT_SECRET") or None

if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
os.makedirs(os.path.join(STAGE, "Workflows"))
open(os.path.join(STAGE, "solution.xml"), "w", encoding="utf-8").write(solution)
open(os.path.join(STAGE, "customizations.xml"), "w", encoding="utf-8").write(customizations)
open(os.path.join(STAGE, "[Content_Types].xml"), "w", encoding="utf-8").write(content_types)
for name, guid, _ in FLOW_LIST:
    with open(os.path.join(FLOWS, f"{name}-clientdata.json"), encoding="utf-8") as fh:
        doc = json.load(fh)
    params = doc["properties"]["definition"]["parameters"]
    if "Bc_ClientId" in params:
        params["Bc_ClientId"]["defaultValue"] = BC_CLIENT_ID
    if secret and "Bc_ClientSecret" in params:
        params["Bc_ClientSecret"]["defaultValue"] = secret
    with open(os.path.join(STAGE, "Workflows", json_name(name, guid)), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)

if os.path.exists(OUT_ZIP):
    os.remove(OUT_ZIP)
with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(STAGE):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, STAGE).replace("\\", "/"))
shutil.rmtree(STAGE)  # the staged copy may hold the secret

print("Built", OUT_ZIP, "(secret injected)" if secret else
      "(secret NOT set - run scripts/copy-bc-secret-to-flows.ps1 after import)")
with zipfile.ZipFile(OUT_ZIP) as z:
    for n in z.namelist():
        print("  ", n)
