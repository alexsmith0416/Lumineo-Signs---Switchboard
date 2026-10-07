<#
  Fixes BCSync_JobPlanningLines, which "failed" every night from (at least)
  Sep 23 and ended up turned off on Oct 3, 2026.

  The bug: for each planning line the flow looked the line up, ran Update a
  row, then ran Add a new row AFTER IT WHETHER UPDATE SUCCEEDED OR FAILED
  (runAfter Failed + Succeeded). So every line that already existed was
  updated (fine) and then re-added — "Entity Key naturalkey violated … jobno,
  jobtaskno, Line No already exists" — ~7,400 failed actions a night, so every
  run ended Failed although the data was written. (New lines: Update failed on
  an empty recordId, then Add created them.) Diagnosed with
  scripts/diagnose-flow.ps1.

  The fix, in the live flow's clientdata:
    1. For_each_line: Update_a_row / Add_a_new_row go into a condition
       Line_Exists — the line was found → Update a row, else → Add a new row.
       Same field mappings as before, untouched.
    2. For_each_job runs 10 jobs at a time (was one at a time — ~1.5 h a run).
       Each job's lines still go one by one.
  Nothing else changes. It does NOT turn the flow on — do that in Power
  Automate, then Run it once to catch up.

  Fetches the live flow's clientdata, backs it up next to the other flow
  backups (flows/*-backup-*.json, not committed), edits it and PATCHes it back
  via the Web API with a device-code token. Idempotent: an already-patched
  flow is left alone.
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowName = 'BCSync_JobPlanningLines'
$bakFile  = Join-Path $PSScriptRoot ('..\flows\planninglines-clientdata-backup-{0}.json' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

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

# --- Locate the flow (modern cloud flow = category 5) -------------------------
$found = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$org/api/data/v9.2/workflows?`$select=workflowid,name,clientdata,statecode&`$filter=category eq 5 and name eq '$flowName'"
if (-not $found.value -or $found.value.Count -eq 0) { throw "Flow '$flowName' not found (category 5)." }
$wf = $found.value[0]
Write-Host ("Found {0}  (workflowid={1}, statecode={2})" -f $wf.name, $wf.workflowid, $wf.statecode) -ForegroundColor Green

$cd   = $wf.clientdata | ConvertFrom-Json
$job  = $cd.properties.definition.actions.For_each_job
$line = $job.actions.For_each_line
if (-not $line) { throw "For_each_job / For_each_line not found - flow shape changed." }
$acts = $line.actions

if ($acts.PSObject.Properties['Line_Exists']) {
  Write-Host "Already patched (Line_Exists present) - nothing to do." -ForegroundColor Yellow
  return
}
foreach ($n in 'List_rows_-_existing_line', 'Update_a_row', 'Add_a_new_row') {
  if (-not $acts.PSObject.Properties[$n]) { throw "$n not found in For_each_line - flow shape changed." }
}

$wf.clientdata | Out-File -FilePath $bakFile -Encoding utf8
Write-Host ("Backed up current clientdata -> {0}" -f $bakFile) -ForegroundColor Green

# 1. Update / Add behind a condition on the lookup.
$update = $acts.Update_a_row
$add    = $acts.Add_a_new_row
$update.runAfter = [pscustomobject]@{}
$add.runAfter    = [pscustomobject]@{}
$cond = [pscustomobject]@{
  type       = 'If'
  expression = [pscustomobject]@{ greater = @("@length(coalesce(outputs('List_rows_-_existing_line')?['body/value'], json('[]')))", 0) }
  actions    = [pscustomobject]@{ Update_a_row = $update }
  else       = [pscustomobject]@{ actions = [pscustomobject]@{ Add_a_new_row = $add } }
  runAfter   = [pscustomobject]@{ 'List_rows_-_existing_line' = @('Succeeded') }
}
$acts.PSObject.Properties.Remove('Update_a_row')
$acts.PSObject.Properties.Remove('Add_a_new_row')
$acts | Add-Member -NotePropertyName 'Line_Exists' -NotePropertyValue $cond
Write-Host "  + Line_Exists: found -> Update_a_row, else -> Add_a_new_row" -ForegroundColor Green

# 2. Jobs 10 at a time.
$rc = [pscustomobject]@{ concurrency = [pscustomobject]@{ repetitions = 10 } }
if ($job.PSObject.Properties['runtimeConfiguration']) { $job.runtimeConfiguration = $rc }
else { $job | Add-Member -NotePropertyName 'runtimeConfiguration' -NotePropertyValue $rc }
Write-Host "  + For_each_job: 10 jobs at a time" -ForegroundColor Green

# --- Save ---------------------------------------------------------------------
$body = @{ clientdata = ($cd | ConvertTo-Json -Depth 60 -Compress) } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Method Patch -Headers $headers -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Body $body | Out-Null
Write-Host "Saved. Turn BCSync_JobPlanningLines ON in Power Automate, then Run it once to catch up." -ForegroundColor Cyan
