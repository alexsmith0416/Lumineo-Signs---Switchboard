"""Assemble an importable UNMANAGED solution (BCSyncReview v1.0.0.2) containing the
five corrected BC sync flows. Run from the flows/ folder."""
import os, re, shutil, zipfile

FLOWS = os.path.dirname(os.path.abspath(__file__))
EXPORT_CUST = r"C:\Users\Alex\Downloads\_bcsync_extract\customizations.xml"
STAGE = r"C:\Users\Alex\Downloads\bcsync_build"
OUT_ZIP = r"C:\Users\Alex\Downloads\BCSyncReview_1_0_0_5.zip"

# Flow files (name -> (guid, filename))
FLOW_FILES = {
    "BCSync_Customers":        ("1050d559-be79-f111-ab0e-000d3a310eae", "BCSync_Customers-1050D559-BE79-F111-AB0E-000D3A310EAE.json"),
    "BCSync_Jobs":             ("07dde174-cd6d-f111-ab0d-000d3a5ad402", "BCSync_Jobs-07DDE174-CD6D-F111-AB0D-000D3A5AD402.json"),
    "BCSync_JobPlanningLines": ("c6ab42b7-cd6d-f111-ab0d-000d3a5ad402", "BCSync_JobPlanningLines-C6AB42B7-CD6D-F111-AB0D-000D3A5AD402.json"),
    "BCSync_SalesLines":       ("f316b615-ac72-f111-ab0d-000d3a5ad402", "BCSync_SalesLines-F316B615-AC72-F111-AB0D-000D3A5AD402.json"),
    "BCSync_BillingLines":     ("b17c5e00-0d11-4c00-9c00-0bc50a000001", "BCSync_BillingLines-B17C5E00-0D11-4C00-9C00-0BC50A000001.json"),
}

cust = open(EXPORT_CUST, encoding="utf-8").read()

# Reuse the four original <Workflow> metadata blocks verbatim.
orig_workflows = re.findall(r'<Workflow WorkflowId=.*?</Workflow>', cust, re.S)
by_name = {re.search(r'Name="([^"]+)"', w).group(1): w for w in orig_workflows}

# Build a <Workflow> block for the new billing flow, modelled on the Customers one.
billing_guid, billing_file = FLOW_FILES["BCSync_BillingLines"]
billing_block = f'''<Workflow WorkflowId="{{{billing_guid}}}" Name="BCSync_BillingLines" Description="Nightly sync of BC billable job planning lines into crfdf_bcbillinglines. Built by agent. #flowstudio-mcp">
      <JsonFileName>/Workflows/{billing_file}</JsonFileName>
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
        <LocalizedName languagecode="1033" description="BCSync_BillingLines" />
      </LocalizedNames>
      <Descriptions>
        <Description languagecode="1033" description="Nightly sync of BC billable job planning lines into crfdf_bcbillinglines. Built by agent. #flowstudio-mcp" />
      </Descriptions>
    </Workflow>'''

wf_blocks = [by_name["BCSync_Customers"], by_name["BCSync_Jobs"],
             by_name["BCSync_JobPlanningLines"], by_name["BCSync_SalesLines"], billing_block]
workflows_xml = "<Workflows>\n    " + "\n    ".join(wf_blocks) + "\n  </Workflows>"

# Connection references block (verbatim from export).
conn_xml = re.search(r'<connectionreferences>.*?</connectionreferences>', cust, re.S).group(0)

customizations = f'''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities />
  <Roles />
  {workflows_xml}
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

roots = "\n".join(
    f'      <RootComponent type="29" id="{{{FLOW_FILES[n][0]}}}" behavior="0" />'
    for n in ["BCSync_Jobs", "BCSync_Customers", "BCSync_JobPlanningLines", "BCSync_SalesLines", "BCSync_BillingLines"]
)
solution = f'''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.26061.153" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>BCSyncReview</UniqueName>
    <LocalizedNames>
      <LocalizedName description="BC Sync Review" languagecode="1033" />
    </LocalizedNames>
    <Descriptions />
    <Version>1.0.0.5</Version>
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

# Assemble staging dir
if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
os.makedirs(os.path.join(STAGE, "Workflows"))
open(os.path.join(STAGE, "solution.xml"), "w", encoding="utf-8").write(solution)
open(os.path.join(STAGE, "customizations.xml"), "w", encoding="utf-8").write(customizations)
open(os.path.join(STAGE, "[Content_Types].xml"), "w", encoding="utf-8").write(content_types)
for guid, fname in FLOW_FILES.values():
    shutil.copy(os.path.join(FLOWS, fname), os.path.join(STAGE, "Workflows", fname))

# Zip (store paths relative, forward slashes)
if os.path.exists(OUT_ZIP):
    os.remove(OUT_ZIP)
with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(STAGE):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, STAGE).replace("\\", "/")
            z.write(full, rel)
    # verify
print("Built", OUT_ZIP)
with zipfile.ZipFile(OUT_ZIP) as z:
    for n in z.namelist():
        print("  ", n)
