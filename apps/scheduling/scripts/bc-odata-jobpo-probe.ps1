<#
  bc-odata-jobpo-probe.ps1 — READ-ONLY probe of the job purchase-order API
  queries in bc/lumineo-planning-ext (v1.0.0.8+), under api/lumineo/planning/v1.0:
    query 58401 "Lumineo Job POs"        → jobPurchaseOrders        (open POs)
    query 58402 "Lumineo Job PO Archive" → jobPurchaseOrderArchives (archived POs)
  (v1.0.0.6/7 had them as web-service queries; BC never exposed those over OData.)

  Checks, for each service:
    1. it answers, and how many (job, PO) rows it returns
    2. a job's rows with a server-side $filter on jobNo
  Then merges the two the way the sync flow will (one row per job + PO, open
  wins over archived, highest archive version wins) and prints the job's list.

  Writes nothing.

      pwsh -File scripts/bc-odata-jobpo-probe.ps1
      pwsh -File scripts/bc-odata-jobpo-probe.ps1 -Job J36110
#>
param(
  [string]$Company = 'Luminous Neon',
  [string]$Job     = ''
)

$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }

$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token

$hg   = @{ Authorization = "Bearer $tok" }
$api  = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/api"
$coId = ((Invoke-RestMethod -Uri "$api/v2.0/companies" -Headers $hg).value | Where-Object name -eq $Company).id
$base = "$api/lumineo/planning/v1.0/companies($coId)"

function Fmt-Err($e) {
  $code = $null
  try { $code = [int]$e.Exception.Response.StatusCode } catch {}
  $body = ($e.ErrorDetails.Message -replace '\s+',' ').Trim()
  if (-not $body) { $body = $e.Exception.Message }
  if ($code) { "HTTP $code — $body" } else { $body }
}

# Follows @odata.nextLink so a large result isn't cut at the page size.
function Get-All($url) {
  $out = @()
  while ($url) {
    $r = Invoke-RestMethod -Uri $url -Headers $hg
    $out += $r.value
    $url = $r.'@odata.nextLink'
  }
  $out
}

"ENV      $($m.environment)   company='$Company'"
""

$open = @(); $arch = @()
"===== TEST 1: jobPurchaseOrders (open purchase orders)"
try {
  $open = @(Get-All "$base/jobPurchaseOrders")
  "  $($open.Count) (job, PO) rows across $(@($open.jobNo | Sort-Object -Unique).Count) jobs"
  $open | Select-Object -First 5 | Format-Table jobNo, documentNo, buyFromVendorName, orderDate, status, lineCount, amount -AutoSize | Out-String -Width 300
} catch { "  FAILS: " + (Fmt-Err $_) }

"===== TEST 2: jobPurchaseOrderArchives (archived purchase orders)"
try {
  $arch = @(Get-All "$base/jobPurchaseOrderArchives")
  "  $($arch.Count) (job, PO, version) rows across $(@($arch.jobNo | Sort-Object -Unique).Count) jobs"
  $arch | Select-Object -First 5 | Format-Table jobNo, documentNo, buyFromVendorName, orderDate, versionNo -AutoSize | Out-String -Width 300
} catch { "  FAILS: " + (Fmt-Err $_) }

# Pick a job that has both kinds, if none was given.
if (-not $Job) {
  $both = @($open.jobNo | Sort-Object -Unique) | Where-Object { $arch.jobNo -contains $_ } | Select-Object -First 1
  $Job = if ($both) { $both } elseif ($open) { $open[0].jobNo } elseif ($arch) { $arch[0].jobNo } else { '' }
}
if (-not $Job) { "No rows in either service — nothing more to check."; return }

"===== TEST 3: server-side filter on jobNo = $Job"
$f = [uri]::EscapeDataString("jobNo eq '$Job'")
foreach ($svc in 'jobPurchaseOrders', 'jobPurchaseOrderArchives') {
  try { "  {0,-20} {1} rows" -f $svc, @((Invoke-RestMethod -Uri "$base/$svc`?`$filter=$f" -Headers $hg).value).Count }
  catch { "  {0,-20} FAILS: {1}" -f $svc, (Fmt-Err $_) }
}
""

"===== Merged list for $Job (what the app will show)"
$merged = @{}
foreach ($r in ($arch | Where-Object jobNo -eq $Job | Sort-Object versionNo)) {
  $merged[$r.documentNo] = [pscustomobject]@{ PO = $r.documentNo; Vendor = $r.buyFromVendorName; Ordered = $r.orderDate; State = 'Archived' }
}
foreach ($r in ($open | Where-Object jobNo -eq $Job)) {
  $merged[$r.documentNo] = [pscustomobject]@{ PO = $r.documentNo; Vendor = $r.buyFromVendorName; Ordered = $r.orderDate; State = "Open ($($r.status))" }
}
$merged.Values | Sort-Object Ordered -Descending | Format-Table -AutoSize | Out-String -Width 300
