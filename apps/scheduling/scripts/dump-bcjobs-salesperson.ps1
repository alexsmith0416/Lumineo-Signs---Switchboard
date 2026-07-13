<#
  Read-only check that BCSync_SalesLines populated crfdf_bcjobs.crfdf_salespersoncode.
  Reports how many jobs have a code vs blank and prints a few samples grouped by code.
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

$rows = @()
$uri = "$org/api/data/v9.2/crfdf_bcjobs?`$select=crfdf_jobnumber,crfdf_salespersoncode"
do {
  $page = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  $rows += $page.value
  $uri = $page.'@odata.nextLink'
} while ($uri)

$withCode = $rows | Where-Object { $_.crfdf_salespersoncode }
Write-Host ("`nTotal jobs: {0}   with salesperson code: {1}   blank: {2}" -f $rows.Count, $withCode.Count, ($rows.Count - $withCode.Count)) -ForegroundColor Cyan

Write-Host "`nCount by salesperson code:" -ForegroundColor Cyan
$withCode | Group-Object crfdf_salespersoncode | Sort-Object Count -Descending |
  ForEach-Object { "{0,-16} {1}" -f $_.Name, $_.Count }

Write-Host "`nSample (first 12 with a code):" -ForegroundColor Cyan
$withCode | Select-Object -First 12 | ForEach-Object { "{0,-12} {1}" -f $_.crfdf_jobnumber, $_.crfdf_salespersoncode }
