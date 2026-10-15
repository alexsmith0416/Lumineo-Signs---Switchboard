<#
  Creates the Sign Builder tables in Alex Smith's Environment (same env and
  crfdf_ prefix as Switchboard):

    crfdf_sbsetupdoc  — the setup as JSON documents: "core" (sections,
                        categories, settings, checklist, vinyl colors) and one
                        "type:<CODE>" per sign type / question block (its
                        questions, answers, Spec Rules, templates, reference
                        rules, blocks used)
    crfdf_sbreference — spec reference pages with their images (data: URIs),
                        read only when a page is viewed
    crfdf_sbversion   — setup versions and undo steps (copies of documents)
    crfdf_sbproject   — projects (a group of specs)
    crfdf_sbspec      — a spec (one per opportunity / job, or walk-in)
    crfdf_sbsignline  — one sign of a spec, with its answers as JSON

  Device-code auth like the other scripts: run it, open the printed URL, enter
  the code, sign in as asmith@lumineosigns.com. Safe to re-run — tables and
  columns that exist are skipped. Afterwards add Read/Write on these tables to
  the non-admin role (apps/scheduling/scripts/create-scheduler-user-role.ps1 pattern).
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

Write-Host "Setup documents…" -ForegroundColor Cyan
New-Table 'crfdf_SbSetupDoc' 'Sign Builder Setup Document' 'Sign Builder Setup Documents'
New-Column 'crfdf_sbsetupdoc' 'crfdf_Kind' 'Kind' 40
New-MemoColumn 'crfdf_sbsetupdoc' 'crfdf_Json' 'JSON' $big

Write-Host "Spec reference pages…" -ForegroundColor Cyan
New-Table 'crfdf_SbReference' 'Sign Builder Spec Reference' 'Sign Builder Spec References'
New-Column 'crfdf_sbreference' 'crfdf_Description' 'Description' 200
New-Column 'crfdf_sbreference' 'crfdf_FileName' 'File Name' 200
New-Column 'crfdf_sbreference' 'crfdf_SharePointUrl' 'SharePoint URL' 2000
New-MemoColumn 'crfdf_sbreference' 'crfdf_Thumbnail' 'Thumbnail' $big
New-MemoColumn 'crfdf_sbreference' 'crfdf_FullImage' 'Full Image' $big

Write-Host "Setup versions…" -ForegroundColor Cyan
New-Table 'crfdf_SbVersion' 'Sign Builder Setup Version' 'Sign Builder Setup Versions'
New-Column 'crfdf_sbversion' 'crfdf_Scope' 'Scope' 100
New-IntColumn 'crfdf_sbversion' 'crfdf_Kind' 'Kind'
New-MemoColumn 'crfdf_sbversion' 'crfdf_Json' 'JSON' $big
New-Column 'crfdf_sbversion' 'crfdf_CreatedByName' 'Created By' 200

Write-Host "Projects…" -ForegroundColor Cyan
New-Table 'crfdf_SbProject' 'Sign Builder Project' 'Sign Builder Projects'
New-Column 'crfdf_sbproject' 'crfdf_CustomerName' 'Customer' 200
New-MemoColumn 'crfdf_sbproject' 'crfdf_Notes' 'Notes' 4000

Write-Host "Specs…" -ForegroundColor Cyan
New-Table 'crfdf_SbSpec' 'Sign Builder Spec' 'Sign Builder Specs'
New-Column 'crfdf_sbspec' 'crfdf_Description' 'Description' 300
New-IntColumn 'crfdf_sbspec' 'crfdf_Purpose' 'Purpose'
New-IntColumn 'crfdf_sbspec' 'crfdf_Status' 'Status'
New-IntColumn 'crfdf_sbspec' 'crfdf_DetailLevel' 'Detail Level'
New-Column 'crfdf_sbspec' 'crfdf_OpportunityNo' 'Opportunity No.' 20
New-Column 'crfdf_sbspec' 'crfdf_JobNo' 'Job No.' 20
New-Column 'crfdf_sbspec' 'crfdf_ProjectId' 'Project Id' 40
New-Column 'crfdf_sbspec' 'crfdf_CustomerNo' 'Customer No.' 20
New-Column 'crfdf_sbspec' 'crfdf_CustomerName' 'Customer Name' 200
New-Column 'crfdf_sbspec' 'crfdf_ContactName' 'Contact Name' 200
New-Column 'crfdf_sbspec' 'crfdf_DesignReference' 'Design Reference' 200
New-MemoColumn 'crfdf_sbspec' 'crfdf_JobDetailNotes' 'Job Detail Notes' 4000
New-Column 'crfdf_sbspec' 'crfdf_CreatedByName' 'Created By' 200
New-Column 'crfdf_sbspec' 'crfdf_LastGeneratedAt' 'Last Generated At' 40
New-Column 'crfdf_sbspec' 'crfdf_ApprovedBy' 'Approved By' 200
New-Column 'crfdf_sbspec' 'crfdf_ApprovedAt' 'Approved At' 40

Write-Host "Sign lines…" -ForegroundColor Cyan
New-Table 'crfdf_SbSignLine' 'Sign Builder Sign' 'Sign Builder Signs'
New-Column 'crfdf_sbsignline' 'crfdf_SpecId' 'Spec Id' 40
New-IntColumn 'crfdf_sbsignline' 'crfdf_LineNo' 'Line No.'
New-Column 'crfdf_sbsignline' 'crfdf_CategoryCode' 'Category' 20
New-Column 'crfdf_sbsignline' 'crfdf_SignTypeCode' 'Sign Type' 20
New-IntColumn 'crfdf_sbsignline' 'crfdf_Quantity' 'Quantity'
New-MemoColumn 'crfdf_sbsignline' 'crfdf_Answers' 'Answers' 200000
New-Column 'crfdf_sbsignline' 'crfdf_SpecCode' 'Spec Code' 100
New-Column 'crfdf_sbsignline' 'crfdf_SpecReferenceCode' 'Spec Reference' 20
New-BoolColumn 'crfdf_sbsignline' 'crfdf_TypeDecided' 'Type Decided'
New-IntColumn 'crfdf_sbsignline' 'crfdf_CompletedPct' 'Completed %'

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
