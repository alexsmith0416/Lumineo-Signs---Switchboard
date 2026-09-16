"""Assemble an importable UNMANAGED solution (BCPushReview) containing the
app->BC write-back flows that drain the crfdf_bcpushqueue outbox.

Flows in this solution
----------------------
  BCPush_PlanningSteps  - PATCHes sign365 projectPlanningEntries with a step's
                          start/end/assignee. STILL BLOCKED: that entity is
                          read-only and has no addressable row. Ships in the
                          solution but must stay OFF. See BCPush-infotech-request.md.
  BCPush_JobCompletion  - PATCHes jobs('<jobNo>') with {complete,
                          icgSgpCompletionDate} when the production stepper's
                          last department closes. WORKS TODAY (write verified
                          Sep 14, 2026). See BCPush_JobCompletion.md.

Self-contained (unlike _build_solution.py it doesn't reuse an export): it authors
the <Workflow> metadata + a single shared Dataverse <connectionreference> inline.
There is NO unpacked solution kept in the repo - this script IS the source of
truth, and it wipes its staging folder on every run, so don't hand-edit the
staged/unpacked copy.

Run from the flows/ folder:  python _build_pushflow_solution.py

THE SECRET NEVER LIVES IN THE REPO. Set it in the environment just for the build:
    PowerShell:  $env:BC_CLIENT_SECRET="<secret>"; python _build_pushflow_solution.py
    bash:        BC_CLIENT_SECRET="<secret>" python _build_pushflow_solution.py
It is injected into the STAGED copy of each flow only. The output zip is written
to Downloads - outside the repo - so a secret-bearing zip can't be committed.
Without the env var the build still succeeds and leaves the placeholder; you then
fill the secret in the flow editor after import.

Better still (no secret in a zip at all): see "Key Vault option" in
BCPush_JobCompletion.md.

On import (maker portal -> Solutions -> Import solution):
  - map the one connection reference to your Dataverse connection
  - BCPush_JobCompletion imports ON; BCPush_PlanningSteps imports OFF
    (IMPORT_OFF) - leave it off
"""
import json
import os
import shutil
import subprocess
import zipfile
from xml.sax.saxutils import escape

FLOWS   = os.path.dirname(os.path.abspath(__file__))
STAGE   = r"C:\Users\Alex\Downloads\bcpush_build"
OUT_ZIP = r"C:\Users\Alex\Downloads\BCPushReview_1_0_0_2.zip"

SOLUTION_VERSION = "1.0.0.2"
CONNREF_NAME     = "new_sharedcommondataserviceforapps_bcpush"
BC_CLIENT_ID     = "34a4de23-4db0-48d9-a941-285c9c2f9b5d"

# (flow name, workflow GUID, source json, description)
FLOW_DEFS = [
    (
        "BCPush_PlanningSteps",
        "0c5c184d-9e8c-4b0c-a781-56954c629083",
        "BCPush_PlanningSteps-clientdata.json",
        "Drains crfdf_bcpushqueue (kind=schedule/completion) and PATCHes the sign365 "
        "projectPlanningEntries API. BLOCKED - keep this flow OFF.",
    ),
    (
        "BCPush_JobCompletion",
        "30905c4a-f9b4-4424-91e6-b0046a3216b4",
        "BCPush_JobCompletion-clientdata.json",
        "Drains crfdf_bcpushqueue (kind=job) and PATCHes jobs('<jobNo>') with "
        "complete + icgSgpCompletionDate when the production stepper's last "
        "department closes.",
    ),
]


# Flows that must import switched OFF. A solution import activates any flow whose
# <StateCode> is 1, and BCPush_PlanningSteps would then fire on every new
# schedule/completion outbox row and mark it failed (its BC entity is read-only).
IMPORT_OFF = {"BCPush_PlanningSteps"}


def dest_json(name: str, guid: str) -> str:
    """Packager convention: <FlowName>-<UPPERCASE-GUID>.json"""
    return f"{name}-{guid.upper()}.json"


def xa(s: str) -> str:
    """Escape a string for use inside a double-quoted XML attribute.

    Descriptions mention things like jobs('<jobNo>'); an unescaped '<' makes
    `pac solution pack` reject Customizations.xml outright.
    """
    return escape(s, {'"': "&quot;"})


def workflow_block(name: str, guid: str, src: str, desc: str) -> str:
    # StateCode 1/StatusCode 2 = Activated; 0/1 = Draft (off).
    state, status = (0, 1) if name in IMPORT_OFF else (1, 2)
    name, desc = xa(name), xa(desc)
    return f'''<Workflow WorkflowId="{{{guid}}}" Name="{name}" Description="{desc}">
      <JsonFileName>/Workflows/{dest_json(name, guid)}</JsonFileName>
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
      <StateCode>{state}</StateCode>
      <StatusCode>{status}</StatusCode>
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


def stage_flow_json(src: str, dest_path: str, secret: str | None) -> list[str]:
    """Copy a flow definition into staging, filling Bc_ClientId and - only when
    BC_CLIENT_SECRET is set - Bc_ClientSecret. Returns notes for the build log.

    Edits the STAGED copy via JSON (not string replace), so it works regardless
    of what placeholder text the committed file carries.
    """
    notes: list[str] = []
    with open(os.path.join(FLOWS, src), encoding="utf-8") as fh:
        doc = json.load(fh)
    # The importer rejects a flow without these ("Flow clientdata is in invalid
    # format ... Required property 'schemaVersion' not found") - fail the build
    # here instead of at import time.
    missing = [k for k in ("schemaVersion", "properties") if k not in doc]
    if missing:
        raise SystemExit(f"{src}: missing required top-level key(s) {missing}")
    # A Dataverse row trigger (SubscribeWebhookTrigger) must be typed
    # OpenApiConnectionWebhook. Typed OpenApiConnection it imports, but turning
    # it on fails: "The 'recurrence' property of template trigger ... is not
    # defined" - the engine treats it as a polling trigger.
    for tname, trg in doc["properties"]["definition"]["triggers"].items():
        op = trg.get("inputs", {}).get("host", {}).get("operationId")
        if op == "SubscribeWebhookTrigger" and trg.get("type") != "OpenApiConnectionWebhook":
            raise SystemExit(f"{src}: trigger {tname} must be type OpenApiConnectionWebhook")
    params = doc["properties"]["definition"]["parameters"]

    if "Bc_ClientId" in params:
        if params["Bc_ClientId"].get("defaultValue", "").startswith("<<"):
            params["Bc_ClientId"]["defaultValue"] = BC_CLIENT_ID
            notes.append("client id filled")
        else:
            notes.append("client id already set")

    if "Bc_ClientSecret" in params:
        if secret:
            params["Bc_ClientSecret"]["defaultValue"] = secret
            notes.append("SECRET INJECTED (staged copy only)")
        else:
            notes.append("secret left as placeholder - fill it after import")

    with open(dest_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)
    return notes


workflows_xml = "\n    ".join(workflow_block(*f) for f in FLOW_DEFS)
root_components = "\n      ".join(
    f'<RootComponent type="29" id="{{{guid}}}" behavior="0" />' for _, guid, _, _ in FLOW_DEFS
)

conn_xml = f'''<connectionreferences>
    <connectionreference connectionreferencelogicalname="{CONNREF_NAME}">
      <connectionreferencedisplayname>Microsoft Dataverse (BC Push)</connectionreferencedisplayname>
      <connectorid>/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps</connectorid>
      <iscustomizable>1</iscustomizable>
      <statecode>0</statecode>
      <statuscode>1</statuscode>
    </connectionreference>
  </connectionreferences>'''

customizations = f'''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities />
  <Roles />
  <Workflows>
    {workflows_xml}
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
    <UniqueName>BCPushReview</UniqueName>
    <LocalizedNames>
      <LocalizedName description="BC Push Review" languagecode="1033" />
    </LocalizedNames>
    <Descriptions />
    <Version>{SOLUTION_VERSION}</Version>
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
      {root_components}
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

# STAGE is the pac UNPACKED-SOURCE layout (Other/Solution.xml,
# Other/Customizations.xml, Workflows/) - NOT the flat layout found inside a
# solution zip. `pac solution pack` reads this shape, and `pac solution unpack`
# writes it, so STAGE round-trips with the CLI.
if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
os.makedirs(os.path.join(STAGE, "Workflows"))
os.makedirs(os.path.join(STAGE, "Other"))
open(os.path.join(STAGE, "Other", "Solution.xml"), "w", encoding="utf-8").write(solution)
open(os.path.join(STAGE, "Other", "Customizations.xml"), "w", encoding="utf-8").write(customizations)
# pac wants a Relationships.xml even when there are none.
open(os.path.join(STAGE, "Other", "Relationships.xml"), "w", encoding="utf-8").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<EntityRelationships />\n'
)

for name, guid, src, _ in FLOW_DEFS:
    out = os.path.join(STAGE, "Workflows", dest_json(name, guid))
    notes = stage_flow_json(src, out, secret)
    print(f"  staged {dest_json(name, guid)}  ({'; '.join(notes)})")

if os.path.exists(OUT_ZIP):
    os.remove(OUT_ZIP)

# Prefer `pac solution pack` (it validates the structure); fall back to a plain
# flat zip, which is how this solution was built and imported before pac was in
# the loop. The flat layout differs from STAGE - hence the separate staging dir.
packed_with = "pac solution pack"
try:
    proc = subprocess.run(
        ["pac", "solution", "pack", "--zipfile", OUT_ZIP, "--folder", STAGE,
         "--packagetype", "Unmanaged"],
        capture_output=True, text=True, shell=True,
    )
    if proc.returncode != 0 or not os.path.exists(OUT_ZIP):
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "pac pack failed")
except Exception as e:  # noqa: BLE001 - any pac problem falls back to the proven path
    print(f"  ! pac solution pack unavailable/failed ({e});\n    falling back to flat zip")
    packed_with = "zipfile fallback"
    flat = STAGE + "_flat"
    if os.path.exists(flat):
        shutil.rmtree(flat)
    os.makedirs(os.path.join(flat, "Workflows"))
    open(os.path.join(flat, "solution.xml"), "w", encoding="utf-8").write(solution)
    open(os.path.join(flat, "customizations.xml"), "w", encoding="utf-8").write(customizations)
    open(os.path.join(flat, "[Content_Types].xml"), "w", encoding="utf-8").write(content_types)
    for name, guid, src, _ in FLOW_DEFS:
        stage_flow_json(src, os.path.join(flat, "Workflows", dest_json(name, guid)), secret)
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(flat):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, flat).replace("\\", "/")
                z.write(full, rel)

print(f"\nBuilt {OUT_ZIP}  (via {packed_with})")
with zipfile.ZipFile(OUT_ZIP) as z:
    for n in z.namelist():
        print("  ", n)
if not secret:
    print("\n  NOTE: BC_CLIENT_SECRET was not set - Bc_ClientSecret is still a")
    print("        placeholder. Fill it in the flow editor after import, or")
    print("        re-run with the env var set.")
