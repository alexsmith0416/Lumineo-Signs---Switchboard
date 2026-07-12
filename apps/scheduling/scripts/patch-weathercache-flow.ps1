<#
  Applies the reworked WeatherCache_Refresh definition (NWS 7-day per-day forecast)
  by PATCHing the workflow row's clientdata via the Web API with a device-code token.
  Backs up the current definition first (weathercache-clientdata-backup.json) so it
  can be restored. Safe to re-run (idempotent overwrite).

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowsDir = Join-Path $PSScriptRoot '..\flows'
$idFile   = Join-Path $flowsDir 'weathercache-workflowid.txt'
$newFile  = Join-Path $flowsDir 'weathercache-clientdata-new.json'
$bakFile  = Join-Path $flowsDir 'weathercache-clientdata-backup.json'

if (-not (Test-Path $idFile))  { throw "Missing $idFile - run dump-weathercache-flow.ps1 first." }
if (-not (Test-Path $newFile)) { throw "Missing $newFile" }
$wfId = (Get-Content $idFile -Raw).Trim()
$new  = Get-Content $newFile -Raw
$null = $new | ConvertFrom-Json   # fail fast if the new definition isn't valid JSON

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
$wfUri = "$org/api/data/v9.2/workflows($wfId)"

# --- Back up current clientdata ----------------------------------------------
$cur = Invoke-RestMethod -Method Get -Uri "$wfUri`?`$select=clientdata,statecode,statuscode" -Headers $headers
$cur.clientdata | Out-File -FilePath $bakFile -Encoding utf8
Write-Host ("Backed up current definition -> {0}  (statecode={1})" -f $bakFile, $cur.statecode) -ForegroundColor Green

# --- PATCH the new definition -------------------------------------------------
$body = @{ clientdata = $new } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Patch -Uri $wfUri -Headers $headers -Body $body | Out-Null
Write-Host "Patched WeatherCache_Refresh with the NWS 7-day definition." -ForegroundColor Green
Write-Host "Next: open the flow in Power Automate and click Run (or wait for the 6-hour schedule), then check for a Succeeded run." -ForegroundColor Cyan
