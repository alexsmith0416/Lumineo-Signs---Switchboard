<#
  Adds the columns the Installation cards need (crew, trips, install ZIP, job no)
  to the crfdf_installcard Dataverse table, via the Web API using a device-code
  token (az is blocked by the proxy; this uses raw Invoke-RestMethod).

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Safe to re-run: columns that already exist are skipped.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'   # Azure CLI public client (device-code capable)
$entity   = 'crfdf_installcard'

# --- Device-code auth ---------------------------------------------------------
$dc = Invoke-RestMethod -Method Post `
  -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }

Write-Host ""
Write-Host "==> $($dc.message)" -ForegroundColor Cyan
Write-Host ""

$token = $null
$deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $token -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try {
    $resp = Invoke-RestMethod -Method Post `
      -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{
        grant_type = 'urn:ietf:params:oauth:grant-type:device_code'
        client_id  = $clientId
        device_code = $dc.device_code
      }
    $token = $resp.access_token
  } catch {
    $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error
    if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw }
  }
}
if (-not $token) { throw "Device-code login timed out." }
Write-Host "Authenticated." -ForegroundColor Green

$headers = @{
  Authorization      = "Bearer $token"
  'Content-Type'     = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
}
$attrUri = "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes"

function New-Column($schema, $label, $kind, $maxLen) {
  $logical = $schema.ToLower()
  if ($kind -eq 'String') {
    $body = @{
      '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
      AttributeType     = 'String'
      AttributeTypeName = @{ Value = 'StringType' }
      SchemaName        = $schema
      MaxLength         = $maxLen
      DisplayName       = @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'; LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$label; LanguageCode=1033 }) }
    }
  } else {
    $body = @{
      '@odata.type'     = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
      AttributeType     = 'Integer'
      AttributeTypeName = @{ Value = 'IntegerType' }
      SchemaName        = $schema
      MinValue          = 0
      MaxValue          = 1000000
      DisplayName       = @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'; LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$label; LanguageCode=1033 }) }
    }
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + created {0}" -f $logical) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') {
      Write-Host ("  = {0} already exists, skipping" -f $logical) -ForegroundColor Yellow
    } else {
      Write-Host ("  ! {0} failed: {1}" -f $logical, $msg) -ForegroundColor Red
    }
  }
}

Write-Host "Adding columns to $entity ..." -ForegroundColor Cyan
New-Column 'crfdf_JobNo'       'Job No'        'String' 40
New-Column 'crfdf_InstallZip'  'Install ZIP'   'String' 20
New-Column 'crfdf_CrewPersons' 'Crew Persons'  'Integer' 0
New-Column 'crfdf_CrewTrucks'  'Crew Trucks'   'Integer' 0
New-Column 'crfdf_CrewTrips'   'Crew Trips'    'Integer' 0
New-Column 'crfdf_CrewCranes'  'Crew Cranes'   'Integer' 0
New-Column 'crfdf_CrewLifts'   'Crew Lifts'    'Integer' 0

# Publish so the columns are immediately live for the Code App.
try {
  Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (columns are usable regardless)." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
