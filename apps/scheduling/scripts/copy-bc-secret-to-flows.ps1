<#
  Copies the BC app registration's client secret into the BCPush_PoReceipts and
  BCPush_PoDeliveries flows (Warehouse Management phase 3), from a BC flow that
  already has it — so nobody has to see, paste or type it.

  Why a script: Bc_ClientSecret is a parameter INSIDE the flow definition
  (clientdata), and the Power Automate designer doesn't show definition
  parameters anywhere — there's no field to paste it into.

  Run AFTER importing BCPoReceiving_1_0_0_2.zip. The source is the first of
  BCSync_TaskCompletions / BCSync_JobDescriptions / BCSync_JobPOs /
  BCPush_PlanningSteps whose secret isn't a placeholder (or -SourceFlow).
  The secret is never printed or written to disk — only its length is shown.
  Idempotent. The flows' On/Off state is left as it is.

  Device-code sign-in as asmith@lumineosigns.com.
#>
param(
  [string]$SourceFlow = ''
)

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$targets  = @('BCPush_PoReceipts', 'BCPush_PoDeliveries')
$sources  = if ($SourceFlow) { @($SourceFlow) } else { @('BCSync_TaskCompletions', 'BCSync_JobDescriptions', 'BCSync_JobPOs', 'BCPush_PlanningSteps') }

$dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode" `
  -Body @{ client_id = $clientId; scope = "$org/.default offline_access" }
Write-Host ""; Write-Host "==> $($dc.message)" -ForegroundColor Cyan; Write-Host ""
$token = $null; $deadline = (Get-Date).AddSeconds([int]$dc.expires_in)
while (-not $token -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try {
    $token = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" `
      -Body @{ grant_type='urn:ietf:params:oauth:grant-type:device_code'; client_id=$clientId; device_code=$dc.device_code }).access_token
  } catch { $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error; if ($err -ne 'authorization_pending' -and $err -ne 'slow_down') { throw } }
}
if (-not $token) { throw "Device-code login timed out." }
Write-Host "Authenticated." -ForegroundColor Green
$headers = @{ Authorization="Bearer $token"; Accept='application/json'; 'Content-Type'='application/json'; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0' }
$api = "$org/api/data/v9.2"

function Get-Flow($name) {
  $found = Invoke-RestMethod -Method Get -Headers $headers `
    -Uri "$api/workflows?`$select=workflowid,name,clientdata,statecode&`$filter=category eq 5 and name eq '$name'"
  return @($found.value)
}

# A real secret, not one of the build placeholders ("<< … >>", "<…>", "paste-…").
function Test-RealSecret($v) {
  return ($v -is [string]) -and $v.Length -ge 20 -and -not $v.StartsWith('<') -and -not $v.StartsWith('paste-')
}

$secret = $null
foreach ($name in $sources) {
  foreach ($wf in Get-Flow $name) {
    $v = ($wf.clientdata | ConvertFrom-Json).properties.definition.parameters.Bc_ClientSecret.defaultValue
    if (Test-RealSecret $v) {
      $secret = $v
      Write-Host ("Secret found in {0} ({1} characters)." -f $name, $v.Length) -ForegroundColor Green
      break
    }
    Write-Host ("  {0}: no usable secret there" -f $name) -ForegroundColor DarkGray
  }
  if ($secret) { break }
}
if (-not $secret) { throw "No BC flow with a real Bc_ClientSecret found (tried: $($sources -join ', '))." }

foreach ($name in $targets) {
  $list = Get-Flow $name
  if ($list.Count -eq 0) { Write-Host ("{0}: not found - import BCPoReceiving_1_0_0_2.zip first." -f $name) -ForegroundColor Red; continue }
  foreach ($wf in $list) {
    $cd = $wf.clientdata | ConvertFrom-Json
    $p = $cd.properties.definition.parameters.Bc_ClientSecret
    if (-not $p) { Write-Host ("{0}: has no Bc_ClientSecret parameter - skipped." -f $name) -ForegroundColor Red; continue }
    if ($p.defaultValue -eq $secret) { Write-Host ("{0}: already set." -f $name) -ForegroundColor Yellow; continue }
    $p.defaultValue = $secret
    $body = @{ clientdata = ($cd | ConvertTo-Json -Depth 60 -Compress) } | ConvertTo-Json -Depth 3
    Invoke-RestMethod -Method Patch -Headers $headers -Uri "$api/workflows($($wf.workflowid))" -Body $body | Out-Null
    $state = if ($wf.statecode -eq 1) { 'On' } else { 'Off' }
    Write-Host ("{0}: secret set (flow is {1})." -f $name, $state) -ForegroundColor Green
  }
}
$secret = $null
Write-Host ""
Write-Host "Done. Turn both flows on once BC ext v1.0.0.17 is published to UAT." -ForegroundColor Cyan
