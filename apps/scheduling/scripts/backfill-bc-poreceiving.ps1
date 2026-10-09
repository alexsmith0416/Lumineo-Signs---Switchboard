<#
  Sends the PO receiving entered BEFORE the BCPush_PoReceipts /
  BCPush_PoDeliveries flows were turned on to Business Central.

  Those flows fire when a crfdf_poreceipt / crfdf_podelivery row is added or
  modified, so rows saved earlier never reached BC. -Apply re-saves each row
  with its own name (crfdf_name = itself): nothing changes in the app, but the
  update fires the flows, which re-read the row and upsert it in BC.

  Run AFTER: BC ext v1.0.0.17 is published AND both flows are ON. Re-running is
  harmless (the flows upsert). Dry run by default — lists what would be sent.
  Device-code sign-in as asmith@lumineosigns.com.
#>
param(
  [switch]$Apply,
  # Optional file to keep the sign-in between the dry run and -Apply (OUTSIDE the repo).
  [string]$TokenCache = ''
)

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

$resp = $null
if ($TokenCache -and (Test-Path $TokenCache)) {
  try {
    $cached = Get-Content $TokenCache -Raw | ConvertFrom-Json
    $resp = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type = 'refresh_token'; client_id = $clientId; refresh_token = $cached.refresh_token; scope = "$org/.default offline_access" }
  } catch { $resp = $null }
}
if (-not $resp) {
  $dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
    -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }
  Write-Host ""; Write-Host "==> $($dc.message)" -ForegroundColor Cyan; Write-Host ""
  $deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
  while (-not $resp -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds ([int]$dc.interval)
    try {
      $resp = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
        -Body @{ grant_type='urn:ietf:params:oauth:grant-type:device_code'; client_id=$clientId; device_code=$dc.device_code }
    } catch { $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error; if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw } }
  }
}
if (-not $resp) { throw "Device-code login timed out." }
if ($TokenCache) { $resp | ConvertTo-Json | Set-Content $TokenCache }
$token = $resp.access_token
Write-Host "Authenticated." -ForegroundColor Green
$h = @{ Authorization = "Bearer $token"; Accept = 'application/json'; 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0' }
$api = "$org/api/data/v9.2"

function Get-All($url) {
  $rows = @()
  while ($url) { $r = Invoke-RestMethod -Uri $url -Headers $h; $rows += $r.value; $url = $r.'@odata.nextLink' }
  return $rows
}

$receipts   = Get-All "$api/crfdf_poreceipts?`$select=crfdf_poreceiptid,crfdf_name,crfdf_pono,crfdf_jobno,crfdf_vendorstatus"
$deliveries = Get-All "$api/crfdf_podeliveries?`$select=crfdf_podeliveryid,crfdf_name,crfdf_pono,crfdf_receiveddate,crfdf_location,crfdf_final"

Write-Host ""
Write-Host ("PO receipts: {0}   deliveries: {1}" -f $receipts.Count, $deliveries.Count) -ForegroundColor Cyan
foreach ($r in $receipts | Sort-Object crfdf_jobno, crfdf_pono) {
  Write-Host ("  receipt  {0,-12} {1,-10} {2}" -f $r.crfdf_pono, $r.crfdf_jobno, $r.crfdf_vendorstatus)
}
foreach ($d in $deliveries | Sort-Object crfdf_pono, crfdf_receiveddate) {
  Write-Host ("  delivery {0,-12} {1}  {2}{3}" -f $d.crfdf_pono, $d.crfdf_receiveddate, $d.crfdf_location, $(if ($d.crfdf_final) { '  (final)' } else { '' }))
}

if (-not $Apply) { Write-Host ""; Write-Host "Dry run — nothing changed. -Apply re-saves these so the flows send them to BC." -ForegroundColor Cyan; return }

$hw = $h.Clone(); $hw['Content-Type'] = 'application/json'; $hw['If-Match'] = '*'
$n = 0
foreach ($r in $receipts) {
  $body = @{ crfdf_name = $r.crfdf_name } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Headers $hw -Uri "$api/crfdf_poreceipts($($r.crfdf_poreceiptid))" -Body $body | Out-Null
  $n++
}
foreach ($d in $deliveries) {
  $body = @{ crfdf_name = $d.crfdf_name } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Headers $hw -Uri "$api/crfdf_podeliveries($($d.crfdf_podeliveryid))" -Body $body | Out-Null
  $n++
}
Write-Host ""
Write-Host "Re-saved $n rows. Watch the BCPush_PoReceipts / BCPush_PoDeliveries run history; they go one at a time." -ForegroundColor Green
