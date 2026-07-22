<#
  Read-only diagnostic: resolve the employee + department the "PERSIST TEST 0722"
  group card points at (emp bd039bc8-…, dept acbdda7f-…) and list ALL production
  employees + departments so we can see whether that employee actually renders in
  a department band (if not, the loaded card is orphaned and never drawn).

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
#>
$ErrorActionPreference = 'Stop'
$tenant='fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'; $org='https://org8fa22efd.crm.dynamics.com'
$clientId='04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" -Body @{ client_id=$clientId; scope="$org/.default offline_access" }
Write-Host "`n==> $($dc.message)`n" -ForegroundColor Cyan
$token=$null; $deadline=(Get-Date).AddSeconds([int]$dc.expires_in)
while(-not $token -and (Get-Date) -lt $deadline){ Start-Sleep -Seconds ([int]$dc.interval)
  try{ $r=Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" -Body @{grant_type='urn:ietf:params:oauth:grant-type:device_code';client_id=$clientId;device_code=$dc.device_code}; $token=$r.access_token }
  catch{ $e=($_.ErrorDetails.Message|ConvertFrom-Json).error; if($e -ne 'authorization_pending' -and $e -ne 'slow_down'){throw} } }
if(-not $token){throw "timed out"}
Write-Host "Authenticated.`n" -ForegroundColor Green
$h=@{Authorization="Bearer $token";'OData-MaxVersion'='4.0';'OData-Version'='4.0';Accept='application/json'}

Write-Host "=== DEPARTMENTS (crfdf_department1) ===" -ForegroundColor Cyan
$d=Invoke-RestMethod -Method Get -Uri "$org/api/data/v9.2/crfdf_department1s?`$select=crfdf_department1id,crfdf_departmentname,crfdf_floworder" -Headers $h
$d.value | ForEach-Object { Write-Host ("  {0}  {1}  flow={2}" -f $_.crfdf_department1id, $_.crfdf_departmentname, $_.crfdf_floworder) }

Write-Host "`n=== EMPLOYEES (crfdf_employee1) ===" -ForegroundColor Cyan
$e=Invoke-RestMethod -Method Get -Uri "$org/api/data/v9.2/crfdf_employee1s?`$select=crfdf_employee1id,crfdf_employeename,crfdf_departmentname,_crfdf_department_value" -Headers $h
$e.value | ForEach-Object { Write-Host ("  {0}  {1}  deptVal={2}  deptName={3}" -f $_.crfdf_employee1id, $_.crfdf_employeename, $_.'_crfdf_department_value', $_.crfdf_departmentname) }

Write-Host "`n=== TARGETS from PERSIST card ===" -ForegroundColor Yellow
Write-Host "  card emp  = bd039bc8-fe42-f111-88b4-000d3a5ad402"
Write-Host "  card dept = acbdda7f-7d42-f111-88b4-70a8a59d2821"
Write-Host "`nDone." -ForegroundColor Cyan
