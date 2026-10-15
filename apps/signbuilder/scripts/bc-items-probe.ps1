<#
  bc-items-probe.ps1 — READ-ONLY. Lists BC's item categories and items (standard
  API v2.0) so Sign Builder answers can be matched to items. Writes two CSVs —
  company data, keep them out of git:
      pwsh -File apps/signbuilder/scripts/bc-items-probe.ps1 -OutDir C:\temp\bc-items
  Uses the app registration from the UAT Postman environment (no sign-in), the
  same way the Switchboard probes do (apps/scheduling/scripts/bc-job-status.ps1).
#>
param([Parameter(Mandatory)][string]$OutDir)
$ErrorActionPreference = 'Stop'
$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }
$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token
$h = @{ Authorization = "Bearer $tok" }
$base = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/api/v2.0/companies(4738bfb5-a06d-ec11-bf27-000d3a132a9e)"

function Get-All($url) {
  $rows = @()
  while ($url) {
    $r = Invoke-RestMethod -Uri $url -Headers $h
    $rows += $r.value
    $url = $r.'@odata.nextLink'
  }
  $rows
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
$cats = Get-All "$base/itemCategories?`$select=code,displayName"
$items = Get-All "$base/items?`$select=number,displayName,displayName2,type,itemCategoryCode,baseUnitOfMeasureCode,blocked,unitCost,lastModifiedDateTime"
$cats | Export-Csv -NoTypeInformation -Encoding utf8 (Join-Path $OutDir 'item-categories.csv')
$items | Export-Csv -NoTypeInformation -Encoding utf8 (Join-Path $OutDir 'items.csv')
"Environment: $($m.environment)   categories: $($cats.Count)   items: $($items.Count)"
$items | Group-Object itemCategoryCode | Sort-Object Count -Descending |
  ForEach-Object { $c = $_.Name; $d = ($cats | Where-Object code -eq $c).displayName; "{0,5}  {1,-20} {2}" -f $_.Count, $(if ($c) { $c } else { '(none)' }), $d }
