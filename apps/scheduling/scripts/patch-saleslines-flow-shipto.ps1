<#
  Makes the Jobs list's Location the job's SHIP-TO city and state (the install
  address). BCSync_Jobs (midnight) fills crfdf_shiptocity / state / address
  from the BILL-TO customer; this teaches BCSync_SalesLines (1:30 AM, runs
  after it) to overwrite them with the Sales Order's ship-to when the order
  has one:
    1. adds Compose_ShipToCity / Compose_ShipToState / Compose_ShipToAddress
       (from List_SalesOrder), and
    2. writes item/crfdf_shiptocity / shiptostate / shiptoaddress in both
       Update_a_row_1 and Update_a_row_2 - the order's value, else the value
       the job already has (List_rows_BC_Jobs now reads those columns), so a
       job with no ship-to on its order keeps the customer's address.

  Fetches the live flow's clientdata, backs it up, edits it in place and PATCHes
  it back via the Web API with a device-code token. Idempotent.
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  AFTER it succeeds: run BCSync_SalesLines (or wait for tonight's run).
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
$last = if ($cond.PSObject.Properties['Compose_SalesOrderAmount']) { 'Compose_SalesOrderAmount' } else { 'Compose_ShipToZip' }
Add-Compose 'Compose_ShipToCity'    "@${order}?['shipToCity']"         $last
Add-Compose 'Compose_ShipToState'   "@${order}?['shipToState']"        'Compose_ShipToCity'
Add-Compose 'Compose_ShipToAddress' "@${order}?['shipToAddressLine1']" 'Compose_ShipToState'

# The job loop must read the job's current address so a blank order ship-to keeps it.
$listJobs = $cd.properties.definition.actions.List_rows_BC_Jobs.inputs.parameters
$sel = [string]$listJobs.'$select'
if ($sel) {
  $cols = @($sel -split ',')
  $need = @('crfdf_shiptocity', 'crfdf_shiptostate', 'crfdf_shiptoaddress') | Where-Object { $cols -notcontains $_ }
  if ($need) {
    $listJobs.'$select' = (@($cols) + @($need)) -join ','
    $changed = $true
    Write-Host ("  + List_rows_BC_Jobs reads {0}" -f ($need -join ', ')) -ForegroundColor Green
  } else { Write-Host "  = List_rows_BC_Jobs already reads the address" -ForegroundColor Yellow }
}

function Keep-Or($compose, $col) {
  "@if(empty(outputs('$compose')), items('Apply_to_each_BC_Job')?['$col'], outputs('$compose'))"
}
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
  Set-Item $u[0] $u[1] 'item/crfdf_shiptocity'    (Keep-Or 'Compose_ShipToCity' 'crfdf_shiptocity')
  Set-Item $u[0] $u[1] 'item/crfdf_shiptostate'   (Keep-Or 'Compose_ShipToState' 'crfdf_shiptostate')
  Set-Item $u[0] $u[1] 'item/crfdf_shiptoaddress' (Keep-Or 'Compose_ShipToAddress' 'crfdf_shiptoaddress')
}

if (-not $changed) { Write-Host "Nothing to change - flow already patched." -ForegroundColor Yellow; return }

# --- PATCH back ---------------------------------------------------------------
$newClientData = $cd | ConvertTo-Json -Depth 100 -Compress
$null = $newClientData | ConvertFrom-Json   # validate
$body = @{ clientdata = $newClientData } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Patch -Uri "$org/api/data/v9.2/workflows($($wf.workflowid))" -Headers $headers -Body $body | Out-Null
Write-Host "Patched BCSync_SalesLines." -ForegroundColor Green
Write-Host "Next: open BCSync_SalesLines in Power Automate and click Run (or wait for tonight's run)." -ForegroundColor Cyan
