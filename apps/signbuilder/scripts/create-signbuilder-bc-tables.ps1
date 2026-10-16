<#
  BC link tables for the Sign Builder (same env and crfdf_ prefix as Switchboard):

    crfdf_bcopportunity — BC opportunities, copied by the BCSync_SBOpportunities
                          flow from the Sign Builder extension's API page
                          (api/lumineo/signbuilder/v1.0 opportunities). The app
                          picks a spec's opportunity from here.
    crfdf_sbdescpush    — Generate to Project outbox: the Production / Field
                          Description the app wants written to a BC project.
                          BCPush_SBDescriptions fires on a new row, PATCHes the
                          extension's jobDescriptions API page and writes
                          Status (pending -> synced / failed) + a message back.

  Jobs come from Switchboard's crfdf_bcjob, and BC's current descriptions from
  its crfdf_jobdesc - both already filled by Switchboard's flows.

  Device-code auth like the other scripts: run it, open the printed URL, enter
  the code, sign in as asmith@lumineosigns.com. Safe to re-run - tables and
  columns that exist are skipped. Afterwards add Read/Write on these tables to
  the non-admin role (with the other crfdf_sb* tables).
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

# --- Device-code auth ---------------------------------------------------------
$dc = Invoke-RestMethod -Method Post `
  -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }
Write-Host ""; Write-Host "==> $($dc.message)" -ForegroundColor Cyan; Write-Host ""

$token = $null
$deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $token -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try {
    $resp = Invoke-RestMethod -Method Post `
      -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type='urn:ietf:params:oauth:grant-type:device_code'; client_id=$clientId; device_code=$dc.device_code }
    $token = $resp.access_token
  } catch {
    $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error
    if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw }
  }
}
if (-not $token) { throw "Device-code login timed out." }
Write-Host "Authenticated." -ForegroundColor Green

$headers = @{ Authorization="Bearer $token"; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0'; Accept='application/json' }
$base = "$org/api/data/v9.2"

function New-Label($text) {
  @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'
     LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$text; LanguageCode=1033 }) }
}

function New-Table($schema, $displayName, $pluralName) {
  $logical = $schema.ToLower()
  try {
    Invoke-RestMethod -Method Get -Uri "$base/EntityDefinitions(LogicalName='$logical')" -Headers $headers | Out-Null
    Write-Host ("= table {0} already exists, skipping create" -f $logical) -ForegroundColor Yellow
    return
  } catch { }
  $body = @{
    '@odata.type'         = 'Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName            = $schema
    DisplayName           = (New-Label $displayName)
    DisplayCollectionName = (New-Label $pluralName)
    OwnershipType         = 'UserOwned'
    HasActivities         = $false
    HasNotes              = $false
    IsActivity            = $false
    Attributes            = @(
      @{
        '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        AttributeType     = 'String'; AttributeTypeName = @{ Value='StringType' }
        SchemaName        = 'crfdf_Name'; MaxLength = 300; IsPrimaryName = $true
        DisplayName       = (New-Label 'Name')
      }
    )
  }
  Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host ("+ created table {0}" -f $logical) -ForegroundColor Green
}

function Add-Attribute($entity, $schema, $body, $kind) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} ({1})" -f $schema.ToLower(), $kind) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

function New-Column($entity, $schema, $label, $maxLen) {
  Add-Attribute $entity $schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    AttributeType = 'String'; AttributeTypeName = @{ Value='StringType' }
    FormatName    = @{ Value='Text' }; MaxLength = $maxLen; SchemaName = $schema
    DisplayName   = (New-Label $label)
  } 'text'
}

function New-MemoColumn($entity, $schema, $label, $maxLen) {
  Add-Attribute $entity $schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    AttributeType = 'Memo'; AttributeTypeName = @{ Value='MemoType' }
    Format        = 'TextArea'; MaxLength = $maxLen; SchemaName = $schema
    DisplayName   = (New-Label $label)
  } 'multiline'
}

function New-IntColumn($entity, $schema, $label) {
  Add-Attribute $entity $schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
    AttributeType = 'Integer'; AttributeTypeName = @{ Value='IntegerType' }; Format = 'None'
    SchemaName    = $schema; MinValue = -2147483648; MaxValue = 2147483647
    DisplayName   = (New-Label $label)
  } 'whole number'
}

function New-BoolColumn($entity, $schema, $label) {
  Add-Attribute $entity $schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
    AttributeType = 'Boolean'; AttributeTypeName = @{ Value='BooleanType' }
    SchemaName    = $schema; DefaultValue = $false
    DisplayName   = (New-Label $label)
    OptionSet     = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
      TrueOption  = @{ Value = 1; Label = (New-Label 'Yes') }
      FalseOption = @{ Value = 0; Label = (New-Label 'No') }
    }
  } 'yes/no'
}

# ~1 MB — the largest multiline Dataverse allows (setup documents, images).
$big = 1048576

Write-Host "BC opportunities…" -ForegroundColor Cyan
New-Table 'crfdf_BcOpportunity' 'BC Opportunity' 'BC Opportunities'
New-Column 'crfdf_bcopportunity' 'crfdf_OpportunityNo' 'Opportunity No.' 20
New-Column 'crfdf_bcopportunity' 'crfdf_Description' 'Description' 300
New-Column 'crfdf_bcopportunity' 'crfdf_ContactNo' 'Contact No.' 20
New-Column 'crfdf_bcopportunity' 'crfdf_ContactName' 'Contact Name' 200
New-Column 'crfdf_bcopportunity' 'crfdf_CompanyName' 'Company Name' 200
New-Column 'crfdf_bcopportunity' 'crfdf_SalespersonCode' 'Salesperson Code' 20
New-Column 'crfdf_bcopportunity' 'crfdf_Status' 'Status' 30
New-BoolColumn 'crfdf_bcopportunity' 'crfdf_Closed' 'Closed'
New-Column 'crfdf_bcopportunity' 'crfdf_CreationDate' 'Creation Date' 20
New-Column 'crfdf_bcopportunity' 'crfdf_ProjectNo' 'Project No.' 20
New-Column 'crfdf_bcopportunity' 'crfdf_BcModified' 'BC Last Modified' 40

Write-Host "Description outbox…" -ForegroundColor Cyan
New-Table 'crfdf_SbDescPush' 'Sign Builder Description Push' 'Sign Builder Description Pushes'
New-Column 'crfdf_sbdescpush' 'crfdf_JobNo' 'Job No.' 20
New-Column 'crfdf_sbdescpush' 'crfdf_SpecId' 'Spec Id' 40
New-BoolColumn 'crfdf_sbdescpush' 'crfdf_SendProduction' 'Send Production Description'
New-BoolColumn 'crfdf_sbdescpush' 'crfdf_SendField' 'Send Field Description'
New-MemoColumn 'crfdf_sbdescpush' 'crfdf_ProductionDesc' 'Production Description' 200000
New-MemoColumn 'crfdf_sbdescpush' 'crfdf_FieldDesc' 'Field Description' 200000
New-Column 'crfdf_sbdescpush' 'crfdf_Status' 'Status' 20
New-Column 'crfdf_sbdescpush' 'crfdf_StatusMessage' 'Status Message' 2000
New-Column 'crfdf_sbdescpush' 'crfdf_RequestedBy' 'Requested By' 200

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

# Read-only check: the entity set names services/repo.ts uses.
foreach ($t in 'crfdf_bcopportunity','crfdf_sbdescpush') {
  $set = (Invoke-RestMethod -Headers $headers -Uri "$base/EntityDefinitions(LogicalName='$t')?`$select=EntitySetName").EntitySetName
  Write-Host ("  {0} -> {1}" -f $t, $set)
}

Write-Host "Done." -ForegroundColor Cyan
