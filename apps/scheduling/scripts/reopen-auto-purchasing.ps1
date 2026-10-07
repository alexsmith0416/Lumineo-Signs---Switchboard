<#
  Re-opens the Purchasing (PU) stage on jobs where the APP completed it
  automatically. Since Oct 7, 2026 Purchasing is completed only by the
  purchaser (production-steps MANUAL_ONLY_KEYS), but the first lifecycle
  deploy's "Match Steppers" and shop-floor punches ticked it on jobs that had
  moved on. Those completions are stamped:
      "<name> (status backfill)"   — Match Steppers
      "Punch · <name>"             — a shop-floor Task complete
  -Apply deletes those crfdf_jobdeptcompletion rows (crfdf_deptid = 'PU').
  Completions stamped by a person (a stepper click, or a status pick before
  this change) are LISTED but left alone — check them by hand.

  BC: Match Steppers never pushed to BC, so the backfilled ones never reached
  it. Run this BEFORE "Sync to BC". (A punch-made one did push "Job
  Purchasing" Complete; re-open those in BC by hand if any are listed.)

  Dry run by default. Device-code sign-in as asmith@lumineosigns.com.
#>
param(
  [switch]$Apply,
  # Optional file to keep the sign-in between the dry run and -Apply (OUTSIDE the repo).
  [string]$TokenCache = ''
)

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

$resp = $null
if ($TokenCache -and (Test-Path $TokenCache)) {
  try {
    $cached = Get-Content $TokenCache -Raw | ConvertFrom-Json
    $resp = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type = 'refresh_token'; client_id = $clientId; refresh_token = $cached.refresh_token; scope = "$org/.default offline_access" }
  } catch { $resp = $null }
}
if (-not $resp) {
  $dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
    -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }
  Write-Host ""; Write-Host "==> $($dc.message)" -ForegroundColor Cyan; Write-Host ""
  $deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
  while (-not $resp -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds ([int]$dc.interval)
    try {
      $resp = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
        -Body @{ grant_type='urn:ietf:params:oauth:grant-type:device_code'; client_id=$clientId; device_code=$dc.device_code }
    } catch { $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error; if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw } }
  }
}
if (-not $resp) { throw "Device-code login timed out." }
if ($TokenCache) { $resp | ConvertTo-Json | Set-Content $TokenCache }
$token = $resp.access_token
Write-Host "Authenticated." -ForegroundColor Green
$h = @{ Authorization = "Bearer $token"; Accept = 'application/json'; 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0' }
$api = "$org/api/data/v9.2"

$rows = @(); $url = "$api/crfdf_jobdeptcompletions?`$select=crfdf_jobdeptcompletionid,crfdf_jobno,crfdf_completedby,crfdf_completeddate&`$filter=crfdf_deptid eq 'PU'"
while ($url) { $r = Invoke-RestMethod -Uri $url -Headers $h; $rows += $r.value; $url = $r.'@odata.nextLink' }
$auto = $rows | Where-Object { $_.crfdf_completedby -like '*(status backfill)*' -or $_.crfdf_completedby -like 'Punch ·*' }
$manual = $rows | Where-Object { $_ -notin $auto }

Write-Host ""
Write-Host ("Purchasing completions: {0}  — automatic: {1}, by a person: {2}" -f $rows.Count, $auto.Count, $manual.Count) -ForegroundColor Cyan
$auto | Group-Object { if ($_.crfdf_completedby -like 'Punch ·*') { 'Punch (shop floor)' } else { $_.crfdf_completedby } } |
  ForEach-Object { Write-Host ("  auto   {0,5}  {1}" -f $_.Count, $_.Name) -ForegroundColor Yellow }
if ($auto | Where-Object { $_.crfdf_completedby -like 'Punch ·*' }) {
  Write-Host ("  punch jobs (also re-open Job Purchasing in BC): {0}" -f (($auto | Where-Object { $_.crfdf_completedby -like 'Punch ·*' }).crfdf_jobno -join ', ')) -ForegroundColor Yellow
}
foreach ($m in $manual | Sort-Object crfdf_completeddate) {
  Write-Host ("  person {0,-8} {1}  {2}" -f $m.crfdf_jobno, $m.crfdf_completeddate, $m.crfdf_completedby) -ForegroundColor DarkGray
}

if (-not $Apply) { Write-Host ""; Write-Host "Dry run — nothing changed. -Apply re-opens the $($auto.Count) automatic ones." -ForegroundColor Cyan; return }
$n = 0
foreach ($a in $auto) {
  Invoke-RestMethod -Method Delete -Headers $h -Uri "$api/crfdf_jobdeptcompletions($($a.crfdf_jobdeptcompletionid))" | Out-Null
  $n++
  if ($n % 50 -eq 0) { Write-Host "  $n…" }
}
Write-Host "Re-opened Purchasing on $n jobs. Reload the app." -ForegroundColor Green
