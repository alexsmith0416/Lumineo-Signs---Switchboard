<#
  bc-odata-step-probe.ps1 — Can we read/write Project Planning Steps through our
  OWN web service page, bypassing Infotech's read-only sign365 API page?

  Background: the sign365 API page exposes projectPlanningSteps as
  Updatable=false with no addressable row. Page Inspection (Sep 16, 2026) showed
  the subform is backed by a REAL table — ICG.IPP.ProjectPlanningStep (71441976)
  — so a web service page over that table should give us both the write and the
  single-row handle.

  Reads by default. Pass -Write to attempt one PATCH, which is READ FIRST and
  RESTORED at the end.

      pwsh -File scripts/bc-odata-step-probe.ps1
      pwsh -File scripts/bc-odata-step-probe.ps1 -Write
      pwsh -File scripts/bc-odata-step-probe.ps1 -Service LumineoPlanningSteps
#>
param(
  [string]$Service = 'LumineoPlanningSteps',  # the Service Name from BC's Web Services page
  [string]$Company = 'Luminous Neon',
  [string]$Field   = 'assignedTo',            # field to poke; change to a real one from the GET below
  [switch]$Write
)

$envf = "C:\Users\Alex\OneDrive - Luminous Neon, Inc\Documents\Alex Smith - Lumineo Files\Lumineo Signs Switchboard\Postman\UAT\UAT.postman_environment - Copy.json"
$m = @{}; (Get-Content $envf -Raw | ConvertFrom-Json).values | ForEach-Object { $m[$_.key] = $_.value }

$tok = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($m.tenant)/oauth2/v2.0/token" -Body @{
  grant_type='client_credentials'; client_id=$m.clientid; client_secret=$m.clientsecret
  scope='https://api.businesscentral.dynamics.com/.default' }).access_token

# Web services live under /ODataV4/, NOT /api/<publisher>/<group>/<version>/.
# Same token, same scope — only the base path differs from the sign365 API.
$root = "https://api.businesscentral.dynamics.com/v2.0/$($m.tenant)/$($m.environment)/ODataV4"
$co   = [uri]::EscapeDataString($Company)
$base = "$root/Company('$co')"
$hg   = @{ Authorization = "Bearer $tok" }
$h    = @{ Authorization = "Bearer $tok"; 'If-Match' = '*'; 'Content-Type' = 'application/json' }

function Fmt-Err($e) {
  $code = $null
  try { $code = [int]$e.Exception.Response.StatusCode } catch {}
  $body = ($e.ErrorDetails.Message -replace '\s+',' ').Trim()
  if (-not $body) { $body = $e.Exception.Message }
  if ($code) { "HTTP $code — $body" } else { $body }
}

"ENV      $($m.environment)   company='$Company'"
"SERVICE  $Service"
""

"===== TEST 1: is the service published and reachable?"
try {
  $top = Invoke-RestMethod -Uri "$base/$Service`?`$top=1" -Headers $hg
  "  OK — service responds."
} catch {
  "  FAILS: " + (Fmt-Err $_)
  ""
  "  Published web services on this environment:"
  try {
    ([xml](Invoke-WebRequest -Uri "$root/`$metadata" -Headers $hg).Content).
      SelectNodes('//*[local-name()="EntitySet"]') |
      ForEach-Object { "    - " + $_.Name }
  } catch { "    (could not read `$metadata: " + $_.Exception.Message + ")" }
  "  -> Publish the page: BC search 'Web Services' > New > Object Type=Page,"
  "     Object ID=<your page>, Service Name='$Service', tick Published."
  return
}
""

"===== TEST 2: what does a row look like? (field names + the key)"
$row = $top.value[0]
if (-not $row) { "  Service is empty — no rows to probe."; return }
$row | ConvertTo-Json -Depth 3
""
"  Fields present: " + (($row.PSObject.Properties.Name) -join ', ')
""

"===== TEST 3: is a single row addressable? (the wall the API page hit)"
# BC OData exposes the page's primary key fields; SystemId is the reliable handle.
$keyProp = $row.PSObject.Properties.Name | Where-Object { $_ -in @('SystemId','systemId') } | Select-Object -First 1
if (-not $keyProp) {
  "  No SystemId on the row. Key it by the table's primary key fields instead —"
  "  check the page's source expressions, then hand-build the key predicate."
  return
}
$rowUrl = "$base/$Service($($row.$keyProp))"
try {
  $one = Invoke-RestMethod -Uri $rowUrl -Headers $hg
  "  OK — keyed GET resolves ONE row via $keyProp=$($row.$keyProp)"
  "  ETag present: " + [bool]$one.'@odata.etag'
} catch {
  "  FAILS: " + (Fmt-Err $_)
  "  (This is the same wall as the sign365 API page — the page needs a stable key.)"
  return
}
""

if (-not $Write) { "===== TEST 4 skipped — pass -Write to attempt the PATCH."; return }

"===== TEST 4: THE question — does a PATCH land and persist?"
if ($null -eq $one.$Field) {
  "  Field '$Field' is not on this row. Re-run with -Field <one of the names above>."
  return
}
$orig   = $one.$Field
$marker = "WT$(Get-Date -Format 'HHmm')"
"  BEFORE  $Field = '$orig'"
try {
  Invoke-RestMethod -Method Patch -Uri $rowUrl -Headers $h -Body (@{ $Field = $marker } | ConvertTo-Json -Compress) | Out-Null
  $after = Invoke-RestMethod -Uri $rowUrl -Headers $hg
  "  PATCH accepted. RE-READ $Field = '$($after.$Field)'  -> PERSISTED: $($after.$Field -eq $marker)"
} catch {
  "  FAILS: " + (Fmt-Err $_)
  "  'Entity does not support modifying data' => page still ModifyAllowed=false."
  "  'permission'/'does not have access' => the Entra app needs ICG.PROJECTPLANNING."
  return
}
""
"===== RESTORE"
try {
  Invoke-RestMethod -Method Patch -Uri $rowUrl -Headers $h -Body (@{ $Field = $orig } | ConvertTo-Json -Compress) | Out-Null
  $fin = Invoke-RestMethod -Uri $rowUrl -Headers $hg
  "  AFTER   $Field = '$($fin.$Field)'  -> RESTORED: $($fin.$Field -eq $orig)"
} catch { "  RESTORE FAILED — set $Field back to: '$orig'" }
