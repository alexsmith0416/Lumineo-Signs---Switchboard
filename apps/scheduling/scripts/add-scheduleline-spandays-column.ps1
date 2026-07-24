<#
  Adds the manual VISUAL span column to the schedule-line + install-card tables:

    crfdf_productionscheduleline.crfdf_SpanDays  (whole number)
    crfdf_installcard.crfdf_SpanDays             (whole number)

  Set by dragging a card's right edge. Display-only: the scheduler ignores it
  (capacity/cascade still use the hours-derived end), so a stretched card reserves
  no capacity. Blank / ≤1 = span from hours.

  Same device-code auth as the other create-/add- scripts. Run it, open the
  printed URL, enter the code, sign in as asmith@lumineosigns.com. Safe to
  re-run: the column is skipped if it already exists.
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

function Resolve-Entity($entitySet) {
  $def = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$base/EntityDefinitions?`$select=LogicalName&`$filter=EntitySetName eq '$entitySet'"
  if (-not $def.value -or $def.value.Count -eq 0) { throw "Could not resolve LogicalName for '$entitySet'." }
  return $def.value[0].LogicalName
}

function New-IntColumn($entity, $schema, $label) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
    AttributeType = 'Integer'; AttributeTypeName = @{ Value='IntegerType' }
    MinValue = 0; MaxValue = 366; SchemaName = $schema
    DisplayName = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0}.{1}" -f $entity, $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0}.{1} exists, skipping" -f $entity, $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0}.{1} failed: {2}" -f $entity, $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

Write-Host "Adding crfdf_SpanDays…" -ForegroundColor Cyan
foreach ($set in @('crfdf_productionschedulelines', 'crfdf_installcards')) {
  $entity = Resolve-Entity $set
  New-IntColumn $entity 'crfdf_SpanDays' 'Span Days'
}

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
