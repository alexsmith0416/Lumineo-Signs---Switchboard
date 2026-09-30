<#
  Jobs list, stage 1 — adds two columns:
    crfdf_bcjob.crfdf_salesorderamount  (decimal) the job's Sales Order amount
        (total excl. tax), written nightly by BCSync_SalesLines once
        patch-saleslines-flow-order.ps1 has run. The Jobs "Value" column.
    crfdf_jobtrack.crfdf_jobname         (text)    a manual job name that
        overrides the default (the BC ship-to customer name).

  Uses the Web API with a device-code token (az is blocked by the proxy).
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Safe to re-run: a column that already exists is skipped. Run this BEFORE
  patch-saleslines-flow-order.ps1.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'   # Azure CLI public client (device-code capable)

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

$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }

function Get-LogicalName($entitySet) {
  $def = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$org/api/data/v9.2/EntityDefinitions?`$select=LogicalName&`$filter=EntitySetName eq '$entitySet'"
  $name = $def.value[0].LogicalName
  if (-not $name) { throw "Could not resolve logical name for EntitySet '$entitySet'." }
  Write-Host "Resolved $entitySet -> $name" -ForegroundColor DarkCyan
  $name
}

function New-Label($text) {
  @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'; LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$text; LanguageCode=1033 }) }
}

function Add-Column($entity, $body) {
  $logical = $body.SchemaName.ToLower()
  try {
    Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes" `
      -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + created {0}.{1}" -f $entity, $logical) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') {
      Write-Host ("  = {0}.{1} already exists, skipping" -f $entity, $logical) -ForegroundColor Yellow
    } else { Write-Host ("  ! {0}.{1} failed: {2}" -f $entity, $logical, $msg) -ForegroundColor Red }
  }
}

$bcjob = Get-LogicalName 'crfdf_bcjobs'
Add-Column $bcjob @{
  '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
  AttributeType = 'Decimal'; AttributeTypeName = @{ Value = 'DecimalType' }
  SchemaName = 'crfdf_SalesOrderAmount'; DisplayName = (New-Label 'Sales Order Amount')
  Precision = 2; MinValue = -100000000000; MaxValue = 100000000000
}

$track = Get-LogicalName 'crfdf_jobtracks'
Add-Column $track @{
  '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
  AttributeType = 'String'; AttributeTypeName = @{ Value = 'StringType' }; FormatName = @{ Value = 'Text' }
  SchemaName = 'crfdf_JobName'; DisplayName = (New-Label 'Job Name'); MaxLength = 300
}

try {
  Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (columns are usable regardless)." -ForegroundColor Yellow }
Write-Host "Next: run scripts/patch-saleslines-flow-order.ps1" -ForegroundColor Cyan
