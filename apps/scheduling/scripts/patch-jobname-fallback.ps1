<#
  Stops job cards from ever showing the BC job DESCRIPTION as the job name.
  Desired precedence: Ship-to name -> Bill-to (customer) name -> job number.

  Two flows carry a description fallback that leaks in when a customer can't be
  resolved:
    * BCSync_Jobs      crfdf_customername = coalesce(customerJoin, description)
    * BCSync_SalesLines appjobname (Update_a_row_2 / _3) coalesces ..., description, ...

  This repoints them to the job number ('no' / crfdf_jobnumber) and removes the
  description arg. crfdf_description keeps its own column (untouched).

  Backs up each flow's clientdata first. Idempotent.
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  AFTER it succeeds: re-run BCSync_Jobs, THEN BCSync_SalesLines (that order), so
  existing jobs re-sync.
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
  $old = $params.PSObject.Properties[$name].Value
  $params | Add-Member -Force -NotePropertyName $name -NotePropertyValue $value
  Write-Host ("    {0}" -f $name) -ForegroundColor DarkGray
  Write-Host ("      was: {0}" -f $old) -ForegroundColor DarkYellow
  Write-Host ("      now: {0}" -f $value) -ForegroundColor Green
}

function Patch-Flow($flowName, $mutate) {
  Write-Host "`n== $flowName ==" -ForegroundColor Cyan
  $found = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$org/api/data/v9.2/workflows?`$select=workflowid,name,clientdata&`$filter=category eq 5 and name eq '$flowName'"
  if (-not $found.value -or $found.value.Count -eq 0) { throw "Flow '$flowName' not found." }
  $wf = $found.value[0]
  $bak = Join-Path $flowsDir ("{0}-clientdata-backup.json" -f $flowName)
  $wf.clientdata | Out-File -FilePath $bak -Encoding utf8
  Write-Host ("  backed up -> {0}" -f $bak) -ForegroundColor Green
  $cd = $wf.clientdata | ConvertFrom-Json
  & $mutate $cd
  $new = $cd | ConvertTo-Json -Depth 100 -Compress
  $null = $new | ConvertFrom-Json
  Invoke-RestMethod -Method Patch -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Headers $headers -Body (@{ clientdata = $new } | ConvertTo-Json -Depth 4) | Out-Null
  Write-Host "  patched." -ForegroundColor Green
}

Patch-Flow 'BCSync_Jobs' {
  param($cd)
  $expr = "@coalesce(first(body('Filter_array'))?['crfdf_customername'], items('Apply_to_each')?['no'])"
  $acts = $cd.properties.definition.actions.Apply_to_each.actions
  foreach ($name in 'Update_a_row','Add_a_new_row') {
    if ($acts.PSObject.Properties[$name]) {
      Set-Param $acts.$name.inputs.parameters 'item/crfdf_customername' $expr
    }
  }
}

Patch-Flow 'BCSync_SalesLines' {
  param($cd)
  $root = $cd.properties.definition.actions.Apply_to_each_BC_Job.actions
  $u2 = $root.Condition_1.PSObject.Properties['else'].Value.actions.Update_a_row_2.inputs.parameters
  Set-Param $u2 'item/crfdf_appjobname' "@coalesce(outputs('Compose_ShipToName'), items('Apply_to_each_BC_Job')?['crfdf_customername'], items('Apply_to_each_BC_Job')?['crfdf_jobnumber'])"
  $u3 = $root.Condition.PSObject.Properties['else'].Value.actions.Update_a_row_3.inputs.parameters
  Set-Param $u3 'item/crfdf_appjobname' "@coalesce(items('Apply_to_each_BC_Job')?['crfdf_customername'], items('Apply_to_each_BC_Job')?['crfdf_jobnumber'])"
}

Write-Host "`nDone. Now re-run BCSync_Jobs, THEN BCSync_SalesLines, in Power Automate." -ForegroundColor Cyan
