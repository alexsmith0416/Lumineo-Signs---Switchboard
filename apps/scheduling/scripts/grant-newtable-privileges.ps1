<#
  Gives security roles access to the tables added Oct 4–6, by MIRRORING each
  role's existing access to crfdf_jobtrack (Job Tracking) — whoever can see the
  Jobs list today can see these too, at the same depth:

    role has Read  on crfdf_jobtrack  →  Read  on crfdf_jobpo, crfdf_jobdesc, crfdf_taskcompletion
    role has Write on crfdf_jobtrack  →  Write on crfdf_taskcompletion

  Why: the app reads all three (▸ Purchase orders, ▸ descriptions, Jobs →
  History) and an Admin / Ops / Developer session UPDATES crfdf_taskcompletion
  rows when it applies a shop-floor tick (markTaskCompletion). Rows are CREATED
  only by the BCSync_* flows, so nobody needs Create / Delete.

  Dry run by default: prints every root role, what it has on jobtrack and on
  the new tables, and what it would add. Add -Apply to grant.
  Only ADDS privileges (AddPrivilegesRole) and never lowers an existing depth.
  Only root-business-unit roles are touched; child-BU copies inherit.
  Safe to re-run.

  Uses the Web API with a device-code token (az is blocked by the proxy).
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com
  (needs System Administrator / System Customizer to edit roles).
#>
param([switch]$Apply)

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

$api = "$org/api/data/v9.2"
$h = @{
  Authorization      = "Bearer $token"
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
  'Content-Type'     = 'application/json; charset=utf-8'
}

# --- privilege ids ---------------------------------------------------------
$SOURCE = 'crfdf_jobtrack'
$READ_TABLES  = @('crfdf_jobpo', 'crfdf_jobdesc', 'crfdf_taskcompletion')
$WRITE_TABLES = @('crfdf_taskcompletion')

$names = @("prvRead$SOURCE", "prvWrite$SOURCE") +
         ($READ_TABLES  | ForEach-Object { "prvRead$_" }) +
         ($WRITE_TABLES | ForEach-Object { "prvWrite$_" })
$filter = ($names | Select-Object -Unique | ForEach-Object { "name eq '$_'" }) -join ' or '
$privs = (Invoke-RestMethod -Headers $h -Uri "$api/privileges?`$select=name,privilegeid,canbebasic,canbelocal,canbedeep,canbeglobal&`$filter=$filter").value
$priv = @{}
foreach ($p in $privs) { $priv[$p.name] = $p }
foreach ($n in $names) { if (-not $priv[$n]) { throw "Privilege $n not found — is the table created and published?" } }

# Depth: name ↔ rank (AddPrivilegesRole takes the name).
$RANK = @{ Basic = 1; Local = 2; Deep = 3; Global = 4 }
function DepthOf($rolePrivs, $privName) {
  $id = $priv[$privName].privilegeid
  $best = $null
  foreach ($rp in $rolePrivs) {
    if ($rp.PrivilegeId -eq $id -and (-not $best -or $RANK[$rp.Depth] -gt $RANK[$best])) { $best = [string]$rp.Depth }
  }
  return $best
}
# The deepest depth the target privilege allows that is <= the wanted one.
function FitDepth($privName, $want) {
  $p = $priv[$privName]
  $ok = @{ Basic = $p.canbebasic; Local = $p.canbelocal; Deep = $p.canbedeep; Global = $p.canbeglobal }
  foreach ($d in @('Global', 'Deep', 'Local', 'Basic')) {
    if ($RANK[$d] -le $RANK[$want] -and $ok[$d]) { return $d }
  }
  foreach ($d in @('Basic', 'Local', 'Deep', 'Global')) { if ($ok[$d]) { return $d } }
}

# --- roles -----------------------------------------------------------------
# Only roles that hold jobtrack Read today (root BU copies); depth comes per role below.
$srcId = $priv["prvRead$SOURCE"].privilegeid
$roles = (Invoke-RestMethod -Headers $h -Uri "$api/privileges($srcId)/roleprivileges_association?`$select=name,roleid,ismanaged,_businessunitid_value,_parentroleid_value").value |
  Where-Object { -not $_._parentroleid_value } | Sort-Object name
Write-Host ""
Write-Host ("{0} root role(s) can read {1}. {2}" -f $roles.Count, $SOURCE, $(if ($Apply) { 'APPLYING.' } else { 'Dry run — add -Apply to grant.' })) -ForegroundColor Cyan
Write-Host ""

$changed = 0
foreach ($role in $roles) {
  $rps = (Invoke-RestMethod -Headers $h -Uri "$api/RetrieveRolePrivilegesRole(RoleId=@r)?@r=$($role.roleid)").RolePrivileges
  $srcRead  = DepthOf $rps "prvRead$SOURCE"
  $srcWrite = DepthOf $rps "prvWrite$SOURCE"
  if (-not $srcRead -and -not $srcWrite) { continue }   # no Jobs access today → leave alone

  $adds = @()
  $plan = @()
  $wanted = @()
  if ($srcRead)  { $wanted += $READ_TABLES  | ForEach-Object { @{ name = "prvRead$_";  want = $srcRead } } }
  if ($srcWrite) { $wanted += $WRITE_TABLES | ForEach-Object { @{ name = "prvWrite$_"; want = $srcWrite } } }
  foreach ($w in $wanted) {
    $target = FitDepth $w.name $w.want
    $have = DepthOf $rps $w.name
    if ($have -and $RANK[$have] -ge $RANK[$target]) { $plan += "  ok    $($w.name) ($have)"; continue }
    $plan += "  ADD   $($w.name) → $target" + $(if ($have) { " (has $have)" } else { '' })
    $adds += @{ PrivilegeId = $priv[$w.name].privilegeid; PrivilegeName = $w.name; Depth = $target; BusinessUnitId = $role._businessunitid_value }
  }

  $users = (Invoke-RestMethod -Headers $h -Uri "$api/roles($($role.roleid))/systemuserroles_association?`$select=fullname&`$filter=isdisabled eq false").value
  $who = ($users | Select-Object -First 6 | ForEach-Object { $_.fullname }) -join ', '
  if ($users.Count -gt 6) { $who += ", +$($users.Count - 6) more" }
  $tag = if ($role.ismanaged) { ' [managed]' } else { '' }
  Write-Host ("{0}{1} — jobtrack Read {2} / Write {3} — {4} user(s){5}" -f $role.name, $tag, ($srcRead ?? '-'), ($srcWrite ?? '-'), $users.Count, $(if ($who) { ": $who" } else { '' })) -ForegroundColor White
  $plan | ForEach-Object { Write-Host $_ -ForegroundColor $(if ($_ -like '  ADD*') { 'Yellow' } else { 'DarkGray' }) }

  if ($adds.Count -and $Apply) {
    try {
      $body = @{ Privileges = $adds } | ConvertTo-Json -Depth 5
      Invoke-RestMethod -Method Post -Headers $h -Uri "$api/roles($($role.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" -Body $body | Out-Null
      Write-Host "  granted." -ForegroundColor Green
      $changed++
    } catch {
      Write-Host "  FAILED: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
  } elseif ($adds.Count) { $changed++ }
  Write-Host ""
}

Write-Host ("{0} role(s) {1}." -f $changed, $(if ($Apply) { 'updated' } else { 'would change' })) -ForegroundColor Cyan
