<#
  Adds a Yes/No column to crfdf_installcard:

    crfdf_finalinstall (Boolean) - marks an install card as the job's FINAL
                                   install. Its day sets the job's scheduled
                                   install date (unless a Red date locks it).

  Uses the Web API with a device-code token. Run it, open the printed URL, enter
  the code, sign in as asmith@lumineosigns.com. Safe to re-run (existing skipped).
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$entitySet = 'crfdf_installcards'

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

$def = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$org/api/data/v9.2/EntityDefinitions?`$select=LogicalName&`$filter=EntitySetName eq '$entitySet'"
$entity = $def.value[0].LogicalName
if (-not $entity) { throw "Could not resolve logical name for '$entitySet'." }
Write-Host "Resolved $entitySet -> $entity" -ForegroundColor DarkCyan
$attrUri = "$org/api/data/v9.2/EntityDefinitions(LogicalName='$entity')/Attributes"

function New-Label($text) {
  @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'
     LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$text; LanguageCode=1033 }) }
}

$body = @{
  '@odata.type'     = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
  AttributeType     = 'Boolean'
  AttributeTypeName = @{ Value = 'BooleanType' }
  SchemaName        = 'crfdf_FinalInstall'
  DisplayName       = (New-Label 'Final Install')
  DefaultValue      = $false
  OptionSet         = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
    TrueOption    = @{ Value = 1; Label = (New-Label 'Yes') }
    FalseOption   = @{ Value = 0; Label = (New-Label 'No') }
  }
}
try {
  Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
  Write-Host "  + created crfdf_finalinstall" -ForegroundColor Green
} catch {
  $msg = $_.ErrorDetails.Message
  if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host "  = crfdf_finalinstall exists, skipping" -ForegroundColor Yellow }
  else { Write-Host "  ! failed: $msg" -ForegroundColor Red }
}

try {
  Invoke-RestMethod -Method Post -Uri "$org/api/data/v9.2/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (column is usable regardless)." -ForegroundColor Yellow }
