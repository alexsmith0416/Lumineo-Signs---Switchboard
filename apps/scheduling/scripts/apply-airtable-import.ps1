<#
  Applies the Airtable import plan built by scripts/plan-airtable-import.py.
  DRY RUN unless -Apply. Only ADDS what's missing - it never overwrites:
    - crfdf_jobtrack         one row per job; skipped if the job already has one
    - crfdf_jobschedule      red date / production-complete override written only
                             where the app's value is empty (row created if none)
    - crfdf_jobdeptoverride  "needed" (included) + "active" per dept, only where
                             the job+dept has no override yet
    - crfdf_jobdeptcompletion "done" per dept, only where not already complete
  Rows it writes carry "Airtable import" so they can be found later.

      pwsh -File scripts/apply-airtable-import.ps1            (plan defaults to Downloads\airtable-import-plan.json)
      pwsh -File scripts/apply-airtable-import.ps1 -Apply

  Requires crfdf_jobtrack (scripts/create-jobtrack-table.ps1). Device-code auth.
#>
param([string]$Plan = (Join-Path $env:USERPROFILE 'Downloads\airtable-import-plan.json'), [switch]$Apply)
$ErrorActionPreference = 'Stop'
# Not $plan: PowerShell names are case-insensitive, and $Plan is the [string] path.
$planRows = Get-Content $Plan -Raw | ConvertFrom-Json -DateKind String

$tenant='fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'; $org='https://org8fa22efd.crm.dynamics.com'; $clientId='04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" -Body @{ client_id=$clientId; scope="$org/.default offline_access" }
Write-Host "==> $($dc.message)" -ForegroundColor Cyan
$token=$null; $deadline=(Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $token -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try { $token=(Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" -Body @{ grant_type='urn:ietf:params:oauth:grant-type:device_code'; client_id=$clientId; device_code=$dc.device_code }).access_token }
  catch { $err=($_.ErrorDetails.Message | ConvertFrom-Json).error; if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw } }
}
if (-not $token) { throw 'Device-code login timed out.' }
"Authenticated."
$h = @{ Authorization="Bearer $token"; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0'; Accept='application/json'; Prefer='odata.maxpagesize=5000' }
$api = "$org/api/data/v9.2"

function Get-All($set, $select) {
  $out = @(); $url = "$api/$set`?`$select=$select"
  while ($url) { $p = Invoke-RestMethod -Uri $url -Headers $h; $out += $p.value; $url = $p.'@odata.nextLink' }
  $out
}
function Post($set, $rec) { if ($Apply) { Invoke-RestMethod -Method Post -Uri "$api/$set" -Headers $h -Body ($rec | ConvertTo-Json) | Out-Null } }
function Patch($set, $id, $rec) { if ($Apply) { Invoke-RestMethod -Method Patch -Uri "$api/$set($id)" -Headers $h -Body ($rec | ConvertTo-Json) | Out-Null } }

# --- what's already there ---------------------------------------------------
$track = @{}; foreach ($r in (Get-All 'crfdf_jobtracks' 'crfdf_jobno')) { $track[$r.crfdf_jobno] = $true }
# The production-complete override column is optional (scripts/add-jobschedule-
# productioncomplete-column.ps1); without it the Mfg target overrides are skipped.
$hasProdComplete = $true
try { Invoke-RestMethod -Uri "$api/crfdf_jobschedules?`$select=crfdf_productioncompletedate&`$top=1" -Headers $h | Out-Null }
catch { $hasProdComplete = $false; "NOTE: crfdf_jobschedule has no crfdf_productioncompletedate column - Mfg target overrides will be skipped." }
$schedCols = 'crfdf_jobscheduleid,crfdf_jobno,crfdf_reddate' + $(if ($hasProdComplete) { ',crfdf_productioncompletedate' } else { '' })
$sched = @{}; foreach ($r in (Get-All 'crfdf_jobschedules' $schedCols)) { $sched[$r.crfdf_jobno] = $r }
$ovr = @{};   foreach ($r in (Get-All 'crfdf_jobdeptoverrides' 'crfdf_jobno,crfdf_deptid')) { $ovr["$($r.crfdf_jobno)|$($r.crfdf_deptid)"] = $true }
$done = @{};  foreach ($r in (Get-All 'crfdf_jobdeptcompletions' 'crfdf_jobno,crfdf_deptid')) { $done["$($r.crfdf_jobno)|$($r.crfdf_deptid)"] = $true }
"Existing: $($track.Count) job tracking, $($sched.Count) job schedule, $($ovr.Count) overrides, $($done.Count) completions."

$n = [ordered]@{ schedNoCol=0; track=0; trackSkip=0; schedNew=0; schedFill=0; schedSkip=0; ovr=0; ovrSkip=0; done=0; doneSkip=0 }
$today = (Get-Date).ToString('yyyy-MM-dd')
foreach ($p in $planRows) {
  $job = $p.jobNo

  if ($track[$job]) { $n.trackSkip++ } else {
    $rec = @{ crfdf_jobtrackid = [guid]::NewGuid().ToString() }
    foreach ($prop in $p.jobtrack.PSObject.Properties) { $rec[$prop.Name] = $prop.Value }
    Post 'crfdf_jobtracks' $rec; $n.track++
  }

  $want = @{}
  if ($p.schedule.redDate) { $want.crfdf_reddate = $p.schedule.redDate }
  if ($p.schedule.productionCompleteDate) {
    if ($hasProdComplete) { $want.crfdf_productioncompletedate = $p.schedule.productionCompleteDate } else { $n.schedNoCol++ }
  }
  if ($want.Count) {
    $s = $sched[$job]
    if (-not $s) {
      Post 'crfdf_jobschedules' (@{ crfdf_jobscheduleid=[guid]::NewGuid().ToString(); crfdf_jobno=$job; crfdf_name=$job } + $want); $n.schedNew++
    } else {
      $fill = @{}; foreach ($k in $want.Keys) { if (-not $s.$k) { $fill[$k] = $want[$k] } }
      if ($fill.Count) { Patch 'crfdf_jobschedules' $s.crfdf_jobscheduleid $fill; $n.schedFill++ } else { $n.schedSkip++ }
    }
  }

  foreach ($key in $p.include) {
    if ($ovr["$job|$key"]) { $n.ovrSkip++; continue }
    Post 'crfdf_jobdeptoverrides' @{ crfdf_jobdeptoverrideid=[guid]::NewGuid().ToString(); crfdf_jobno=$job; crfdf_deptid=$key;
      crfdf_included=$true; crfdf_active=[bool]($p.active -contains $key); crfdf_name="$job $key" }
    $n.ovr++
  }
  foreach ($key in $p.complete) {
    if ($done["$job|$key"]) { $n.doneSkip++; continue }
    Post 'crfdf_jobdeptcompletions' @{ crfdf_jobdeptcompletionid=[guid]::NewGuid().ToString(); crfdf_jobno=$job; crfdf_deptid=$key;
      crfdf_completedby='Airtable import'; crfdf_completeddate=$today; crfdf_name="$job $key" }
    $n.done++
  }
}

$verb = if ($Apply) { 'Wrote' } else { 'Would write' }
"$verb {0} job tracking rows ({1} already there)" -f $n.track, $n.trackSkip
"$verb {0} new job schedule rows, filled {1} empty dates ({2} already set)" -f $n.schedNew, $n.schedFill, $n.schedSkip
"$verb {0} stepper 'needed' overrides ({1} already there)" -f $n.ovr, $n.ovrSkip
"$verb {0} stepper completions ({1} already done)" -f $n.done, $n.doneSkip
if ($n.schedNoCol) { "Skipped {0} Mfg target overrides - run scripts/add-jobschedule-productioncomplete-column.ps1 first to keep them." -f $n.schedNoCol }
if (-not $Apply) { "Dry run - nothing written. Re-run with -Apply." }
