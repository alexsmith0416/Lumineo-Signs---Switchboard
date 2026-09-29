<#
  bc-odata-planning-write-test.ps1 — ONE-ROW write test against our own service
  `LumineoProjectPlanning` (page 58400 over 71441977). Verifies the Sched_Start /
  Sched_End write path: UTC in -> Start/End DateTime in UTC, the Date+Time pair
  in CENTRAL wall-clock time (DST-aware), Duration = End - Start (set by the page), Started untouched.
  (The raw date fields are read-only on the page since v1.0.0.1.)

  Snapshots every writable field first and RESTORES them at the end (and on any
  failure). Only touches the one (Project_No, step) row named below.

      pwsh -File scripts/bc-odata-planning-write-test.ps1 -Job J31949 -Step 'Upcoming Manufacturing'
#>
param(
  [string]$Service = 'LumineoProjectPlanning',
  [string]$Company = 'Luminous Neon',
  [Parameter(Mandatory)][string]$Job,
  [Parameter(Mandatory)][string]$Step
)

$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }
$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token

$base = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/ODataV4/Company('$([uri]::EscapeDataString($Company))')"
$hg   = @{ Authorization = "Bearer $tok" }

function Fmt-Err($e) {
  $code = $null; try { $code = [int]$e.Exception.Response.StatusCode } catch {}
  $body = ($e.ErrorDetails.Message -replace '\s+',' ').Trim(); if (-not $body) { $body = $e.Exception.Message }
  if ($code) { "HTTP $code — $body" } else { $body }
}

# Writable schedule fields, in the order a restore should apply them.
$W = 'Start_Date_2','Start_Time','Start_DateTime','End_Date','End_Time','End_DateTime',
     'Due_Date_2','Due_Time','Due_DateTime','Duration',
     'Assigned_To','Started','Complete','Completed_Date','Completed_By','Quick_Notes'
$SHOW = 'Start_Date_2','Start_Time','Start_DateTime','End_Date','End_Time','End_DateTime','Duration','Started','Complete','Completed_Date'

$f = [uri]::EscapeDataString("Project_No eq '$Job'")
$row = (Invoke-RestMethod -Uri "$base/$Service`?`$filter=$f" -Headers $hg -ContentType 'application/json' -Method Get `
        -ResponseHeadersVariable _ ).value | Where-Object Step_Description -eq $Step
if (@($row).Count -ne 1) { "Expected exactly one '$Step' row on $Job, found $(@($row).Count). Nothing written."; return }
$url = "$base/$Service(Project_No='$Job',Code=$($row.Code))"

# -DateKind String: keep BC's literal values. The default converts DateTimes and
# hides which fields are UTC vs session-local.
function Get-Row { (Invoke-WebRequest -Uri $url -Headers $hg).Content | ConvertFrom-Json -DateKind String }
function Show($label, $r) { "  $label"; $SHOW | ForEach-Object { "    {0,-15} {1}" -f $_, $r.$_ } }
function Patch($body) {
  $cur = Get-Row
  $h = @{ Authorization = "Bearer $tok"; 'If-Match' = $cur.'@odata.etag' }
  Invoke-RestMethod -Method Patch -Uri $url -Headers $h -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) | Out-Null
  Get-Row
}

$orig = Get-Row
$snap = [ordered]@{}; foreach ($k in $W) { $snap[$k] = $orig.$k }
"ROW  $url"
Show 'ORIGINAL' $orig
""

try {
  "===== A: Sched_Start = 2026-10-05T13:00:00Z  (expect pair 2026-10-05 08:00 CDT, Started unchanged)"
  Show 'after A' (Patch @{ Sched_Start = '2026-10-05T13:00:00Z' })
  ""
  "===== B: Sched_End = 2026-10-06T21:00:00Z  (expect pair 2026-10-06 16:00, Duration P1DT8H)"
  Show 'after B' (Patch @{ Sched_End = '2026-10-06T21:00:00Z' })
  ""
  "===== C: Sched_Start = 2026-12-07T14:00:00Z  (winter: expect pair 2026-12-07 08:00 CST, Duration negative — start after end)"
  Show 'after C' (Patch @{ Sched_Start = '2026-12-07T14:00:00Z' })
  ""
  "===== D: Sched_Start = 2026-10-06T03:00:00Z  (date boundary: expect pair 2026-10-05 22:00, Duration P0DT18H)"
  Show 'after D' (Patch @{ Sched_Start = '2026-10-06T03:00:00Z' })
  ""
} catch {
  "  WRITE FAILED: " + (Fmt-Err $_)
  ""
} finally {
  "===== RESTORE"
  try {
    # One field per PATCH, flags first. A single bulk PATCH is order-sensitive in
    # Infotech's triggers: blanking the start while Started is still true sets
    # the start to NOW (hit Sep 28). Dates go back through Sched_* (the raw
    # fields are read-only on the page).
    foreach ($k in 'Started','Complete') {
      if ([string](Get-Row).$k -ne [string]$snap[$k]) { $null = Patch @{ $k = $snap[$k] } }
    }
    $cur = Get-Row
    if ($cur.Start_DateTime -ne $snap.Start_DateTime) { $null = Patch @{ Sched_Start = $snap.Start_DateTime } }
    if ($cur.End_DateTime   -ne $snap.End_DateTime)   { $null = Patch @{ Sched_End   = $snap.End_DateTime } }
    foreach ($k in 'Completed_Date','Completed_By','Assigned_To','Quick_Notes') {
      if ([string](Get-Row).$k -ne [string]$snap[$k]) { $null = Patch @{ $k = $snap[$k] } }
    }
    $after = Get-Row
    $diff = @($W | Where-Object { [string]$after.$_ -ne [string]$snap[$_] })
    if ($diff.Count) {
      "  🔴 NOT fully restored — differing fields:"
      $diff | ForEach-Object { "    {0,-15} now={1}  was={2}" -f $_, $after.$_, $snap[$_] }
    } else { "  OK — every writable field matches the original." }
  } catch { "  🔴 RESTORE FAILED: " + (Fmt-Err $_) }
}
