<#
  Creates the week-scoped roster override table that backs the "just this week"
  option when reordering a name or moving someone to a different department /
  location:

    crfdf_rosteroverride — one row per (employee, week, board): where that
                           person sits on the schedule for that week only.

  The app loads these per week and overlays them on the permanent roster (the
  override wins for that week). A "permanent" move edits the employee record
  instead and clears any override for that week. One row per employee/week/board
  (upserted), so repeated this-week moves just update the row.

  Same device-code auth as the other create-/add- scripts. Run it, open the
  printed URL, enter the code, sign in as asmith@lumineosigns.com. Safe to
  re-run: the table/columns are skipped if they already exist.
#>

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
$base = "$org/api/data/v9.2"

function New-Label($text) {
  @{ '@odata.type'='Microsoft.Dynamics.CRM.Label'
     LocalizedLabels=@(@{ '@odata.type'='Microsoft.Dynamics.CRM.LocalizedLabel'; Label=$text; LanguageCode=1033 }) }
}

function New-Table($schema, $displayName, $pluralName) {
  $logical = $schema.ToLower()
  try {
    Invoke-RestMethod -Method Get -Uri "$base/EntityDefinitions(LogicalName='$logical')" -Headers $headers | Out-Null
    Write-Host ("= table {0} already exists, skipping create" -f $logical) -ForegroundColor Yellow
    return
  } catch { }
  $body = @{
    '@odata.type'         = 'Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName            = $schema
    DisplayName           = (New-Label $displayName)
    DisplayCollectionName = (New-Label $pluralName)
    OwnershipType         = 'UserOwned'
    HasActivities         = $false
    HasNotes              = $false
    IsActivity            = $false
    Attributes            = @(
      @{
        '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        AttributeType     = 'String'; AttributeTypeName = @{ Value='StringType' }
        SchemaName        = 'crfdf_Name'; MaxLength = 300; IsPrimaryName = $true
        DisplayName       = (New-Label 'Name')
      }
    )
  }
  Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host ("+ created table {0}" -f $logical) -ForegroundColor Green
}

function New-Column($entity, $schema, $label, $maxLen) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type'     = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    AttributeType     = 'String'; AttributeTypeName = @{ Value='StringType' }
    FormatName        = @{ Value='Text' }; MaxLength = $maxLen; SchemaName = $schema
    DisplayName       = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0}" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

Write-Host "Roster override table…" -ForegroundColor Cyan
New-Table 'crfdf_RosterOverride' 'Roster Override' 'Roster Overrides'
New-Column 'crfdf_rosteroverride' 'crfdf_EmployeeId'    'Employee Id'    60
New-Column 'crfdf_rosteroverride' 'crfdf_WeekStart'     'Week Start'     12
New-Column 'crfdf_rosteroverride' 'crfdf_BoardKind'     'Board Kind'     20
New-Column 'crfdf_rosteroverride' 'crfdf_DepartmentId'  'Department Id'  60
New-Column 'crfdf_rosteroverride' 'crfdf_Position'      'Position'       12

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
