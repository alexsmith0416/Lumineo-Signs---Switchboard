<#
  Teaches the live BCPush_PlanningSteps flow to stamp BC's **Completed_By**
  (Oct 7, 2026 — status-driven lifecycle): when a "state" row completes a step
  and carries a BC Resource No. in crfdf_assignedto (the person who moved the
  job on), the PATCH / POST body gets "Completed_By": <no.>.

  Only the Push_Body expression changes — copied from the GENERATED flow
  (flows/BCPush_PlanningSteps-clientdata.json, from _gen_planningsteps_flow.py)
  so the two never drift. Everything else in the live flow (secret, connection
  references, parameters) is left exactly as it is. The current clientdata is
  backed up first to flows/pushflow-clientdata-backup-<stamp>.json (git-ignored).
  Idempotent: an already-patched flow is left alone.

  Uses the Web API with a device-code token. Run it, open the printed URL,
  enter the code, sign in as asmith@lumineosigns.com.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowName = 'BCPush_PlanningSteps'
$genFile  = Join-Path $PSScriptRoot '..\flows\BCPush_PlanningSteps-clientdata.json'
$bakFile  = Join-Path $PSScriptRoot ('..\flows\pushflow-clientdata-backup-{0}.json' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

$gen = Get-Content $genFile -Raw | ConvertFrom-Json
$want = $gen.properties.definition.actions.Only_pending_step_rows.actions.Try.actions.Is_Stale.else.actions.Push_Body.inputs
if (-not $want -or $want -notmatch 'Completed_By') { throw "Generated Push_Body has no Completed_By - run python flows/_gen_planningsteps_flow.py first." }

$dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }
Write-Host ""; Write-Host "==> $($dc.message)" -ForegroundColor Cyan; Write-Host ""
$token = $null; $deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $token -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try {
    $token = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type='urn:ietf:params:oauth:grant-type:device_code'; client_id=$clientId; device_code=$dc.device_code }).access_token
  } catch { $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error; if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw } }
}
if (-not $token) { throw "Device-code login timed out." }
Write-Host "Authenticated." -ForegroundColor Green
$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }

$found = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$org/api/data/v9.2/workflows?`$select=workflowid,name,clientdata,statecode&`$filter=category eq 5 and name eq '$flowName'"
if (-not $found.value -or $found.value.Count -eq 0) { throw "Flow '$flowName' not found (category 5)." }
$wf = $found.value[0]
Write-Host ("Found {0}  (workflowid={1}, statecode={2})" -f $wf.name, $wf.workflowid, $wf.statecode) -ForegroundColor Green

$cd = $wf.clientdata | ConvertFrom-Json
$pb = $cd.properties.definition.actions.Only_pending_step_rows.actions.Try.actions.Is_Stale.else.actions.Push_Body
if (-not $pb) { throw "Push_Body not found where expected - flow shape changed." }
if ($pb.inputs -eq $want) { Write-Host "Already patched - nothing to do." -ForegroundColor Yellow; return }

$wf.clientdata | Out-File -FilePath $bakFile -Encoding utf8
Write-Host ("Backed up current clientdata -> {0}" -f $bakFile) -ForegroundColor Green
$pb.inputs = $want
$body = @{ clientdata = ($cd | ConvertTo-Json -Depth 60 -Compress) } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Method Patch -Headers $headers -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Body $body | Out-Null
Write-Host "Saved: state rows now stamp Completed_By. The flow stays On." -ForegroundColor Cyan
