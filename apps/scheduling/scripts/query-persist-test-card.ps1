<#
  Read-only diagnostic: look up the "PERSIST TEST 0722" production schedule line
  that the browser test created, to see what actually persisted to Dataverse:
    - does the row exist at all?  (did createScheduleLine succeed on live?)
    - crfdf_iscustom               (must be true for parseGroup to render it as a group)
    - crfdf_planninglinedescription (the grp:v1: JSON payload — intact?)
    - the employee/department lookups + start date

  Also dumps ALL crfdf_iscustom=true lines so we can compare a working team card
  ("DC Load Jobs") against the individual-lane card under test.

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Nothing is written.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

$dc = Invoke-RestMethod -Method Post `
  -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }
Write-Host ""
Write-Host "==> $($dc.message)" -ForegroundColor Cyan
Write-Host ""

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

$headers = @{
  Authorization      = "Bearer $token"
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
  Prefer            = 'odata.include-annotations="*"'
}
$base = "$org/api/data/v9.2/crfdf_productionschedulelines"
$sel  = '$select=crfdf_customername,crfdf_jobno,crfdf_iscustom,crfdf_planninglinedescription,crfdf_startdatetime,crfdf_departmentwide,_crfdf_employee_value,_crfdf_department_value'

Write-Host ""
Write-Host "=== Rows named 'PERSIST TEST 0722' ===" -ForegroundColor Cyan
$q = "$base`?$sel&`$filter=crfdf_customername eq 'PERSIST TEST 0722'"
$r = Invoke-RestMethod -Method Get -Uri $q -Headers $headers
if ($r.value.Count -eq 0) {
  Write-Host "  NONE FOUND — createScheduleLine did NOT persist this row." -ForegroundColor Red
} else {
  $r.value | ForEach-Object {
    Write-Host ("  name={0} | iscustom={1} | deptwide={2} | emp={3} | dept={4}" -f `
      $_.crfdf_customername, $_.crfdf_iscustom, $_.crfdf_departmentwide, $_.'_crfdf_employee_value', $_.'_crfdf_department_value') -ForegroundColor Green
    Write-Host ("    start={0}" -f $_.crfdf_startdatetime)
    Write-Host ("    planningLineDescription=[{0}]" -f $_.crfdf_planninglinedescription) -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== ALL crfdf_iscustom=true lines (compare team 'DC Load Jobs' vs individual) ===" -ForegroundColor Cyan
$q2 = "$base`?$sel&`$filter=crfdf_iscustom eq true"
$r2 = Invoke-RestMethod -Method Get -Uri $q2 -Headers $headers
Write-Host ("  count = {0}" -f $r2.value.Count)
$r2.value | ForEach-Object {
  $desc = [string]$_.crfdf_planninglinedescription
  if ($desc.Length -gt 60) { $desc = $desc.Substring(0,60) + '...' }
  Write-Host ("  name={0} | iscustom={1} | deptwide={2} | emp={3} | desc=[{4}]" -f `
    $_.crfdf_customername, $_.crfdf_iscustom, $_.crfdf_departmentwide, $_.'_crfdf_employee_value', $desc)
}
Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
