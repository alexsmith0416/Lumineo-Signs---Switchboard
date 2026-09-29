<#
  bc-odata-planning-probe.ps1 — READ-ONLY probe of our own web service over the
  per-job planning table (71441977 ICG.IPP.ProjectPlanning), published from
  bc/lumineo-planning-ext as page 58400 / service `LumineoProjectPlanning`.

  Answers the three things every earlier page failed:
    1. row count (expect ~8,147 — one per job x step, not the 35-row catalogue)
    2. real dates + a job number on a scheduled job's rows
    3. a keyed GET on (Project_No, Code) returns ONE row with an @odata.etag

  Writes nothing.

      pwsh -File scripts/bc-odata-planning-probe.ps1
      pwsh -File scripts/bc-odata-planning-probe.ps1 -Job J31949
#>
param(
  [string]$Service = 'LumineoProjectPlanning',
  [string]$Company = 'Luminous Neon',
  [string]$Job     = 'J31949'
)

$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }

$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token

$root = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/ODataV4"
$base = "$root/Company('$([uri]::EscapeDataString($Company))')"
$hg   = @{ Authorization = "Bearer $tok" }

function Fmt-Err($e) {
  $code = $null
  try { $code = [int]$e.Exception.Response.StatusCode } catch {}
  $body = ($e.ErrorDetails.Message -replace '\s+',' ').Trim()
  if (-not $body) { $body = $e.Exception.Message }
  if ($code) { "HTTP $code — $body" } else { $body }
}

"ENV      $($m.environment)   company='$Company'   service=$Service   job=$Job"
""

"===== TEST 1: row count"
try {
  $n = Invoke-RestMethod -Uri "$base/$Service/`$count" -Headers $hg
  "  $n rows  (catalogue is 35; expect ~8,147)"
} catch { "  FAILS: " + (Fmt-Err $_); return }
""

"===== TEST 2: $Job's steps (server-side filter on the key)"
$f = [uri]::EscapeDataString("Project_No eq '$Job'")
try {
  $rows = (Invoke-RestMethod -Uri "$base/$Service`?`$filter=$f" -Headers $hg).value
} catch { "  FAILS: " + (Fmt-Err $_); return }
"  $($rows.Count) rows"
$rows | Sort-Object Parent_Sort_Order, Sort_Order |
  Format-Table Step_Description, Started, Complete, Assigned_To,
    Start_DateTime, Start_Date_2, Start_Time, End_DateTime, End_Date, End_Time,
    Due_DateTime, Duration -AutoSize | Out-String -Width 400
""
"  Fields populated on at least one $Job row (non-default):"
$blank = @($null, '', '0001-01-01', '00:00:00', '0001-01-01T00:00:00Z', 'PT0S', $false, 0)
$rows[0].PSObject.Properties.Name | Where-Object { $_ -notlike '@*' } | ForEach-Object {
  $p = $_
  $hits = @($rows | Where-Object { $blank -notcontains [string]$_.$p -and $blank -notcontains $_.$p }).Count
  if ($hits) { "    {0,-22} {1} of {2}" -f $p, $hits, $rows.Count }
}
""

"===== TEST 3: keyed GET on (Project_No, Code) — the row handle the flow will PATCH"
$r = $rows | Where-Object { $_.Started -or $_.Assigned_To } | Select-Object -First 1
if (-not $r) { $r = $rows[0] }
$url = "$base/$Service(Project_No='$Job',Code=$($r.Code))"
"  GET $url"
try {
  $one = Invoke-WebRequest -Uri $url -Headers $hg
  $j = $one.Content | ConvertFrom-Json
  "  OK — step '$($j.Step_Description)'   etag: $($j.'@odata.etag')"
} catch { "  FAILS: " + (Fmt-Err $_) }
