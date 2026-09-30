<#
  Takes a job off the Jobs list: deletes its crfdf_jobtrack row (status,
  hold, custom field values, manual name...). The BC side (crfdf_bcjobs, its
  planning lines, its stepper) is untouched, so an open job still shows as
  "Not tracked yet".

  Used to clean up after testing BCSync_NewOrders. ⚠️ Uncheck the job's New
  Order This Week "Started" in BC first, or the flow adds it back within 15
  minutes.

    pwsh scripts/remove-jobtrack.ps1 -JobNo J38330          # shows what it would delete
    pwsh scripts/remove-jobtrack.ps1 -JobNo J38330 -Apply   # deletes it

  Uses the Web API with a device-code token (az is blocked by the proxy).
  Sign in as asmith@lumineosigns.com.
#>
param(
  [Parameter(Mandatory = $true)][string]$JobNo,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

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

$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }
$job = $JobNo.Trim().Replace("'", "''")
$rows = (Invoke-RestMethod -Headers $headers -Uri "$org/api/data/v9.2/crfdf_jobtracks?`$select=crfdf_jobtrackid,crfdf_jobno,crfdf_statusoverride,createdon&`$filter=crfdf_jobno eq '$job'").value
if (-not $rows) { Write-Host "$JobNo isn't on the Jobs list - nothing to remove." -ForegroundColor Yellow; return }
foreach ($r in $rows) {
  Write-Host ("  {0}  status '{1}'  created {2}  ({3})" -f $r.crfdf_jobno, $r.crfdf_statusoverride, $r.createdon, $r.crfdf_jobtrackid)
}
if (-not $Apply) { Write-Host "Dry run - add -Apply to delete." -ForegroundColor Cyan; return }
foreach ($r in $rows) {
  Invoke-RestMethod -Method Delete -Headers $headers -Uri "$org/api/data/v9.2/crfdf_jobtracks($($r.crfdf_jobtrackid))" | Out-Null
  Write-Host ("  - removed {0}" -f $r.crfdf_jobno) -ForegroundColor Green
}
