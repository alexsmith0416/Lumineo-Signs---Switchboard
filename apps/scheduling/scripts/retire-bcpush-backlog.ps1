<#
  Retires the BC planning-step outbox backlog queued BEFORE the Sep 28, 2026
  rewire.

  Those `schedule` / `completion` rows use the old shape: crfdf_planningstep is a
  BC planning-LINE description ("Cabinet Metal Labor"), not a catalogue step
  ("Fabrication"), and each schedule row carries ONE card's times rather than
  the step's whole window. BCPush_PlanningSteps can't place them, and replaying
  ~190 edits would be wrong anyway. Agreed: retire them; the board's current
  state reaches BC through fresh pushes.

  Sets crfdf_status = 'superseded' (the flow only acts on 'pending'). Leaves
  `job` rows alone — BCPush_JobCompletion drains those.

  DRY RUN by default — lists what it would change. Pass -Apply to write.

      pwsh -File scripts/retire-bcpush-backlog.ps1
      pwsh -File scripts/retire-bcpush-backlog.ps1 -Apply

  Same device-code auth as the other create-/add- scripts: open the printed URL,
  enter the code, sign in as asmith@lumineosigns.com.
#>
param(
  # Rows created before this instant are old-shape. Default: the rewire date.
  [datetime]$Before = [datetime]'2026-09-29T00:00:00Z',
  [switch]$Apply
)

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
$base = "$org/api/data/v9.2/crfdf_bcpushqueues"

$cut = $Before.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$filter = "crfdf_status eq 'pending' and (crfdf_kind eq 'schedule' or crfdf_kind eq 'completion') and createdon lt $cut"
$rows = @()
$url = "$base`?`$select=crfdf_bcpushqueueid,crfdf_kind,crfdf_jobno,crfdf_planningstep,createdon&`$filter=$([uri]::EscapeDataString($filter))"
while ($url) {
  $page = Invoke-RestMethod -Uri $url -Headers $headers
  $rows += $page.value
  $url = $page.'@odata.nextLink'
}

"{0} pending schedule/completion row(s) created before {1}" -f $rows.Count, $cut
$rows | Group-Object crfdf_kind | ForEach-Object { "  {0,-11} {1}" -f $_.Name, $_.Count }
if (-not $Apply) { ""; "Dry run — nothing changed. Re-run with -Apply to retire them."; return }

$done = 0
foreach ($r in $rows) {
  $body = @{ crfdf_status = 'superseded'; crfdf_statusmessage = 'retired Sep 28 2026: pre-rewire per-card shape' } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "$base($($r.crfdf_bcpushqueueid))" -Headers $headers -Body $body | Out-Null
  $done++
}
"Retired $done row(s)."
