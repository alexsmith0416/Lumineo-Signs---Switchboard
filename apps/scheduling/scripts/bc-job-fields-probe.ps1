<#
  bc-job-fields-probe.ps1 — READ-ONLY. Looks for the BC field that marks a job
  as a service / contract order (for the Service stepper). Pulls every job from
  the sign365 UAT jobs API and prints, for each field with few distinct values,
  the values and how many jobs have each — a "type" / "posting group" style
  field shows up here. -JobNo also dumps one job's full record.
      pwsh -File scripts/bc-job-fields-probe.ps1 [-JobNo J12345]
  Uses the app registration from the UAT Postman environment (no sign-in),
  like scripts/bc-job-status.ps1.
#>
param([string]$JobNo = '', [int]$MaxDistinct = 15)
$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }
$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token
$h = @{ Authorization = "Bearer $tok" }
$base = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/api/infotechConsultingGroup/sign365/v1.0/companies(4738bfb5-a06d-ec11-bf27-000d3a132a9e)"

if ($JobNo) {
  Invoke-RestMethod -Uri "$base/jobs('$JobNo')" -Headers $h | Format-List | Out-String -Width 200
}

$jobs = @(); $url = "$base/jobs"
while ($url) {
  $r = Invoke-RestMethod -Uri $url -Headers $h
  $jobs += $r.value
  $url = $r.'@odata.nextLink'
}
Write-Host "$($jobs.Count) jobs" -ForegroundColor Cyan
$props = $jobs[0].PSObject.Properties.Name | Where-Object { $_ -notlike '@*' }
foreach ($p in $props) {
  $groups = $jobs | Group-Object { [string]$_.$p } | Sort-Object Count -Descending
  if ($groups.Count -le $MaxDistinct) {
    Write-Host ("{0}  ({1} values)" -f $p, $groups.Count) -ForegroundColor White
    $groups | ForEach-Object { Write-Host ("    {0,6}  {1}" -f $_.Count, $(if ($_.Name -eq '') { '(blank)' } else { $_.Name })) }
  }
}
