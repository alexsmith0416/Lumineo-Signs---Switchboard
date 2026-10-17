<#
  Bucket Lists (Oct 17, 2026) — two tables for the Job Queue's "Bucket Lists" tab:

    crfdf_bucketlist  — a named, coloured, ongoing list of jobs per board
                        (production / install-wk / install-nek). Manual, or
                        filled by a filter on the BC data already in Dataverse
                        (crfdf_filter = JSON). crfdf_deptkey = the stepper
                        department whose completion drops a job off the list.
                        crfdf_defaultemployees = JSON ids of people whose free
                        time this bucket fills every day (standing assignment).
    crfdf_bucketitem  — a job on a list. Ordered by released date unless moved
                        by hand (crfdf_pinned + crfdf_sortorder).

  Items point at their list by a plain GUID string (crfdf_bucketid), like the
  Job Queue tables — no Dataverse relationship needed.

  Then gives every security role the SAME access to both tables that it has to
  crfdf_jobqueueitem today (Create / Read / Write / Delete, same depth) — the
  people who can edit the Job Queue can edit Bucket Lists.

  Device-code auth (az is blocked by the proxy). Run it, open the printed URL,
  enter the code, sign in as asmith@lumineosigns.com (needs System
  Administrator / System Customizer). Safe to re-run: existing tables, columns
  and privileges are skipped.
#>

$ErrorActionPreference = 'Stop'
$tenant   = 'fe0182fa-d183-46ab-8493-9e8ea9c3d0b8'
$org      = 'https://org8fa22efd.crm.dynamics.com'
$clientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'   # Azure CLI public client (device-code capable)

# --- Device-code auth ---------------------------------------------------------
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

$headers = @{
  Authorization      = "Bearer $token"
  'Content-Type'     = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  Accept             = 'application/json'
}
$base = "$org/api/data/v9.2"

function New-Label($text) {
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
     LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $text; LanguageCode = 1033 }) }
}

function New-Table($schema, $displayName, $pluralName) {
  $logical = $schema.ToLower()
  try {
    Invoke-RestMethod -Method Get -Uri "$base/EntityDefinitions(LogicalName='$logical')" -Headers $headers | Out-Null
    Write-Host ("= table {0} already exists, skipping create" -f $logical) -ForegroundColor Yellow
    return
  } catch { }
  $body = @{
    '@odata.type'          = 'Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName             = $schema
    DisplayName            = (New-Label $displayName)
    DisplayCollectionName  = (New-Label $pluralName)
    OwnershipType          = 'UserOwned'
    HasActivities          = $false
    HasNotes               = $false
    IsActivity             = $false
    Attributes             = @(
      @{
        '@odata.type'      = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        AttributeType      = 'String'
        AttributeTypeName  = @{ Value = 'StringType' }
        SchemaName         = 'crfdf_Name'
        MaxLength          = 300
        IsPrimaryName      = $true
        DisplayName        = (New-Label 'Name')
      }
    )
  }
  Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host ("+ created table {0}" -f $logical) -ForegroundColor Green
}

function New-Column($entity, $schema, $label, $kind, $maxLen) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $logical = $schema.ToLower()
  switch ($kind) {
    'String' {
      $body = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'; AttributeType = 'String'
        AttributeTypeName = @{ Value = 'StringType' }; SchemaName = $schema; MaxLength = $maxLen; DisplayName = (New-Label $label) }
    }
    'Memo' {
      $body = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; AttributeType = 'Memo'
        AttributeTypeName = @{ Value = 'MemoType' }; SchemaName = $schema; MaxLength = $maxLen; DisplayName = (New-Label $label) }
    }
    'Integer' {
      $body = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'; AttributeType = 'Integer'
        AttributeTypeName = @{ Value = 'IntegerType' }; SchemaName = $schema; MinValue = 0; MaxValue = 1000000; DisplayName = (New-Label $label) }
    }
    'Decimal' {
      $body = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'; AttributeType = 'Decimal'
        AttributeTypeName = @{ Value = 'DecimalType' }; SchemaName = $schema; Precision = 2; MinValue = 0; MaxValue = 100000000; DisplayName = (New-Label $label) }
    }
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0}" -f $logical) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') {
      Write-Host ("  = {0} already exists, skipping" -f $logical) -ForegroundColor Yellow
    } else {
      Write-Host ("  ! {0} failed: {1}" -f $logical, $msg) -ForegroundColor Red
    }
  }
}

# --- crfdf_bucketlist -----------------------------------------------------------
Write-Host "Bucket lists table..." -ForegroundColor Cyan
New-Table 'crfdf_BucketList' 'Bucket List' 'Bucket Lists'
New-Column 'crfdf_bucketlist' 'crfdf_Kind'             'Kind'              'String' 40
New-Column 'crfdf_bucketlist' 'crfdf_Color'            'Color'             'String' 20
New-Column 'crfdf_bucketlist' 'crfdf_TextColor'        'Text Color'        'String' 20
New-Column 'crfdf_bucketlist' 'crfdf_Description'      'Description'       'String' 2000
New-Column 'crfdf_bucketlist' 'crfdf_Mode'             'Mode'              'String' 20
New-Column 'crfdf_bucketlist' 'crfdf_Filter'           'Filter'            'Memo'   20000
New-Column 'crfdf_bucketlist' 'crfdf_DeptKey'          'Department Key'    'String' 40
New-Column 'crfdf_bucketlist' 'crfdf_DefaultEmployees' 'Default Employees' 'Memo'   20000
New-Column 'crfdf_bucketlist' 'crfdf_SortOrder'        'Sort Order'        'Integer' 0
New-Column 'crfdf_bucketlist' 'crfdf_Collapsed'        'Collapsed'         'Integer' 0

# --- crfdf_bucketitem -----------------------------------------------------------
Write-Host "Bucket items table..." -ForegroundColor Cyan
New-Table 'crfdf_BucketItem' 'Bucket Item' 'Bucket Items'
New-Column 'crfdf_bucketitem' 'crfdf_BucketId'       'Bucket Id'       'String' 60
New-Column 'crfdf_bucketitem' 'crfdf_JobNo'          'Job No'          'String' 40
New-Column 'crfdf_bucketitem' 'crfdf_CustomerName'   'Customer Name'   'String' 200
New-Column 'crfdf_bucketitem' 'crfdf_Task'           'Task'            'String' 2000
New-Column 'crfdf_bucketitem' 'crfdf_EstimatedHours' 'Estimated Hours' 'Decimal' 0
New-Column 'crfdf_bucketitem' 'crfdf_ReleasedDate'   'Released Date'   'String' 20
New-Column 'crfdf_bucketitem' 'crfdf_SortOrder'      'Sort Order'      'Integer' 0
New-Column 'crfdf_bucketitem' 'crfdf_Pinned'         'Pinned'          'Integer' 0
New-Column 'crfdf_bucketitem' 'crfdf_Source'         'Source'          'String' 20

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped (schema is usable regardless)." -ForegroundColor Yellow }

# --- Privileges: mirror crfdf_jobqueueitem -----------------------------------------
Write-Host ""; Write-Host "Role access (same as the Job Queue items table)..." -ForegroundColor Cyan
$SOURCE = 'crfdf_jobqueueitem'
$TARGETS = @('crfdf_bucketlist', 'crfdf_bucketitem')
$VERBS = @('Create', 'Read', 'Write', 'Delete')
$names = @()
foreach ($v in $VERBS) { $names += "prv$v$SOURCE"; foreach ($t in $TARGETS) { $names += "prv$v$t" } }
$filter = ($names | ForEach-Object { "name eq '$_'" }) -join ' or '
$priv = @{}
$tries = 0
do {
  $privs = (Invoke-RestMethod -Headers $headers -Uri "$base/privileges?`$select=name,privilegeid,canbebasic,canbelocal,canbedeep,canbeglobal&`$filter=$filter").value
  foreach ($p in $privs) { $priv[$p.name] = $p }
  $missing = @($names | Where-Object { -not $priv[$_] })
  if ($missing.Count) { $tries++; Start-Sleep -Seconds 10 }
} while ($missing.Count -and $tries -lt 12)
if ($missing.Count) { throw "Privileges not found yet: $($missing -join ', ') - re-run this script in a minute." }

$RANK = @{ Basic = 1; Local = 2; Deep = 3; Global = 4 }
function DepthOf($rolePrivs, $privName) {
  $id = $priv[$privName].privilegeid
  $best = $null
  foreach ($rp in $rolePrivs) {
    if ($rp.PrivilegeId -eq $id -and (-not $best -or $RANK[$rp.Depth] -gt $RANK[$best])) { $best = [string]$rp.Depth }
  }
  return $best
}
function FitDepth($privName, $want) {
  $p = $priv[$privName]
  $ok = @{ Basic = $p.canbebasic; Local = $p.canbelocal; Deep = $p.canbedeep; Global = $p.canbeglobal }
  foreach ($d in @('Global', 'Deep', 'Local', 'Basic')) { if ($RANK[$d] -le $RANK[$want] -and $ok[$d]) { return $d } }
  foreach ($d in @('Basic', 'Local', 'Deep', 'Global')) { if ($ok[$d]) { return $d } }
}

$srcId = $priv["prvRead$SOURCE"].privilegeid
$roles = (Invoke-RestMethod -Headers $headers -Uri "$base/privileges($srcId)/roleprivileges_association?`$select=name,roleid,_businessunitid_value,_parentroleid_value").value |
  Where-Object { -not $_._parentroleid_value } | Sort-Object name
foreach ($role in $roles) {
  $rps = (Invoke-RestMethod -Headers $headers -Uri "$base/RetrieveRolePrivilegesRole(RoleId=@r)?@r=$($role.roleid)").RolePrivileges
  $adds = @()
  foreach ($v in $VERBS) {
    $want = DepthOf $rps "prv$v$SOURCE"
    if (-not $want) { continue }
    foreach ($t in $TARGETS) {
      $name = "prv$v$t"
      $target = FitDepth $name $want
      $have = DepthOf $rps $name
      if ($have -and $RANK[$have] -ge $RANK[$target]) { continue }
      $adds += @{ PrivilegeId = $priv[$name].privilegeid; PrivilegeName = $name; Depth = $target; BusinessUnitId = $role._businessunitid_value }
    }
  }
  if (-not $adds.Count) { Write-Host ("  = {0}: already set" -f $role.name) -ForegroundColor DarkGray; continue }
  try {
    Invoke-RestMethod -Method Post -Headers $headers -Uri "$base/roles($($role.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" `
      -Body (@{ Privileges = $adds } | ConvertTo-Json -Depth 5) | Out-Null
    Write-Host ("  + {0}: {1} privilege(s)" -f $role.name, $adds.Count) -ForegroundColor Green
  } catch {
    Write-Host ("  ! {0}: {1}" -f $role.name, $_.ErrorDetails.Message) -ForegroundColor Red
  }
}

Write-Host ""; Write-Host "Done." -ForegroundColor Cyan
