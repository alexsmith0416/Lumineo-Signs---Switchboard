<#
  Creates the Warehouse Management tables (Oct 8, 2026) — receiving for the
  purchase orders BCSync_JobPOs copies into crfdf_jobpo:

    crfdf_poreceipt   one row per PO — its Vendor Status, set by Admin / Ops
      crfdf_name          text  the PO no (primary name)
      crfdf_pono          text  BC purchase order no
      crfdf_jobno         text  BC job no ("" for a stock PO, later)
      crfdf_vendorstatus  text  Ordered / Shipping / Partially Received / Received /
                                Ready to Pick Up / Shipped / Artwork Approved / Delayed / On Hold
      crfdf_statusby      text  who set it
      crfdf_statusat      text  when (ISO)

    crfdf_podelivery  one row per delivery received against a PO
      crfdf_name          text  "<PO> · <date>"
      crfdf_pono          text  BC purchase order no
      crfdf_jobno         text  BC job no
      crfdf_receiveddate  text  YYYY-MM-DD (date-only text, no time zone shift)
      crfdf_location      text  storage location
      crfdf_receivedby    text  who received it
      crfdf_notes         memo  notes
      crfdf_final         bool  the last delivery (the PO is then Received)

  The app: src/services/po-receiving.ts, src/store/po-receiving-store.ts,
  src/components/warehouse/. Uses the Web API with a device-code token. Run it,
  open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Safe to re-run: existing tables / columns are skipped.
#>
$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

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

function New-Column($entity, $schema, $label, $maxLen) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    AttributeType     = 'String'; AttributeTypeName = @{ Value='StringType' }
    FormatName        = @{ Value='Text' }; MaxLength = $maxLen; SchemaName = $schema
    DisplayName       = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0}" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

function New-DecimalColumn($entity, $schema, $label) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    AttributeType = 'Decimal'; AttributeTypeName = @{ Value='DecimalType' }
    SchemaName    = $schema; Precision = 2; MinValue = 0; MaxValue = 100000000000
    DisplayName   = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} (decimal)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

function New-IntColumn($entity, $schema, $label) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
    AttributeType = 'Integer'; AttributeTypeName = @{ Value='IntegerType' }; Format = 'None'
    SchemaName    = $schema; MinValue = 0; MaxValue = 100000
    DisplayName   = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} (whole number)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

function New-MemoColumn($entity, $schema, $label, $maxLen) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    AttributeType = 'Memo'; AttributeTypeName = @{ Value='MemoType' }
    Format        = 'TextArea'; MaxLength = $maxLen; SchemaName = $schema
    DisplayName   = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} (multiline)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

function New-BoolColumn($entity, $schema, $label) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
    AttributeType = 'Boolean'; AttributeTypeName = @{ Value='BooleanType' }
    SchemaName    = $schema; DefaultValue = $false
    DisplayName   = (New-Label $label)
    OptionSet     = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
      TrueOption    = @{ Value = 1; Label = (New-Label 'Yes') }
      FalseOption   = @{ Value = 0; Label = (New-Label 'No') }
    }
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} (yes/no)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

Write-Host "PO receiving..." -ForegroundColor Cyan
New-Table 'crfdf_poreceipt' 'PO Receipt' 'PO Receipts'
New-Column 'crfdf_poreceipt' 'crfdf_PONo' 'PO No' 50
New-Column 'crfdf_poreceipt' 'crfdf_JobNo' 'Job No' 50
New-Column 'crfdf_poreceipt' 'crfdf_VendorStatus' 'Vendor Status' 100
New-Column 'crfdf_poreceipt' 'crfdf_StatusBy' 'Status By' 200
New-Column 'crfdf_poreceipt' 'crfdf_StatusAt' 'Status At' 50

Write-Host "PO deliveries..." -ForegroundColor Cyan
New-Table 'crfdf_podelivery' 'PO Delivery' 'PO Deliveries'
New-Column 'crfdf_podelivery' 'crfdf_PONo' 'PO No' 50
New-Column 'crfdf_podelivery' 'crfdf_JobNo' 'Job No' 50
New-Column 'crfdf_podelivery' 'crfdf_ReceivedDate' 'Received Date' 20
New-Column 'crfdf_podelivery' 'crfdf_Location' 'Storage Location' 200
New-Column 'crfdf_podelivery' 'crfdf_ReceivedBy' 'Received By' 200
New-MemoColumn 'crfdf_podelivery' 'crfdf_Notes' 'Notes' 4000
New-BoolColumn 'crfdf_podelivery' 'crfdf_Final' 'Final Delivery'

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan