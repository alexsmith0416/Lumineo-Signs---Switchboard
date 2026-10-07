<#
  diagnose-flow.ps1 — READ-ONLY. Why is a cloud flow failing? Prints its state,
  its last runs, and for the newest failed run every failed action with its
  error; then (optional) a Dataverse table's row count and newest write, to
  see how stale the data the flow fills is.
      pwsh -File scripts/diagnose-flow.ps1 -FlowName BCSync_JobPlanningLines -Table crfdf_bcplanninglines

  One device-code sign-in (as asmith@lumineosigns.com); the refresh token then
  gets a Dataverse token too. Nothing is changed.
#>
param(
  [Parameter(Mandatory)][string]$FlowName,
  [string]$Table = '',
  [int]$Runs = 10,
  # Optional file to keep the sign-in in between runs (put it OUTSIDE the repo).
  [string]$TokenCache = ''
)
$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$envId    = '484cdd3c-4409-e741-bbd5-7c210e00310e'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$flowRes  = 'https://service.flow.microsoft.com'

$tok = $null
if ($TokenCache -and (Test-Path $TokenCache)) {
  try {
    $cached = Get-Content $TokenCache -Raw | ConvertFrom-Json
    $tok = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type = 'refresh_token'; client_id = $clientId; refresh_token = $cached.refresh_token; scope = "$flowRes/.default offline_access" }
  } catch { $tok = $null }
}
if (-not $tok) {
$dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$flowRes/.default offline_access" }
Write-Host "==> $($dc.message)" -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $tok -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try { $tok = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type = 'urn:ietf:params:oauth:grant-type:device_code'; client_id = $clientId; device_code = $dc.device_code } }
  catch { $e = ($_.ErrorDetails.Message | ConvertFrom-Json).error; if ($e -ne 'authorization_pending' -and $e -ne 'slow_down') { throw } }
}
if (-not $tok) { throw "Sign-in timed out." }
}
if ($TokenCache) { $tok | ConvertTo-Json | Set-Content $TokenCache }
Write-Host "Authenticated." -ForegroundColor Green
$fh = @{ Authorization = "Bearer $($tok.access_token)" }
$api = "https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/$envId"
$v = 'api-version=2016-11-01'

# --- the flow -------------------------------------------------------------
$flows = @(); $url = "$api/flows?$v"
while ($url) { $r = Invoke-RestMethod -Uri $url -Headers $fh; $flows += $r.value; $url = $r.nextLink }
$flow = $flows | Where-Object { $_.properties.displayName -eq $FlowName } | Select-Object -First 1
if (-not $flow) { throw "No flow named '$FlowName' in this environment. Found: $(($flows.properties.displayName | Sort-Object) -join ', ')" }
$p = $flow.properties
Write-Host ""
Write-Host ("{0}  state={1}  modified={2}" -f $p.displayName, $p.state, $p.lastModifiedTime) -ForegroundColor White
$trig = $p.definitionSummary.triggers | Select-Object -First 1
if ($trig) { Write-Host ("  trigger: {0} {1}" -f $trig.type, ($trig.recurrence | ConvertTo-Json -Compress)) }

# --- runs -----------------------------------------------------------------
$runList = (Invoke-RestMethod -Uri "$api/flows/$($flow.name)/runs?$v&`$top=$Runs" -Headers $fh).value
Write-Host ""
Write-Host "Last $($runList.Count) runs:" -ForegroundColor Cyan
foreach ($r in $runList) {
  $rp = $r.properties
  $msg = if ($rp.error) { [string]($rp.error.message) } else { '' }
  Write-Host ("  {0}  {1,-10} ended {2}  {3}" -f $rp.startTime, $rp.status, $rp.endTime, $msg)
}

$failed = $runList | Where-Object { $_.properties.status -eq 'Failed' } | Select-Object -First 1
if ($failed) {
  Write-Host ""
  Write-Host "Newest failed run $($failed.name) — failed actions:" -ForegroundColor Yellow
  $acts = @(); $url = "$api/flows/$($flow.name)/runs/$($failed.name)/actions?$v"
  while ($url) { $r = Invoke-RestMethod -Uri $url -Headers $fh; $acts += $r.value; $url = $r.nextLink }
  foreach ($a in ($acts | Where-Object { $_.properties.status -eq 'Failed' })) {
    $ap = $a.properties
    Write-Host ("  ✗ {0}  ({1})  code={2}" -f $a.name, $ap.startTime, $ap.code) -ForegroundColor Red
    if ($ap.error) { Write-Host ("      {0}" -f ($ap.error.message -replace '\s+', ' ')) }
    # The action's output often holds the real error (HTTP body / Dataverse message).
    if ($ap.outputsLink.uri) {
      try {
        $out = Invoke-RestMethod -Uri $ap.outputsLink.uri
        $body = $out.body | ConvertTo-Json -Depth 6 -Compress
        if ($body) { Write-Host ("      body: {0}" -f $body.Substring(0, [Math]::Min(900, $body.Length))) -ForegroundColor DarkGray }
        if ($out.statusCode) { Write-Host ("      status: {0}" -f $out.statusCode) -ForegroundColor DarkGray }
      } catch { }
    }
  }
  $skipped = ($acts | Where-Object { $_.properties.status -eq 'Skipped' }).Count
  $ok = ($acts | Where-Object { $_.properties.status -eq 'Succeeded' }).Count
  Write-Host ("  ({0} actions succeeded, {1} skipped)" -f $ok, $skipped) -ForegroundColor DarkGray
}

# --- the table it fills ---------------------------------------------------
if ($Table) {
  $dv = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
    -Body @{ grant_type = 'refresh_token'; client_id = $clientId; refresh_token = $tok.refresh_token; scope = "$org/.default" }
  $dh = @{ Authorization = "Bearer $($dv.access_token)"; Accept = 'application/json'; Prefer = 'odata.include-annotations="*"' }
  $set = (Invoke-RestMethod -Uri "$org/api/data/v9.2/EntityDefinitions(LogicalName='$Table')?`$select=EntitySetName" -Headers $dh).EntitySetName
  $count = (Invoke-RestMethod -Uri "$org/api/data/v9.2/RetrieveTotalRecordCount(EntityNames=['$Table'])" -Headers $dh).EntityRecordCountCollection.Values[0]
  $newest = (Invoke-RestMethod -Uri "$org/api/data/v9.2/$set`?`$select=modifiedon,createdon&`$orderby=modifiedon desc&`$top=1" -Headers $dh).value[0]
  $oldest = (Invoke-RestMethod -Uri "$org/api/data/v9.2/$set`?`$select=modifiedon&`$orderby=modifiedon asc&`$top=1" -Headers $dh).value[0]
  Write-Host ""
  Write-Host "$Table — ~$count rows (count may lag up to a day); newest write $($newest.modifiedon), oldest $($oldest.modifiedon)" -ForegroundColor Cyan
}
