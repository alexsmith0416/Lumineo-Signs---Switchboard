<#
  READ-ONLY: dumps the WeatherCache_Refresh cloud-flow definition (the workflow
  row's clientdata) to apps/scheduling/flows/weathercache-clientdata.json so it can
  be reworked offline and patched back. Uses a device-code token (az is blocked).

  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$outDir   = Join-Path $PSScriptRoot '..\flows'
$outFile  = Join-Path $outDir 'weathercache-clientdata.json'
$idFile   = Join-Path $outDir 'weathercache-workflowid.txt'

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

$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }

# Modern cloud flows are category=5. Grab every workflow row named WeatherCache_Refresh.
$uri = "$org/api/data/v9.2/workflows?`$filter=category eq 5 and name eq 'WeatherCache_Refresh'&`$select=workflowid,name,statecode,statuscode,clientdata"
$res = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers

if (-not $res.value -or $res.value.Count -eq 0) { throw "No WeatherCache_Refresh workflow found." }

# Prefer the activated (statecode=1) row; else the first.
$wf = ($res.value | Where-Object { $_.statecode -eq 1 } | Select-Object -First 1)
if (-not $wf) { $wf = $res.value[0] }

Write-Host ("Found workflow {0}  statecode={1}  ({2} row(s) total)" -f $wf.workflowid, $wf.statecode, $res.value.Count) -ForegroundColor Green
$wf.clientdata | Out-File -FilePath $outFile -Encoding utf8
$wf.workflowid | Out-File -FilePath $idFile -Encoding utf8
Write-Host ("Wrote clientdata -> {0}" -f $outFile) -ForegroundColor Green
Write-Host ("Wrote workflowid -> {0}" -f $idFile) -ForegroundColor Green
