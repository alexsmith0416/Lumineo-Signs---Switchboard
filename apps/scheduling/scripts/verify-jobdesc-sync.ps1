<#
  verify-jobdesc-sync.ps1 — READ-ONLY check of the BCSync_JobDescriptions flow.
  Reads every open job's descriptions from BC (jobDescriptions API page) and
  diffs them, text and lastModified, against crfdf_jobdesc.

  Dataverse: device-code sign-in (as asmith@lumineosigns.com).
  BC: the Postman app registration (same as bc-odata-jobdesc-probe.ps1).

      pwsh -File scripts/verify-jobdesc-sync.ps1 [-Job J29295]
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
$bc = (Invoke-RestMethod -Uri "$api/lumineo/planning/v1.0/companies($coId)/jobDescriptions?`$filter=$([uri]::EscapeDataString("status eq 'Open'"))" -Headers $bh).value

# --- Dataverse
$saved = Get-DvAll "$base/crfdf_jobdescs?`$select=crfdf_jobno,crfdf_fielddesc,crfdf_proddesc,crfdf_extdesc,crfdf_bcmodified"

function N($v) { ("$v" -replace "`r", '').Trim() }
$got = @{}; $dupes = 0
foreach ($r in $saved) { $k = (N $r.crfdf_jobno); if ($got.ContainsKey($k)) { $dupes++ }; $got[$k] = $r }
$want = @{}; foreach ($r in $bc) { $k = (N $r.jobNo); if ($k) { $want[$k] = $r } }

$missing = @($want.Keys | Where-Object { -not $got.ContainsKey($_) })
$extra   = @($got.Keys  | Where-Object { -not $want.ContainsKey($_) })
$wrong   = @($want.Keys | Where-Object {
  $g = $got[$_]; $w = $want[$_]
  $g -and ((N $g.crfdf_fielddesc) -ne (N $w.fieldDescription) -or (N $g.crfdf_proddesc) -ne (N $w.productionDescription) -or
           (N $g.crfdf_extdesc) -ne (N $w.extendedDescription) -or (N $g.crfdf_bcmodified) -ne (N $w.lastModified)) })
$garbled = @($saved | Where-Object { "$($_.crfdf_fielddesc)$($_.crfdf_proddesc)$($_.crfdf_extdesc)" -match '[ÂÄ]' })

""
"BC open jobs: $($want.Count)   saved rows: $($saved.Count)   duplicate job rows: $dupes"
"Missing: $($missing.Count)   extra: $($extra.Count)   differing: $($wrong.Count)   rows containing Â/Ä: $($garbled.Count)"
$missing | Select-Object -First 5 | ForEach-Object { "  missing  $_" }
$extra   | Select-Object -First 5 | ForEach-Object { "  extra    $_" }
$wrong   | Select-Object -First 5 | ForEach-Object { "  differs  $_  (BC modified $($want[$_].lastModified), saved $($got[$_].crfdf_bcmodified))" }
""
"Saved Production Description for ${Job}:"
(N $got[$Job].crfdf_proddesc) -split "`n" | Select-Object -First 4
