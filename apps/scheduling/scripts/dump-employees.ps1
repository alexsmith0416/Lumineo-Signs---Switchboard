<#
  Read-only: dumps production + installation employee working-hours settings so we
  can see why multi-day jobs may run through the weekend. Shows standardhoursperday,
  worksweekends, maxovertimeperday per employee.
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
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

$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }

function Dump($label, $set, $nameCol, $extra) {
  Write-Host "`n===== $label ($set) =====" -ForegroundColor Cyan
  try {
    $rows = (Invoke-RestMethod -Method Get -Headers $headers -Uri "$org/api/data/v9.2/$set").value
    if (-not $rows -or $rows.Count -eq 0) { Write-Host "  (no rows)"; return }
    Write-Host ("Total: {0}" -f $rows.Count)
    $ww = $rows | Where-Object { $_.crfdf_worksweekends -eq $true }
    Write-Host ("worksWeekends = TRUE: {0}" -f $ww.Count) -ForegroundColor $(if ($ww.Count -gt 0) { 'Yellow' } else { 'Green' })
    $rows | Select-Object -First 40 | ForEach-Object {
      "{0,-26} hours={1,-5} weekends={2,-6} ot={3}" -f `
        $_.$nameCol, $_.crfdf_standardhoursperday, $_.crfdf_worksweekends, $_.crfdf_maxovertimeperday
    }
  } catch { Write-Host ("  ! {0}" -f $_.Exception.Message) -ForegroundColor Red }
}

Dump 'Production employees' 'crfdf_employee1s' 'crfdf_employeename'
Dump 'Installation employees' 'crfdf_installationemployeeses' 'crfdf_employeename'
