<#
  Adds the BC resource-number column to the roster employee table so the app can
  write "who a step is scheduled to" back to Business Central:

    crfdf_employee1.crfdf_No  (text) — the person's BC resource no.

  Then BACK-FILLS it from crfdf_appuser (which already holds resource nos in its
  crfdf_no column) by matching the app user's display name to the employee's
  name (crfdf_employeename), case-insensitively. Unmatched employees are listed
  so you can fill them by hand.

  Same device-code auth as the other create-/add- scripts. Run it, open the
  printed URL, enter the code, sign in as asmith@lumineosigns.com. Safe to
  re-run: the column is skipped if it already exists; the back-fill only sets
  rows that are currently blank.
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

Write-Host "Adding crfdf_No to crfdf_employee1…" -ForegroundColor Cyan
New-Column 'crfdf_employee1' 'crfdf_No' 'No' 20

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

# --- Back-fill from crfdf_appuser by display-name match -----------------------
Write-Host "Back-filling resource nos from crfdf_appuser…" -ForegroundColor Cyan

$appusers = (Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$base/crfdf_appusers?`$select=crfdf_displayname,crfdf_no").value
$byName = @{}
foreach ($u in $appusers) {
  $dn = ("" + $u.crfdf_displayname).Trim().ToLower()
  $no = ("" + $u.crfdf_no).Trim()
  if ($dn -and $no -and -not $byName.ContainsKey($dn)) { $byName[$dn] = $no }
}
Write-Host ("  loaded {0} app users with a resource no" -f $byName.Count) -ForegroundColor Gray

$emps = (Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$base/crfdf_employee1s?`$select=crfdf_employee1id,crfdf_employeename,crfdf_no").value
$set = 0; $skipped = 0; $unmatched = @()
foreach ($e in $emps) {
  $name = ("" + $e.crfdf_employeename).Trim()
  $key  = $name.ToLower()
  if (("" + $e.crfdf_no).Trim()) { $skipped++; continue }   # already has one
  if ($byName.ContainsKey($key)) {
    $patch = @{ crfdf_no = $byName[$key] } | ConvertTo-Json
    Invoke-RestMethod -Method Patch -Headers $headers `
      -Uri "$base/crfdf_employee1s($($e.crfdf_employee1id))" -Body $patch | Out-Null
    Write-Host ("  + {0} -> {1}" -f $name, $byName[$key]) -ForegroundColor Green
    $set++
  } else {
    $unmatched += $name
  }
}

Write-Host ""
Write-Host ("Set {0}, already-had {1}, unmatched {2}." -f $set, $skipped, $unmatched.Count) -ForegroundColor Cyan
if ($unmatched.Count -gt 0) {
  Write-Host "Unmatched employees (fill crfdf_no by hand, or fix the name to match app-user display name):" -ForegroundColor Yellow
  $unmatched | Sort-Object -Unique | ForEach-Object { Write-Host ("  - {0}" -f $_) -ForegroundColor Yellow }
}
Write-Host "Done." -ForegroundColor Cyan
