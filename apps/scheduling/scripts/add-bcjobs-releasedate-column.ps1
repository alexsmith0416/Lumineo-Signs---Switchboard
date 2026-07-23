<#
  Adds the order-release-date column to the BC jobs staging table:

    crfdf_bcjobs.crfdf_ReleaseDate  (date+time)

  Populated by the BCSync_JobReleaseDates flow from the sign365 jobs entity's
  icgSgpOrderReleasedDate. The app reads it (bcJobMetaByJobNo) to drive target
  dates. Placeholder BC dates ("0001-01-01…") are stored as null by the flow.

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

# Resolve the table's LogicalName (singular) from its EntitySet name (plural) —
# EntityDefinitions is keyed by LogicalName, not the set name the app queries.
$entitySet = 'crfdf_bcjobs'
$def = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$base/EntityDefinitions?`$select=LogicalName&`$filter=EntitySetName eq '$entitySet'"
if (-not $def.value -or $def.value.Count -eq 0) { throw "Could not resolve LogicalName for entity set '$entitySet'." }
$entity = $def.value[0].LogicalName
Write-Host ("Resolved {0} -> {1}" -f $entitySet, $entity) -ForegroundColor Gray

function New-Label($text) {
  @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'
     LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$text; LanguageCode=1033 }) }
}

function New-DateTimeColumn($entity, $schema, $label) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type'     = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    AttributeType     = 'DateTime'; AttributeTypeName = @{ Value='DateTimeType' }
    Format            = 'DateAndTime'; SchemaName = $schema
    DisplayName       = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} (datetime)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

Write-Host "Adding crfdf_ReleaseDate to $entity…" -ForegroundColor Cyan
New-DateTimeColumn $entity 'crfdf_ReleaseDate' 'Release Date'

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
