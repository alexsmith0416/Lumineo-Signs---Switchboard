<#
  Creates (or tops up) the Dataverse security role "Lumineo Scheduler User" —
  what a NON-admin needs to use the Project Scheduler. Until now only System
  Administrators could: no custom role granted any crfdf_ table (checked Oct 6
  with scripts/grant-newtable-privileges.ps1).

  The app talks to Dataverse through the Dataverse connector AS THE SIGNED-IN
  USER, so this role decides what every call may do. Who may EDIT what is
  decided in the app (user type in Settings → Users, Jobs field grants), so the
  role gives every user the table rights the app's code paths need:

    - Organization depth on everything: boards, queues and Jobs rows are shared
      — a Basic ("own records") depth would hide everyone else's cards.
    - Only the operations the app actually performs on each table (taken from
      services/dataverse-live.ts, Oct 6). Tables filled by BC sync flows are
      Read only. Nothing gets Assign / Share.
    - Append + AppendTo on all of them (lookups between app tables).

  ⚠️ The app's environment ("Alex Smith's Environment") is a DEVELOPER
  environment: only its owner + tenant / Power Platform admins get in. Oct 6
  dry run: 29 of 32 Settings → Users logins aren't Dataverse users there at
  all. Non-admins need the app in a Sandbox / Production environment — run this
  there with -Org <url> (and add the users to that environment first).

  ⚠️ Users also need Microsoft's built-in "Basic User" role (core tables like
  systemuser). -AssignAppUsers adds both.

  Dry run by default: shows the role's current vs planned privileges and every
  login in Settings → Users (crfdf_appuser) with their Dataverse roles today.
    -Apply            create the role / add missing privileges (never removes)
    -AssignAppUsers   with -Apply: give every enabled crfdf_appuser login that
                      isn't a System Administrator this role + Basic User

  Uses the Web API with a device-code token (az is blocked by the proxy).
  Run it, open the printed URL, enter the code, sign in as asmith@lumineosigns.com.
  Safe to re-run.
#>
param(
  [switch]$Apply,
  [switch]$AssignAppUsers,
  # Default = the app's current (Developer) environment. Pass the production
  # org URL at cutover — a Developer environment only admits its owner + admins.
  [string]$Org = 'https://org8fa22efd.crm.dynamics.com'
)

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = $Org.TrimEnd('/')
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'
$ROLE_NAME = 'Lumineo Scheduler User'

# Entity set → operations the app performs (R read, C create, W write/update, D delete).
$TABLES = [ordered]@{
  # Production board
  'crfdf_department1s'             = 'R'
  'crfdf_employee1s'               = 'RCWD'
  'crfdf_productionschedulelines'  = 'RCWD'
  # Installation + shipping boards
  'crfdf_installationemployeeses'  = 'RCWD'
  'crfdf_installcards'             = 'RCWD'
  'crfdf_shipmentloads'            = 'RCWD'
  'crfdf_shipmentitems'            = 'RCWD'
  'crfdf_rosteroverrides'          = 'RCWD'
  'crfdf_customcardpresets'        = 'RCWD'
  'crfdf_jobqueuegroups'           = 'RCWD'
  'crfdf_jobqueueitems'            = 'RCWD'
  # Steppers + job dates
  'crfdf_jobschedules'             = 'RCW'
  'crfdf_jobdeptcompletions'       = 'RCWD'
  'crfdf_jobdeptoverrides'         = 'RCWD'
  'crfdf_bcpushqueues'             = 'RC'     # the app queues BC pushes; the flow drains them
  # Jobs list
  'crfdf_jobtracks'                = 'RCW'
  'crfdf_jobfields'                = 'RCWD'
  'crfdf_jobsviews'                = 'RCW'
  'crfdf_jobsketchs'               = 'RCW'
  'crfdf_taskcompletions'          = 'RW'     # rows come from BCSync_TaskCompletions
  # Settings
  'crfdf_appusers'                 = 'RCWD'
  'crfdf_billingperiods'           = 'RCW'
  'crfdf_leadtimerules'            = 'RCWD'
  # Read-only: filled by BC sync / weather flows
  'crfdf_bcjobs'                   = 'R'
  'crfdf_bcplanninglines'          = 'R'
  'crfdf_bcbillinglines'           = 'R'
  'crfdf_bccustomers'              = 'R'
  'crfdf_jobpos'                   = 'R'
  'crfdf_jobdescs'                 = 'R'
  # Warehouse Management (Oct 8) — keyed by LOGICAL name (the set name is looked up).
  'crfdf_poreceipt'                = 'RCW'
  'crfdf_podelivery'               = 'RCWD'
  'lum_weathercaches'              = 'R'
}
$OPS = @{ R = 'Read'; C = 'Create'; W = 'Write'; D = 'Delete' }

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
function Get-Json($path) { Invoke-RestMethod -Headers $h -Uri "$api/$path" }

# --- entity sets → logical names -> wanted privilege names ---------------------
$wanted = [ordered]@{}   # privilege name → table
$logical = @{}           # entity set → logical name
foreach ($set in $TABLES.Keys) {
  # A key is an entity set, or a table's logical name (newer tables — prints the set).
  $def = (Get-Json "EntityDefinitions?`$select=LogicalName,EntitySetName&`$filter=EntitySetName eq '$set' or LogicalName eq '$set'").value
  if (-not $def) { throw "No table with entity set or logical name '$set' — renamed or not created?" }
  $ln = $def[0].LogicalName
  if ($ln -eq $set) { Write-Host ("  {0} -> entity set {1}" -f $ln, $def[0].EntitySetName) -ForegroundColor Yellow }
  $logical[$set] = $ln
  foreach ($op in $TABLES[$set].ToCharArray()) { $wanted["prv$($OPS[[string]$op])$ln"] = $ln }
  $wanted["prvAppend$ln"] = $ln
  $wanted["prvAppendTo$ln"] = $ln
}

$priv = @{}
$names = @($wanted.Keys)
for ($i = 0; $i -lt $names.Count; $i += 40) {
  $chunk = $names[$i..([Math]::Min($i + 39, $names.Count - 1))]
  $filter = ($chunk | ForEach-Object { "name eq '$_'" }) -join ' or '
  foreach ($p in (Get-Json "privileges?`$select=name,privilegeid,canbeglobal&`$filter=$filter").value) { $priv[$p.name] = $p }
}
$missing = $names | Where-Object { -not $priv[$_] }
if ($missing) { throw "Privileges not found: $($missing -join ', ')" }

# --- the role ------------------------------------------------------------------
$rootBu = (Get-Json "businessunits?`$select=businessunitid,name&`$filter=_parentbusinessunitid_value eq null").value[0]
$role = (Get-Json "roles?`$select=roleid,name&`$filter=name eq '$ROLE_NAME' and _businessunitid_value eq $($rootBu.businessunitid)").value | Select-Object -First 1
$have = @{}
if ($role) {
  foreach ($rp in (Get-Json "RetrieveRolePrivilegesRole(RoleId=@r)?@r=$($role.roleid)").RolePrivileges) { $have[[string]$rp.PrivilegeId] = [string]$rp.Depth }
}
$adds = @()
foreach ($n in $names) {
  $id = [string]$priv[$n].privilegeid
  if ($have[$id] -eq 'Global') { continue }
  $adds += @{ PrivilegeId = $id; PrivilegeName = $n; Depth = 'Global'; BusinessUnitId = $rootBu.businessunitid }
}

Write-Host ""
Write-Host ("Role '{0}' in business unit '{1}': {2}" -f $ROLE_NAME, $rootBu.name, $(if ($role) { 'exists' } else { 'NOT created yet' })) -ForegroundColor Cyan
Write-Host ("{0} tables, {1} privileges wanted (Organization depth), {2} to add." -f $TABLES.Count, $names.Count, $adds.Count) -ForegroundColor Cyan
foreach ($set in $TABLES.Keys) {
  $ln = $logical[$set]
  $opText = ($TABLES[$set].ToCharArray() | ForEach-Object { $OPS[[string]$_] }) -join ' '   # not $ops: names ignore case
  Write-Host ("  {0,-34} {1}" -f $ln, $opText) -ForegroundColor DarkGray
}

# --- app logins and their roles today -----------------------------------------
$appUsers = (Get-Json "crfdf_appusers?`$select=crfdf_email,crfdf_usertype&`$orderby=crfdf_email").value | Where-Object { $_.crfdf_email }
$basic = (Get-Json "roles?`$select=roleid,name&`$filter=name eq 'Basic User' and _businessunitid_value eq $($rootBu.businessunitid)").value | Select-Object -First 1
$toAssign = @()
Write-Host ""
Write-Host ("Logins in Settings → Users: {0}" -f @($appUsers).Count) -ForegroundColor Cyan
foreach ($u in $appUsers) {
  $email = $u.crfdf_email.Trim().ToLower()
  $su = (Get-Json "systemusers?`$select=systemuserid,fullname,isdisabled&`$filter=internalemailaddress eq '$email' or domainname eq '$email'&`$expand=systemuserroles_association(`$select=name)").value | Select-Object -First 1
  if (-not $su) { Write-Host ("  {0,-38} {1,-12} NOT a Dataverse user in this environment" -f $email, $u.crfdf_usertype) -ForegroundColor Red; continue }
  $rn = @($su.systemuserroles_association | ForEach-Object { $_.name })
  $isAdmin = $rn -contains 'System Administrator'
  $state = if ($su.isdisabled) { 'disabled' } elseif ($isAdmin) { 'admin — skip' } elseif ($rn -contains $ROLE_NAME -and $rn -contains 'Basic User') { 'has role' } else { 'WOULD ASSIGN' }
  $color = if ($state -eq 'WOULD ASSIGN') { 'Yellow' } elseif ($state -eq 'disabled') { 'Red' } else { 'DarkGray' }
  Write-Host ("  {0,-38} {1,-12} {2,-14} roles: {3}" -f $email, $u.crfdf_usertype, $state, $(if ($rn) { $rn -join ', ' } else { '(none)' })) -ForegroundColor $color
  if ($state -eq 'WOULD ASSIGN') { $toAssign += @{ su = $su; roles = $rn } }
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run — nothing changed. -Apply creates the role; -Apply -AssignAppUsers also assigns it." -ForegroundColor Cyan
  return
}

# --- apply ---------------------------------------------------------------------
if (-not $role) {
  $body = @{
    name = $ROLE_NAME
    description = 'Project Scheduler (Lumineo) — table access for non-admin users. Edit rights are decided in the app. Built by apps/scheduling/scripts/create-scheduler-user-role.ps1.'
    'businessunitid@odata.bind' = "/businessunits($($rootBu.businessunitid))"
  } | ConvertTo-Json
  $r = Invoke-WebRequest -Method Post -Headers $h -Uri "$api/roles" -Body $body
  $roleId = ([regex]'\(([0-9a-f-]{36})\)').Match($r.Headers['OData-EntityId']).Groups[1].Value
  $role = @{ roleid = $roleId; name = $ROLE_NAME }
  Write-Host "Created role $roleId." -ForegroundColor Green
}
if ($adds.Count) {
  $body = @{ Privileges = $adds } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Headers $h -Uri "$api/roles($($role.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" -Body $body | Out-Null
  Write-Host "Added $($adds.Count) privileges." -ForegroundColor Green
}

if ($AssignAppUsers) {
  foreach ($t in $toAssign) {
    foreach ($want in @(@{ id = $role.roleid; name = $ROLE_NAME }, @{ id = $basic.roleid; name = 'Basic User' })) {
      if ($t.roles -contains $want.name) { continue }
      $ref = @{ '@odata.id' = "$api/roles($($want.id))" } | ConvertTo-Json
      try {
        Invoke-RestMethod -Method Post -Headers $h -Uri "$api/systemusers($($t.su.systemuserid))/systemuserroles_association/`$ref" -Body $ref | Out-Null
        Write-Host ("  {0}: + {1}" -f $t.su.fullname, $want.name) -ForegroundColor Green
      } catch {
        Write-Host ("  {0}: FAILED {1} — {2}" -f $t.su.fullname, $want.name, $_.ErrorDetails.Message) -ForegroundColor Red
      }
    }
  }
}
Write-Host "Done." -ForegroundColor Cyan
