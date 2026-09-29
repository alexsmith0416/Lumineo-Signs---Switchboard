<#
  Fills crfdf_no (the BC Resource No.) on production roster rows the
  add-employee-resourceno-column.ps1 back-fill missed because the roster name
  is spelled differently from the app-user / BC name. Values confirmed against
  AppUser-EmployeeList.xlsx on Sep 28, 2026:

    roster "Len Cook"      = BC "Len Cook Jr"   -> 1143
    roster "Aiden Haskill" = BC "Aiden Haskell" -> 1152

  Only crfdf_no is written — names are deliberately left as they are. Each row
  is read first and skipped unless its name matches what's expected here.

  Same device-code auth as the other create-/add- scripts.
#>
$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

$fixes = @(
  @{ Id = 'c0267757-5675-4af4-8b5d-64bac82c8471'; Name = 'Len Cook';      No = '1143' },
  @{ Id = '033d3e82-ec99-f111-b8db-7ced8d712dbc'; Name = 'Aiden Haskill'; No = '1152' }
)

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

$headers = @{ Authorization="Bearer $token"; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0'; Accept='application/json' }
$base = "$org/api/data/v9.2/crfdf_employee1s"

foreach ($f in $fixes) {
  $row = Invoke-RestMethod -Uri "$base($($f.Id))?`$select=crfdf_employeename,crfdf_no" -Headers $headers
  if ($row.crfdf_employeename -ne $f.Name) {
    "SKIP $($f.Id): name is '$($row.crfdf_employeename)', expected '$($f.Name)'"; continue
  }
  if ($row.crfdf_no -eq $f.No) { "= $($f.Name) already $($f.No)"; continue }
  Invoke-RestMethod -Method Patch -Uri "$base($($f.Id))" -Headers $headers -Body (@{ crfdf_no = $f.No } | ConvertTo-Json) | Out-Null
  $after = Invoke-RestMethod -Uri "$base($($f.Id))?`$select=crfdf_no" -Headers $headers
  "OK $($f.Name): crfdf_no '$($row.crfdf_no)' -> '$($after.crfdf_no)'"
}
