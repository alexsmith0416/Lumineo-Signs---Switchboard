"""Assemble an importable UNMANAGED solution (BCReleaseDates v1.0.0.1) containing
the BCSync_JobReleaseDates flow — overlays crfdf_bcjobs.crfdf_releasedate from the
sign365 jobs entity (icgSgpOrderReleasedDate).

Self-contained. Reuses the SAME BC + Dataverse connection references the other
BCSync flows use (new_shareddynamicssmbsaas_69260 /
new_sharedcommondataserviceforapps_4a52d), so on import it binds to your existing
connections — no new connection to create.

Run from the flows/ folder:  python _build_releasedates_solution.py

After import: open the flow, confirm it's On. To switch UAT -> production later,
change the three Bc_* parameters (Environment / CompanyId / Dataset) — see
BC-ENVIRONMENT-SWITCH.md.
"""
import os, shutil, zipfile

FLOWS   = os.path.dirname(os.path.abspath(__file__))
STAGE   = r"C:\Users\Alex\Downloads\bcreleasedates_build"
OUT_ZIP = r"C:\Users\Alex\Downloads\BCReleaseDates_1_0_0_1.zip"

FLOW_NAME = "BCSync_JobReleaseDates"
FLOW_GUID = "b8319ff0-b0a5-4d38-8040-14a1876d7b62"
SRC_JSON  = "BCSync_JobReleaseDates-clientdata.json"
DEST_JSON = f"{FLOW_NAME}-{FLOW_GUID.upper()}.json"

workflow_block = f'''<Workflow WorkflowId="{{{FLOW_GUID}}}" Name="{FLOW_NAME}" Description="Overlays crfdf_bcjobs.crfdf_releasedate from the sign365 jobs entity. Built by agent.">
      <JsonFileName>/Workflows/{DEST_JSON}</JsonFileName>
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
      <StateCode>1</StateCode>
      <StatusCode>2</StatusCode>
      <RunAs>1</RunAs>
      <IsTransacted>1</IsTransacted>
      <IntroducedVersion>1.0</IntroducedVersion>
      <IsCustomizable>1</IsCustomizable>
      <BusinessProcessType>0</BusinessProcessType>
      <IsCustomProcessingStepAllowedForOtherPublishers>1</IsCustomProcessingStepAllowedForOtherPublishers>
      <ModernFlowType>0</ModernFlowType>
      <PrimaryEntity>none</PrimaryEntity>
      <LocalizedNames>
        <LocalizedName languagecode="1033" description="{FLOW_NAME}" />
      </LocalizedNames>
      <Descriptions>
        <Description languagecode="1033" description="Overlays crfdf_bcjobs.crfdf_releasedate from the sign365 jobs entity. Built by agent." />
      </Descriptions>
    </Workflow>'''

conn_xml = '''<connectionreferences>
    <connectionreference connectionreferencelogicalname="new_shareddynamicssmbsaas_69260">
      <connectionreferencedisplayname>Dynamics 365 Business Central</connectionreferencedisplayname>
      <connectorid>/providers/Microsoft.PowerApps/apis/shared_dynamicssmbsaas</connectorid>
      <iscustomizable>1</iscustomizable>
      <statecode>0</statecode>
      <statuscode>1</statuscode>
    </connectionreference>
    <connectionreference connectionreferencelogicalname="new_sharedcommondataserviceforapps_4a52d">
      <connectionreferencedisplayname>Microsoft Dataverse</connectionreferencedisplayname>
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
    {workflow_block}
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
    <UniqueName>BCReleaseDates</UniqueName>
    <LocalizedNames>
      <LocalizedName description="BC Release Dates" languagecode="1033" />
    </LocalizedNames>
    <Descriptions />
    <Version>1.0.0.1</Version>
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
      <RootComponent type="29" id="{{{FLOW_GUID}}}" behavior="0" />
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
'''

content_types = ('<?xml version="1.0" encoding="utf-8"?>'
                 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="xml" ContentType="application/octet-stream" />'
                 '<Default Extension="json" ContentType="application/octet-stream" /></Types>')

if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
os.makedirs(os.path.join(STAGE, "Workflows"))
open(os.path.join(STAGE, "solution.xml"), "w", encoding="utf-8").write(solution)
open(os.path.join(STAGE, "customizations.xml"), "w", encoding="utf-8").write(customizations)
open(os.path.join(STAGE, "[Content_Types].xml"), "w", encoding="utf-8").write(content_types)
shutil.copy(os.path.join(FLOWS, SRC_JSON), os.path.join(STAGE, "Workflows", DEST_JSON))

if os.path.exists(OUT_ZIP):
    os.remove(OUT_ZIP)
with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(STAGE):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, STAGE).replace("\\", "/")
            z.write(full, rel)

print("Built", OUT_ZIP)
with zipfile.ZipFile(OUT_ZIP) as z:
    for n in z.namelist():
        print("  ", n)
