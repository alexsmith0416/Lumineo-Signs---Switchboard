<#
  Teaches the BCSync_SalesLines flow three things from the job's BC Sales Order
  (the List_SalesOrder step it already runs):
    1. Compose_SalesOrderAmount = salesOrder.totalAmountExcludingTax, written to
       crfdf_bcjobs.crfdf_salesorderamount (the Jobs list "Value" column).
    2. Compose_OrderSalesperson = salesOrder.salesperson. The salesperson code
       written to crfdf_salespersoncode prefers it over the sales LINE's code,
       which is blank on most jobs.
    3. Compose_ShipToName falls back to the order's customer name when the
       ship-to name is blank (those jobs were named after their job number).
  Both Update_a_row_1 (customer found) and Update_a_row_2 (not found) write the
  new values.

  Fetches the live flow's clientdata, backs it up, edits it in place and PATCHes
  it back via the Web API with a device-code token. Idempotent.

  It also adds Compose_SalespersonCode (the sales line's code) if missing, and
  has List_rows_BC_Jobs read crfdf_salespersoncode so a job with no salesperson
  on its order or line keeps the code it already has.

  PREREQUISITE: add-jobs-name-value-columns.ps1 (creates crfdf_salesorderamount).
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  AFTER it succeeds: open BCSync_SalesLines in Power Automate and click Run (or
  wait for tonight's 1:30 AM run) so the amounts populate.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowName = 'BCSync_SalesLines'
$bakFile  = Join-Path $PSScriptRoot ('..\flows\saleslines-clientdata-backup-{0}.json' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

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

$wf.clientdata | Out-File -FilePath $bakFile -Encoding utf8
Write-Host ("Backed up current clientdata -> {0}" -f $bakFile) -ForegroundColor Green

$cd   = $wf.clientdata | ConvertFrom-Json
$root = $cd.properties.definition.actions.Apply_to_each_BC_Job.actions
$cond = $root.Condition.actions
if (-not $cond.PSObject.Properties['List_SalesOrder']) { throw "List_SalesOrder not found in Condition - flow shape changed." }
$changed = $false

$order = "first(body('List_SalesOrder')?['value'])"

function Add-Compose($name, $inputs, $after) {
  if ($cond.PSObject.Properties[$name]) { Write-Host "  = $name already present" -ForegroundColor Yellow; return }
  $ra = [pscustomobject]@{}; $ra | Add-Member -NotePropertyName $after -NotePropertyValue @('Succeeded')
  $cond | Add-Member -NotePropertyName $name -NotePropertyValue ([pscustomobject]@{ type='Compose'; inputs=$inputs; runAfter=$ra })
  $script:changed = $true
  Write-Host "  + added $name" -ForegroundColor Green
}

Add-Compose 'Compose_OrderSalesperson' "@${order}?['salesperson']" 'Compose_ShipToZip'
Add-Compose 'Compose_SalesOrderAmount' "@${order}?['totalAmountExcludingTax']" 'Compose_OrderSalesperson'
Add-Compose 'Compose_SalespersonCode' "@first(body('List_records_SalesLines')?['value'])?['salespersonCode']" 'Compose_SalesOrderAmount'

# The job loop must read the job's current code, so a job whose order and
# line both have no salesperson keeps the one it has instead of being blanked.
$listJobs = $cd.properties.definition.actions.List_rows_BC_Jobs.inputs.parameters
$sel = [string]$listJobs.'$select'
if ($sel -and ($sel -split ',') -notcontains 'crfdf_salespersoncode') {
  $listJobs.'$select' = "$sel,crfdf_salespersoncode"
  $changed = $true
  Write-Host "  + List_rows_BC_Jobs reads crfdf_salespersoncode" -ForegroundColor Green
} else { Write-Host "  = List_rows_BC_Jobs already reads crfdf_salespersoncode" -ForegroundColor Yellow }

# Ship-to name, else the order's customer name.
$shipTo = "@if(empty(${order}?['shipToName']), ${order}?['customerName'], ${order}?['shipToName'])"
if ($cond.Compose_ShipToName.inputs -ne $shipTo) {
  $cond.Compose_ShipToName.inputs = $shipTo
  $changed = $true
  Write-Host "  + Compose_ShipToName falls back to the order's customer name" -ForegroundColor Green
} else { Write-Host "  = Compose_ShipToName already falls back" -ForegroundColor Yellow }

# The order's salesperson, else the sales line's, else what the job already has.
$salesperson = "@if(empty(outputs('Compose_OrderSalesperson')), if(empty(outputs('Compose_SalespersonCode')), items('Apply_to_each_BC_Job')?['crfdf_salespersoncode'], outputs('Compose_SalespersonCode')), outputs('Compose_OrderSalesperson'))"
function Set-Item($updateAction, $label, $field, $value) {
  if ($null -eq $updateAction) { Write-Host ("  ! {0} not found" -f $label) -ForegroundColor Red; return }
  $params = $updateAction.inputs.parameters
  $p = $params.PSObject.Properties[$field]
  if ($p -and $p.Value -eq $value) { Write-Host ("  = {0} already writes {1}" -f $label, $field) -ForegroundColor Yellow; return }
  if ($p) { $p.Value = $value } else { $params | Add-Member -NotePropertyName $field -NotePropertyValue $value }
  $script:changed = $true
  Write-Host ("  + {0} writes {1}" -f $label, $field) -ForegroundColor Green
}

$cond1 = $root.Condition_1
$u1 = $cond1.actions.Update_a_row_1
$u2 = $cond1.PSObject.Properties['else'].Value.actions.Update_a_row_2
foreach ($u in @(@($u1, 'Update_a_row_1'), @($u2, 'Update_a_row_2'))) {
  Set-Item $u[0] $u[1] 'item/crfdf_salesorderamount' "@outputs('Compose_SalesOrderAmount')"
  Set-Item $u[0] $u[1] 'item/crfdf_salespersoncode' $salesperson
}

if (-not $changed) { Write-Host "Nothing to change - flow already patched." -ForegroundColor Yellow; return }

# --- PATCH back ---------------------------------------------------------------
$newClientData = $cd | ConvertTo-Json -Depth 100 -Compress
$null = $newClientData | ConvertFrom-Json   # validate
$body = @{ clientdata = $newClientData } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Patch -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Headers $headers -Body $body | Out-Null
Write-Host "Patched BCSync_SalesLines." -ForegroundColor Green
Write-Host "Next: open BCSync_SalesLines in Power Automate and click Run (or wait for tonight's run)." -ForegroundColor Cyan
