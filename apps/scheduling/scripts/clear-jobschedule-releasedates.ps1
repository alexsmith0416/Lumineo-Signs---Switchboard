<#
  One-off cleanup: clears crfdf_releaseddate on every crfdf_jobschedule row
  (the "all today" values the first flow run stamped). Leaves scheduledinstalldate
  and reddate intact. Run this AFTER importing the reverted BCSync (1.0.0.5+) so
  the flow doesn't re-stamp them.

  Uses the Web API with a device-code token. Run it, open the printed URL, enter
  the code, sign in as asmith@lumineosigns.com. Safe to re-run.
#>

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

$headers = @{ Authorization="Bearer $token"; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0'; Accept='application/json' }
$base = "$org/api/data/v9.2"

# Page through all rows that currently have a release date.
$cleared = 0
$url = "$base/crfdf_jobschedules?`$select=crfdf_jobscheduleid,crfdf_releaseddate&`$filter=crfdf_releaseddate ne null"
while ($url) {
  $page = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
  foreach ($row in $page.value) {
    $id = $row.crfdf_jobscheduleid
    Invoke-RestMethod -Method Patch -Uri "$base/crfdf_jobschedules($id)" -Headers $headers `
      -Body (@{ crfdf_releaseddate = $null } | ConvertTo-Json) | Out-Null
    $cleared++
  }
  $url = $page.'@odata.nextLink'
}
Write-Host ("Cleared release date on {0} row(s)." -f $cleared) -ForegroundColor Green
