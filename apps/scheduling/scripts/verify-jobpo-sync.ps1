<#
  verify-jobpo-sync.ps1 — READ-ONLY check of the BCSync_JobPOs flow.
  Rebuilds what crfdf_jobpo SHOULD hold from BC (jobPurchaseOrders +
  jobPurchaseOrderArchives, open BC jobs in crfdf_bcjobs, open beats archived,
  highest archive version wins) and diffs it against what the flow wrote.

  Dataverse: device-code sign-in (as asmith@lumineosigns.com).
  BC: the Postman app registration (same as bc-odata-jobpo-probe.ps1).

      pwsh -File scripts/verify-jobpo-sync.ps1 [-Job J29295]
#>
param([string]$Job = 'J29295', [string]$Company = 'Luminous Neon')

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

function Get-DvAll($url) {
  $out = @(); $h2 = $headers.Clone(); $h2['Prefer'] = 'odata.maxpagesize=5000'
  while ($url) { $r = Invoke-RestMethod -Uri $url -Headers $h2; $out += $r.value; $url = $r.'@odata.nextLink' }
  $out
}

# --- BC
$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }
$bt = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token
$bh = @{ Authorization = "Bearer $bt" }
$api = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/api"
$coId = ((Invoke-RestMethod -Uri "$api/v2.0/companies" -Headers $bh).value | Where-Object name -eq $Company).id
$bcBase = "$api/lumineo/planning/v1.0/companies($coId)"
$open = (Invoke-RestMethod -Uri "$bcBase/jobPurchaseOrders" -Headers $bh).value
$arch = (Invoke-RestMethod -Uri "$bcBase/jobPurchaseOrderArchives" -Headers $bh).value

# --- Dataverse
$jobs = @{}; Get-DvAll "$base/crfdf_bcjobs?`$select=crfdf_jobnumber&`$filter=crfdf_jobnumber ne null" | ForEach-Object { $jobs[$_.crfdf_jobnumber.Trim()] = $true }
$saved = Get-DvAll "$base/crfdf_jobpos?`$select=crfdf_name,crfdf_jobno,crfdf_pono,crfdf_vendorno,crfdf_vendorname,crfdf_orderdate,crfdf_postatus"

# --- expected, the flow's rules
$exp = @{}
function Want($r, $status, $rank) {
  $j = "$($r.jobNo)".Trim(); $p = "$($r.documentNo)".Trim()
  if (-not $p -or -not $jobs.ContainsKey($j)) { return }
  $k = "$j|$p"
  if ($exp.ContainsKey($k) -and $exp[$k].rank -ge $rank) { return }
  $d = "$($r.orderDate)"; if ($d.StartsWith('0001')) { $d = '' }
  $exp[$k] = [pscustomobject]@{ rank = $rank; sig = "$k~$($r.buyFromVendorNo)~$($r.buyFromVendorName)~$d~$status" }
}
foreach ($r in $arch) { Want $r 'Archived' ([int]$r.versionNo) }
foreach ($r in $open) { Want $r ("$($r.status)" -replace '_x0020_', ' ') 1000000 }

$got = @{}; $dupes = 0
foreach ($r in $saved) {
  if ($got.ContainsKey($r.crfdf_name)) { $dupes++ }
  $got[$r.crfdf_name] = "$($r.crfdf_name)~$($r.crfdf_vendorno)~$($r.crfdf_vendorname)~$($r.crfdf_orderdate)~$($r.crfdf_postatus)"
}
$missing = @($exp.Keys | Where-Object { -not $got.ContainsKey($_) })
$extra   = @($got.Keys | Where-Object { -not $exp.ContainsKey($_) })
$wrong   = @($exp.Keys | Where-Object { $got.ContainsKey($_) -and $got[$_] -ne $exp[$_].sig })

""
"BC: $($open.Count) open + $($arch.Count) archive rows; open BC jobs: $($jobs.Count)"
"Expected rows: $($exp.Count)   saved rows: $($saved.Count)   duplicate keys saved: $dupes"
"Missing: $($missing.Count)   extra: $($extra.Count)   differing: $($wrong.Count)"
$missing | Select-Object -First 5 | ForEach-Object { "  missing  $_" }
$extra   | Select-Object -First 5 | ForEach-Object { "  extra    $_" }
$wrong   | Select-Object -First 5 | ForEach-Object { "  differs  want $($exp[$_].sig)`n           got  $($got[$_])" }
""
"Saved rows for ${Job}:"
$saved | Where-Object crfdf_jobno -eq $Job | Sort-Object crfdf_orderdate -Descending |
  Format-Table crfdf_pono, crfdf_vendorname, crfdf_orderdate, crfdf_postatus -AutoSize | Out-String -Width 200
