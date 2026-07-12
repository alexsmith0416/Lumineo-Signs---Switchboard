<#
  READ-ONLY: prints lum_weathercaches rows for ZIP 67460 (and totals) so we can see
  whether the reworked flow wrote per-day forecast rows and how lum_date is stored.
  Device-code auth (az is blocked). Sign in as asmith@lumineosigns.com.
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
$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }
$outFile = Join-Path $PSScriptRoot '..\flows\weather-rows-out.txt'
$lines = New-Object System.Collections.Generic.List[string]
function Emit($s){ Write-Host $s; $lines.Add($s) }

$sel = 'lum_location,lum_date,lum_tempf,lum_conditiontext,lum_humidity,lum_lastupdated'

Emit "--- Rows for ZIP 67460 ---"
$u1 = "$org/api/data/v9.2/lum_weathercaches?`$select=$sel&`$filter=lum_location eq '67460'&`$orderby=lum_date asc"
$r1 = Invoke-RestMethod -Method Get -Uri $u1 -Headers $headers
if (-not $r1.value -or $r1.value.Count -eq 0) { Emit "  (no rows for 67460)" }
foreach ($row in $r1.value) {
  $d = if ($null -ne $row.lum_date) { $row.lum_date } else { '<null>' }
  Emit ("  date={0,-12} temp={1,-5} cond={2,-26} hum={3} updated={4}" -f `
    $d, $row.lum_tempf, $row.lum_conditiontext, $row.lum_humidity, $row.lum_lastupdated)
}

Emit "--- Totals ---"
$rAll = Invoke-RestMethod -Method Get -Headers $headers `
  -Uri "$org/api/data/v9.2/lum_weathercaches?`$select=lum_date&`$top=5000"
$dated   = @($rAll.value | Where-Object { $_.lum_date }).Count
$dateless= @($rAll.value | Where-Object { -not $_.lum_date }).Count
Emit ("  total rows={0}  dated={1}  dateless(legacy)={2}" -f $rAll.value.Count, $dated, $dateless)

$lines -join "`n" | Out-File -FilePath $outFile -Encoding utf8
Write-Host ("`nWrote results -> {0}" -f $outFile) -ForegroundColor Green
