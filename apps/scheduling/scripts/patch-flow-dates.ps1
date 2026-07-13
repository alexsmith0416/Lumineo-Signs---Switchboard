<#
  Guards BC's empty date (0001-01-01) so it's written as null instead of failing
  the Dataverse write ("DateTime is less than minimum value supported by
  CrmDateTime ... Minimum: 01/01/1753").

    * BCSync_Jobs            crfdf_promiseddate  <- endingDate
    * BCSync_JobPlanningLines crfdf_planningdate <- planningDate

  Both are patched on the Update AND Add rows. Fetches each flow's clientdata,
  edits in place, backs it up, PATCHes back. Idempotent.

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  AFTER it succeeds: re-run BCSync_Jobs and BCSync_JobPlanningLines.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowsDir = Join-Path $PSScriptRoot '..\flows'

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

function Set-Param($params, $name, $value) {
  if (-not $params.PSObject.Properties[$name]) { Write-Host ("    ! {0} not present" -f $name) -ForegroundColor Red; return }
  $params | Add-Member -Force -NotePropertyName $name -NotePropertyValue $value
  Write-Host ("    ~ {0}" -f $name) -ForegroundColor Green
}

function Patch-Flow($flowName, $mutate) {
  Write-Host "`n== $flowName ==" -ForegroundColor Cyan
  $found = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$org/api/data/v9.2/workflows?`$select=workflowid,name,clientdata&`$filter=category eq 5 and name eq '$flowName'"
  if (-not $found.value -or $found.value.Count -eq 0) { throw "Flow '$flowName' not found." }
  $wf = $found.value[0]
  $wf.clientdata | Out-File -FilePath (Join-Path $flowsDir ("{0}-clientdata-backup.json" -f $flowName)) -Encoding utf8
  $cd = $wf.clientdata | ConvertFrom-Json
  & $mutate $cd
  $new = $cd | ConvertTo-Json -Depth 100 -Compress
  $null = $new | ConvertFrom-Json
  Invoke-RestMethod -Method Patch -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Headers $headers -Body (@{ clientdata = $new } | ConvertTo-Json -Depth 4) | Out-Null
  Write-Host "  patched." -ForegroundColor Green
}

function DateGuard($expr) {
  return "@if(or(empty(coalesce($expr,'')), startsWith(coalesce($expr,''),'0001')), null, $expr)"
}

Patch-Flow 'BCSync_Jobs' {
  param($cd)
  $g = DateGuard "items('Apply_to_each')?['endingDate']"
  $acts = $cd.properties.definition.actions.Apply_to_each.actions
  foreach ($name in 'Update_a_row','Add_a_new_row') {
    if ($acts.PSObject.Properties[$name]) { Set-Param $acts.$name.inputs.parameters 'item/crfdf_promiseddate' $g }
  }
}

Patch-Flow 'BCSync_JobPlanningLines' {
  param($cd)
  $g = DateGuard "items('For_each_line')?['planningDate']"
  $fe = $cd.properties.definition.actions.For_each_job.actions.For_each_line.actions
  foreach ($name in 'Update_a_row','Add_a_new_row') {
    if ($fe.PSObject.Properties[$name]) { Set-Param $fe.$name.inputs.parameters 'item/crfdf_planningdate' $g }
  }
}

Write-Host "`nDone. Re-run BCSync_Jobs and BCSync_JobPlanningLines in Power Automate." -ForegroundColor Cyan
