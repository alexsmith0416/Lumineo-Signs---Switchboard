<#
  Adds crfdf_jobtrack.crfdf_salesoverride (text): Sales initials changed in the
  Jobs list ("VB, NH"). The Sales column fills from the BC salesperson; an edit
  made in the app is kept here and wins over it. It is never written to BC, and
  clearing it in the app goes back to BC's value.

  Until it exists, changing Sales in the app fails to save (the rest works).

  Uses the Web API with a device-code token (az is blocked by the proxy).
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Safe to re-run: a column that already exists is skipped.
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

$def = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$org/api/data/v9.2/EntityDefinitions?`$select=LogicalName&`$filter=EntitySetName eq 'crfdf_jobtracks'"
$entity = $def.value[0].LogicalName
if (-not $entity) { throw "Could not resolve logical name for EntitySet 'crfdf_jobtracks'." }
Write-Host "Resolved crfdf_jobtracks -> $entity" -ForegroundColor DarkCyan

$body = @{
  '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
  AttributeType = 'String'; AttributeTypeName = @{ Value = 'StringType' }; FormatName = @{ Value = 'Text' }
  SchemaName = 'crfdf_SalesOverride'; MaxLength = 200
  DisplayName = @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'; LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label='Sales Override'; LanguageCode=1033 }) }
}
try {
  Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes" `
    -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
  Write-Host "  + created $entity.crfdf_salesoverride" -ForegroundColor Green
} catch {
  $msg = $_.ErrorDetails.Message
  if ($msg -match 'already exists' -or $msg -match 'duplicate') {
    Write-Host "  = crfdf_salesoverride already exists, skipping" -ForegroundColor Yellow
  } else { Write-Host "  ! crfdf_salesoverride failed: $msg" -ForegroundColor Red }
}

try {
  Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (the column is usable regardless)." -ForegroundColor Yellow }
