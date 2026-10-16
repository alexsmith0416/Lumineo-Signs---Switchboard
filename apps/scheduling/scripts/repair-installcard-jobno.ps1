<#
  One-off repair (Oct 15, 2026): puts the BC job number back on install cards
  that were saved without it.

  Cause: until Oct 15, ANY failed install-card save (a lost reply, a connection
  blip) switched the newer card columns off for the rest of the session, so
  every later card saved with no crfdf_jobno / zip / crew. The card then showed
  its title as the job number, and Open Project sent that title to BC.

  Recovery: (1) each card's BC push row (crfdf_bcpushqueue, kind "schedule", step
  Install) was queued from the card on screen, so it carries the job number and
  crfdf_sourcelineid = the card's id. Most hit cards never got one (the push
  looks the job's cards up BY job number, so it found nothing). (2) Otherwise
  the card title is matched to a BC job's display name, narrowed by the job
  description and task text saved in the card's notes. Ambiguous matches are
  listed, never guessed.

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

$headers = @{ Authorization="Bearer $token"; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0'; Accept='application/json'; Prefer='odata.include-annotations="OData.Community.Display.V1.FormattedValue"' }
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

function Norm([string]$v) { return (($v -replace '\s+', ' ').Trim()).ToLower() }

# Card notes hold "<job description>␞<task>" (see encodeDesc in dataverse-live.ts).
$SEP = [char]0x241E
function Split-Notes([string]$raw) {
  $i = "$raw".IndexOf($SEP)
  if ($i -ge 0) { return @{ job = $raw.Substring(0, $i); task = $raw.Substring($i + 1) } }
  return @{ job = ''; task = "$raw" }
}

# Install cards with no job number that aren't custom cards or delivery runs.
$cards = Get-All ("$base/crfdf_installcards?`$select=crfdf_installcardid,crfdf_name,crfdf_notes,crfdf_region,crfdf_iscustom,createdon,_createdby_value" +
  "&`$filter=crfdf_jobno eq null and _crfdf_shipmentload_value eq null")
$cards = @($cards | Where-Object { -not $_.crfdf_iscustom })
Write-Host ("{0} non-custom card(s) have no job number." -f $cards.Count)

# Source 1: the card's own BC push row (newest that names a job).
$pushes = Get-All ("$base/crfdf_bcpushqueues?`$select=crfdf_sourcelineid,crfdf_jobno,createdon" +
  "&`$filter=crfdf_sourcelineid ne null and crfdf_jobno ne null&`$orderby=createdon desc")
$jobByCard = @{}
foreach ($p in $pushes) {
  $key = "$($p.crfdf_sourcelineid)".ToLower()
  if ($key -and -not $jobByCard.ContainsKey($key)) { $jobByCard[$key] = $p.crfdf_jobno }
}

# Source 2: the card's title is the BC job's display name (ship-to name, raw
# customer name, or the bill-to customer's name) — narrowed by the job
# description and then the task text when a customer has several jobs.
$custName = @{}
foreach ($c in (Get-All "$base/crfdf_bccustomers?`$select=crfdf_customerno,crfdf_customername")) {
  if ($c.crfdf_customerno) { $custName["$($c.crfdf_customerno)"] = "$($c.crfdf_customername)" }
}
$jobsByName = @{}
foreach ($j in (Get-All "$base/crfdf_bcjobs?`$select=crfdf_jobnumber,crfdf_appjobname,crfdf_customername,crfdf_description,crfdf_billtocustomerno")) {
  if (-not $j.crfdf_jobnumber) { continue }
  $names = @($j.crfdf_appjobname, $j.crfdf_customername, $custName["$($j.crfdf_billtocustomerno)"]) |
    Where-Object { $_ } | ForEach-Object { Norm $_ } | Select-Object -Unique
  foreach ($n in $names) {
    if (-not $jobsByName.ContainsKey($n)) { $jobsByName[$n] = @() }
    $jobsByName[$n] += $j
  }
}
$taskCache = @{}
function Get-Tasks([string]$jobNo) {
  if (-not $taskCache.ContainsKey($jobNo)) {
    $lit = $jobNo -replace "'", "''"
    $taskCache[$jobNo] = @(Get-All ("$base/crfdf_bcplanninglines?`$select=crfdf_description" +
      "&`$filter=crfdf_jobno eq '$lit' and crfdf_type eq 'Resource'") | ForEach-Object { Norm $_.crfdf_description })
  }
  return $taskCache[$jobNo]
}

$fixed = 0; $unknown = @(); $ambiguous = @()
foreach ($c in $cards) {
  $id = $c.crfdf_installcardid
  $region = if ($c.crfdf_region) { 'NEK' } else { 'WK' }
  $by = $c.'_createdby_value@OData.Community.Display.V1.FormattedValue'
  $label = "$region  $($c.crfdf_name)  (created $($c.createdon) by $by)"
  $how = 'push row'
  $jobNo = $jobByCard["$id".ToLower()]
  if (-not $jobNo) {
    $notes = Split-Notes "$($c.crfdf_notes)"
    $cands = @($jobsByName[(Norm $c.crfdf_name)] | Where-Object { $_ } | Sort-Object crfdf_jobnumber -Unique)
    $how = 'name'
    if ($cands.Count -gt 1 -and $notes.job) {
      $byDesc = @($cands | Where-Object { (Norm $_.crfdf_description) -eq (Norm $notes.job) })
      if ($byDesc.Count -ge 1) { $cands = $byDesc; $how = 'name + job description' }
    }
    if ($cands.Count -gt 1 -and $notes.task) {
      $t = Norm $notes.task
      $byTask = @($cands | Where-Object { (Get-Tasks $_.crfdf_jobnumber) -contains $t })
      if ($byTask.Count -ge 1) { $cands = $byTask; $how += ' + task' }
    }
    if ($cands.Count -eq 1) { $jobNo = $cands[0].crfdf_jobnumber }
    elseif ($cands.Count -gt 1) {
      $ambiguous += "  $label`n      task: $($notes.task)`n      could be: " +
        (($cands | ForEach-Object { "$($_.crfdf_jobnumber) ($($_.crfdf_description))" }) -join ', ')
      continue
    }
  }
  if (-not $jobNo) { $unknown += "  $label"; continue }
  Write-Host ("  {0}  ->  {1}   [{2}]" -f $label, $jobNo, $how)
  if ($Apply) {
    Invoke-RestMethod -Method Patch -Uri "$base/crfdf_installcards($id)" -Headers $headers `
      -Body (@{ crfdf_jobno = $jobNo } | ConvertTo-Json) | Out-Null
  }
  $fixed++
}

if ($ambiguous.Count) {
  Write-Host ""
  Write-Host ("{0} card(s) match more than one BC job — set these by hand:" -f $ambiguous.Count) -ForegroundColor Yellow
  $ambiguous | ForEach-Object { Write-Host $_ }
}
if ($unknown.Count) {
  Write-Host ""
  Write-Host ("{0} card(s) match no BC job by name (title-only cards, or add the number by hand):" -f $unknown.Count) -ForegroundColor Yellow
  $unknown | ForEach-Object { Write-Host $_ }
}
Write-Host ""
if ($Apply) { Write-Host ("Restored the job number on {0} card(s)." -f $fixed) -ForegroundColor Green }
else { Write-Host ("Dry run: {0} card(s) can be restored. Re-run with -Apply to write." -f $fixed) -ForegroundColor Green }
