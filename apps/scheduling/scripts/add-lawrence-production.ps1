<#
  Lawrence on the NEK Production board (Oct 17, 2026).

    1. A production department "Lawrence" (crfdf_department1) — created if
       missing. Production hides a department with nobody showing, so with only
       NEK people in it the lane shows under NEK and not under WK.
    2. Aaron Waters (crfdf_employee1) in that department — moved there if he's
       already on the roster, else created (8 h/day, productivity 1).
    3. Aaron's region = NEK in the shared "production-regions" setting
       (crfdf_jobsviews), the same one the app's Region option writes.

  Dry run by default — shows what it would do. Add -Apply to write.
    .\scripts\add-lawrence-production.ps1
    .\scripts\add-lawrence-production.ps1 -Apply

  Device-code auth (az is blocked by the proxy): open the printed URL, enter
  the code, sign in as asmith@lumineosigns.com. Safe to re-run.
#>
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'   # Azure CLI public client (device-code capable)

$DEPT_NAME = 'Lawrence'
$EMP_NAME  = 'Aaron Waters'

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

$headers = @{
  Authorization      = "Bearer $token"
  'Content-Type'     = 'application/json; charset=utf-8'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
  Prefer             = 'return=representation'
}
$base = "$org/api/data/v9.2"
$mode = if ($Apply) { 'APPLY' } else { 'DRY RUN' }
Write-Host "Mode: $mode" -ForegroundColor Cyan

function Post($set, $body) {
  Invoke-RestMethod -Method Post -Uri "$base/$set" -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 6)))
}
function Patch($set, $id, $body) {
  Invoke-RestMethod -Method Patch -Uri "$base/$set($id)" -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 6))) | Out-Null
}

# --- 1. Department ----------------------------------------------------------------
$depts = (Invoke-RestMethod -Headers $headers -Uri "$base/crfdf_department1s?`$select=crfdf_department1id,crfdf_departmentname").value
Write-Host ""; Write-Host "Production departments now: $(($depts | ForEach-Object { $_.crfdf_departmentname }) -join ', ')"
$dept = $depts | Where-Object { $_.crfdf_departmentname.Trim() -ieq $DEPT_NAME } | Select-Object -First 1
if ($dept) {
  $deptId = $dept.crfdf_department1id
  Write-Host "= department '$DEPT_NAME' already exists ($deptId)" -ForegroundColor Yellow
} elseif ($Apply) {
  $deptId = (Post 'crfdf_department1s' @{ crfdf_departmentname = $DEPT_NAME }).crfdf_department1id
  Write-Host "+ created department '$DEPT_NAME' ($deptId)" -ForegroundColor Green
} else {
  $deptId = '<new>'
  Write-Host "would create department '$DEPT_NAME'" -ForegroundColor Cyan
}

# --- 2. Employee ------------------------------------------------------------------
$emps = (Invoke-RestMethod -Headers $headers -Uri "$base/crfdf_employee1s?`$select=crfdf_employee1id,crfdf_employeename,_crfdf_department_value").value
$aarons = @($emps | Where-Object { $_.crfdf_employeename -match '(?i)\baaron\b' })
if ($aarons.Count) {
  Write-Host ""; Write-Host "Roster names with 'Aaron':"
  foreach ($m in $aarons) {
    $dn = ($depts | Where-Object { $_.crfdf_department1id -eq $m._crfdf_department_value }).crfdf_departmentname
    Write-Host ("  {0}  ({1})  dept: {2}" -f $m.crfdf_employeename, $m.crfdf_employee1id, $(if ($dn) { $dn } else { '-' }))
  }
}
$exact = @($emps | Where-Object { $_.crfdf_employeename.Trim() -ieq $EMP_NAME })
if ($exact.Count -gt 1) { throw "More than one '$EMP_NAME' on the roster — fix by hand, then re-run." }
$bind = if ($deptId -ne '<new>') { @{ 'crfdf_Department@odata.bind' = "/crfdf_department1s($deptId)" } } else { @{} }
if ($exact.Count -eq 1) {
  $empId = $exact[0].crfdf_employee1id
  if ($exact[0]._crfdf_department_value -eq $deptId) {
    Write-Host "= $EMP_NAME is already in $DEPT_NAME ($empId)" -ForegroundColor Yellow
  } elseif ($Apply) {
    Patch 'crfdf_employee1s' $empId $bind
    Write-Host "+ moved $EMP_NAME to $DEPT_NAME ($empId)" -ForegroundColor Green
  } else {
    Write-Host "would move $EMP_NAME ($empId) to $DEPT_NAME" -ForegroundColor Cyan
  }
} elseif ($Apply) {
  $body = @{ crfdf_employeename = $EMP_NAME; crfdf_standardhoursperday = 8; crfdf_productivityrate = 1 } + $bind
  $empId = (Post 'crfdf_employee1s' $body).crfdf_employee1id
  Write-Host "+ created $EMP_NAME in $DEPT_NAME ($empId)" -ForegroundColor Green
} else {
  $empId = '<new>'
  Write-Host "would create $EMP_NAME in $DEPT_NAME (8 h/day)" -ForegroundColor Cyan
}

# --- 3. Region NEK ----------------------------------------------------------------
$cfg = (Invoke-RestMethod -Headers $headers -Uri "$base/crfdf_jobsviews?`$select=crfdf_jobsviewid,crfdf_config&`$filter=crfdf_name eq 'production-regions'").value | Select-Object -First 1
$regions = @{}
if ($cfg -and $cfg.crfdf_config) {
  ($cfg.crfdf_config | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $regions[$_.Name] = $_.Value }
}
Write-Host ""; Write-Host "NEK production people now: $($regions.Count)"
if ($empId -ne '<new>' -and $regions[$empId] -eq 'NEK') {
  Write-Host "= $EMP_NAME is already NEK" -ForegroundColor Yellow
} elseif ($Apply) {
  $regions[$empId] = 'NEK'
  $json = $regions | ConvertTo-Json -Compress
  if ($cfg) { Patch 'crfdf_jobsviews' $cfg.crfdf_jobsviewid @{ crfdf_config = $json } }
  else { Post 'crfdf_jobsviews' @{ crfdf_jobsviewid = [guid]::NewGuid().ToString(); crfdf_name = 'production-regions'; crfdf_config = $json } | Out-Null }
  Write-Host "+ $EMP_NAME set to NEK" -ForegroundColor Green
} else {
  Write-Host "would set $EMP_NAME to NEK" -ForegroundColor Cyan
}

Write-Host ""; Write-Host "Done ($mode)." -ForegroundColor Cyan
