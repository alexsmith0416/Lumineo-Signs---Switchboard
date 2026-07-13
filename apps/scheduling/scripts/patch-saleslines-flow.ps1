<#
  Teaches the BCSync_SalesLines flow to stamp each job's BC salesperson code onto
  crfdf_bcjobs.crfdf_salespersoncode. It:
    1. adds a Compose_SalespersonCode step (reads SalesLines.salespersonCode), and
    2. writes item/crfdf_salespersoncode in both Update_a_row_1 (customer found)
       and Update_a_row_2 (customer not found).

  Fetches the live flow's clientdata, edits it in place, backs it up, and PATCHes
  it back via the Web API with a device-code token. Idempotent (re-running skips
  edits already present).

  PREREQUISITE: run add-bcjobs-salesperson-column.ps1 first so the column exists.
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  AFTER it succeeds: open BCSync_SalesLines in Power Automate and click Run (or
  wait for its schedule) so the codes populate.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowName = 'BCSync_SalesLines'
$bakFile  = Join-Path $PSScriptRoot '..\flows\saleslines-clientdata-backup.json'

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

# --- Back up, then edit the clientdata in place -------------------------------
$wf.clientdata | Out-File -FilePath $bakFile -Encoding utf8
Write-Host ("Backed up current clientdata -> {0}" -f $bakFile) -ForegroundColor Green

$cd   = $wf.clientdata | ConvertFrom-Json
$root = $cd.properties.definition.actions.Apply_to_each_BC_Job.actions
$cond = $root.Condition.actions

$changed = $false
if (-not $cond.PSObject.Properties['Compose_SalespersonCode']) {
  $comp = [pscustomobject]@{
    type   = 'Compose'
    inputs = "@first(body('List_records_SalesLines')?['value'])?['salespersonCode']"
    runAfter = [pscustomobject]@{}
  }
  $cond | Add-Member -NotePropertyName 'Compose_SalespersonCode' -NotePropertyValue $comp
  $changed = $true
  Write-Host "  + added Compose_SalespersonCode" -ForegroundColor Green
} else { Write-Host "  = Compose_SalespersonCode already present" -ForegroundColor Yellow }

function Add-SalesItem($updateAction, $label) {
  if ($null -eq $updateAction) { Write-Host ("  ! {0} not found" -f $label) -ForegroundColor Red; return }
  $params = $updateAction.inputs.parameters
  if (-not $params.PSObject.Properties['item/crfdf_salespersoncode']) {
    $params | Add-Member -NotePropertyName 'item/crfdf_salespersoncode' -NotePropertyValue "@outputs('Compose_SalespersonCode')"
    $script:changed = $true
    Write-Host ("  + wrote item/crfdf_salespersoncode in {0}" -f $label) -ForegroundColor Green
  } else { Write-Host ("  = {0} already writes salespersoncode" -f $label) -ForegroundColor Yellow }
}

$cond1 = $root.Condition_1
Add-SalesItem $cond1.actions.Update_a_row_1 'Update_a_row_1'
$elseNode = $cond1.PSObject.Properties['else'].Value
Add-SalesItem $elseNode.actions.Update_a_row_2 'Update_a_row_2'

if (-not $changed) { Write-Host "Nothing to change - flow already patched." -ForegroundColor Yellow; return }

# --- PATCH back ---------------------------------------------------------------
$newClientData = $cd | ConvertTo-Json -Depth 100 -Compress
$null = $newClientData | ConvertFrom-Json   # validate
$body = @{ clientdata = $newClientData } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Patch -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Headers $headers -Body $body | Out-Null
Write-Host "Patched BCSync_SalesLines." -ForegroundColor Green
Write-Host "Next: open BCSync_SalesLines in Power Automate and click Run, then re-check the app." -ForegroundColor Cyan
