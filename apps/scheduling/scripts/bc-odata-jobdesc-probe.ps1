<#
  bc-odata-jobdesc-probe.ps1 — READ-ONLY probe of the job descriptions API page
  in bc/lumineo-planning-ext (v1.0.0.9+):
    page 58403 "Lumineo Job Descriptions API" → api/lumineo/planning/v1.0/.../jobDescriptions
  (Field / Production / Extended Description — Blob fields from Infotech's
  "Lumineo Signs - Projects" extension, read into text by the page.)

  Prints, over the OPEN jobs: how many have each description, the longest,
  whether they look like HTML (rich text) or plain text, then one job's three
  descriptions in full.

      pwsh -File scripts/bc-odata-jobdesc-probe.ps1
      pwsh -File scripts/bc-odata-jobdesc-probe.ps1 -Job J36110
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

$rows = @(); $url = "$base/jobDescriptions?`$filter=$([uri]::EscapeDataString("status eq 'Open'"))"
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
  while ($url) { $r = Invoke-RestMethod -Uri $url -Headers $hg; $rows += $r.value; $url = $r.'@odata.nextLink' }
} catch {
  $code = try { [int]$_.Exception.Response.StatusCode } catch { '?' }
  "FAILS HTTP $code — $($_.ErrorDetails.Message)"; return
}
"Open jobs: $($rows.Count)  (read in $([int]$sw.Elapsed.TotalSeconds)s)"
""
foreach ($f in 'fieldDescription', 'productionDescription', 'extendedDescription') {
  $have = @($rows | Where-Object { "$($_.$f)".Trim() })
  $html = @($have | Where-Object { "$($_.$f)" -match '<(p|div|br|span|ul|li|b|strong|font)\b' })
  $long = ($have | ForEach-Object { "$($_.$f)".Length } | Measure-Object -Maximum).Maximum
  "{0,-22} {1,5} jobs have it   {2,5} look like HTML   longest {3} chars" -f $f, $have.Count, $html.Count, $long
}

if (-not $Job) {
  $Job = ($rows | Where-Object { "$($_.fieldDescription)".Trim() -and "$($_.productionDescription)".Trim() } | Select-Object -First 1).jobNo
}
if (-not $Job) { ""; "No open job has both a Field and a Production Description."; return }
$one = $rows | Where-Object jobNo -eq $Job | Select-Object -First 1
if (-not $one) { $one = (Invoke-RestMethod -Uri "$base/jobDescriptions?`$filter=$([uri]::EscapeDataString("jobNo eq '$Job'"))" -Headers $hg).value[0] }
""
"===== $Job (last modified $($one.lastModified))"
foreach ($f in 'fieldDescription', 'productionDescription', 'extendedDescription') {
  "--- $f"
  if ("$($one.$f)".Trim()) { $one.$f } else { "(empty)" }
}
