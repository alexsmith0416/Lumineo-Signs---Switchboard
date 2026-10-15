<#
  One-off repair (Oct 15, 2026): puts the BC job number back on install cards
  that were saved without it.

  Cause: until Oct 15, ANY failed install-card save (a lost reply, a connection
  blip) switched the newer card columns off for the rest of the session, so
  every later card saved with no crfdf_jobno / zip / crew. The card then showed
  its title as the job number, and Open Project sent that title to BC.

  Recovery: each card's BC push row (crfdf_bcpushqueue, kind "schedule", step
  Install) was queued from the card on screen, so it carries the job number and
  crfdf_sourcelineid = the card's id.

  Dry run by default — lists what it would fix. Add -Apply to write.
    .\scripts\repair-installcard-jobno.ps1
    .\scripts\repair-installcard-jobno.ps1 -Apply

  Uses the Web API with a device-code token. Run it, open the printed URL, enter
  the code, sign in as asmith@lumineosigns.com. Safe to re-run.
#>
param([switch]$Apply)

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

function Get-All([string]$url) {
  $rows = @()
  while ($url) {
    $page = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
    $rows += $page.value
    $url = $page.'@odata.nextLink'
  }
  return $rows
}

# Install cards with no job number that aren't custom cards or delivery runs.
$cards = Get-All ("$base/crfdf_installcards?`$select=crfdf_installcardid,crfdf_name,crfdf_region,crfdf_iscustom,createdon" +
  "&`$filter=crfdf_jobno eq null and _crfdf_shipmentload_value eq null")
$cards = @($cards | Where-Object { -not $_.crfdf_iscustom })
Write-Host ("{0} non-custom card(s) have no job number." -f $cards.Count)

# Job number per card id, from the newest push row that names one.
$pushes = Get-All ("$base/crfdf_bcpushqueues?`$select=crfdf_sourcelineid,crfdf_jobno,createdon" +
  "&`$filter=crfdf_sourcelineid ne null and crfdf_jobno ne null&`$orderby=createdon desc")
$jobByCard = @{}
foreach ($p in $pushes) {
  $key = "$($p.crfdf_sourcelineid)".ToLower()
  if ($key -and -not $jobByCard.ContainsKey($key)) { $jobByCard[$key] = $p.crfdf_jobno }
}

$fixed = 0; $unknown = @()
foreach ($c in $cards) {
  $id = $c.crfdf_installcardid
  $jobNo = $jobByCard["$id".ToLower()]
  $region = if ($c.crfdf_region) { 'NEK' } else { 'WK' }
  if (-not $jobNo) { $unknown += "  $region  $($c.crfdf_name)  (created $($c.createdon))"; continue }
  Write-Host ("  {0}  {1}  ->  {2}" -f $region, $c.crfdf_name, $jobNo)
  if ($Apply) {
    Invoke-RestMethod -Method Patch -Uri "$base/crfdf_installcards($id)" -Headers $headers `
      -Body (@{ crfdf_jobno = $jobNo } | ConvertTo-Json) | Out-Null
  }
  $fixed++
}

if ($unknown.Count) {
  Write-Host ""
  Write-Host ("{0} card(s) with no job number found in the push queue (add it by hand, or they're title-only cards):" -f $unknown.Count) -ForegroundColor Yellow
  $unknown | ForEach-Object { Write-Host $_ }
}
Write-Host ""
if ($Apply) { Write-Host ("Restored the job number on {0} card(s)." -f $fixed) -ForegroundColor Green }
else { Write-Host ("Dry run: {0} card(s) can be restored. Re-run with -Apply to write." -f $fixed) -ForegroundColor Green }
