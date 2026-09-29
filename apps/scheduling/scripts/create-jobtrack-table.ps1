<#
  Creates the JOB TRACKING table - the Airtable "LNI Production Schedule /
  Expeditor" fields that BC doesn't hold, one row per BC job (keyed by job no).

    crfdf_jobtrack
      Identity / overrides
        crfdf_jobno            text   BC job no - the key (also the primary name)
        crfdf_statusoverride   text   manual Current Status (e.g. "Morton - National");
                                      blank = derived from the stepper
        crfdf_priority         text   RED DATE / Rush / ...
      Hold (DIP = days open - days on hold)
        crfdf_holdreason       text   Hold - Customer / Permit / Local / Product Ready ...
        crfdf_datetohold       text   YYYY-MM-DD
        crfdf_dateoffhold      text   YYYY-MM-DD
      Milestones (all YYYY-MM-DD text: date-only, so no time zone can shift them)
        crfdf_orderdate        Order Date (Received)
        crfdf_mfgfinaldate     Mfg Final Date as it was in Airtable (reference)
        crfdf_expeditordate    expeditor finished review + passed to the dept head
        crfdf_dateinstalled
        crfdf_datetoadmin      Complete to Admin (production team done)
        crfdf_dateinvoiced     Complete Invoiced (Admin done)
      Vendor / expediting
        crfdf_vendor, crfdf_ponumber, crfdf_vendorstatus, crfdf_storagelocation,
        crfdf_vendorshipdate, crfdf_vendorshipdate2, crfdf_outsourcedarrival
      Job details
        crfdf_graphics, crfdf_routingtype, crfdf_powerlines, crfdf_sales,
        crfdf_location, crfdf_region, crfdf_mfgregion, crfdf_installregion
        crfdf_ulsign           Yes/No - UL-listed sign, filterable
        crfdf_notes            text 4000 - Job Notes
      Airtable carry-over (kept for reference during the switch-over)
        crfdf_legacystatus, crfdf_legacyprocess

  Red date, the production-complete override (Airtable "Mfg Target Modified")
  and the scheduled install date live in the existing crfdf_jobschedule table.
  Stepper "/" / "X" marks live in crfdf_jobdeptoverride / crfdf_jobdeptcompletion.

  Same device-code auth as the other create-/add- scripts. Safe to re-run.
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

function New-BoolColumn($entity, $schema, $label, $default) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type'     = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
    AttributeType     = 'Boolean'; AttributeTypeName = @{ Value='BooleanType' }
    SchemaName        = $schema
    DisplayName       = (New-Label $label)
    DefaultValue      = $default
    OptionSet         = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
      TrueOption    = @{ Value = 1; Label = (New-Label 'Yes') }
      FalseOption   = @{ Value = 0; Label = (New-Label 'No') }
    }
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
    Write-Host ("  + {0} (bool)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

Write-Host "Job tracking table..." -ForegroundColor Cyan
$t = 'crfdf_jobtrack'
New-Table  'crfdf_JobTrack' 'Job Tracking' 'Job Tracking'
New-Column $t 'crfdf_JobNo'            'Job No'               20
New-Column $t 'crfdf_StatusOverride'   'Status Override'      100
New-Column $t 'crfdf_Priority'         'Priority'             30
New-Column $t 'crfdf_HoldReason'       'Hold Reason'          100
New-Column $t 'crfdf_DateToHold'       'Date To Hold'         10
New-Column $t 'crfdf_DateOffHold'      'Date Off Hold'        10
New-Column $t 'crfdf_OrderDate'        'Order Date'           10
New-Column $t 'crfdf_MfgFinalDate'     'Mfg Final Date'       10
New-Column $t 'crfdf_ExpeditorDate'    'Expeditor Date'       10
New-Column $t 'crfdf_DateInstalled'    'Date Installed'       10
New-Column $t 'crfdf_DateToAdmin'      'Date To Admin'        10
New-Column $t 'crfdf_DateInvoiced'     'Date Invoiced'        10
New-Column $t 'crfdf_Vendor'           'Vendor'               100
New-Column $t 'crfdf_PoNumber'         'PO Number'            50
New-Column $t 'crfdf_VendorStatus'     'Vendor Status'        50
New-Column $t 'crfdf_StorageLocation'  'Storage Location'     100
New-Column $t 'crfdf_VendorShipDate'   'Vendor Ship Date'     10
New-Column $t 'crfdf_VendorShipDate2'  '2nd Vendor Ship Date' 10
New-Column $t 'crfdf_OutsourcedArrival' 'Outsourced Arrival'  10
New-Column $t 'crfdf_Graphics'         'Graphics'             100
New-Column $t 'crfdf_RoutingType'      'Routing Type'         100
New-Column $t 'crfdf_Powerlines'       'Powerlines'           20
New-Column $t 'crfdf_Sales'            'Sales'                100
New-Column $t 'crfdf_Location'         'Location'             100
New-Column $t 'crfdf_Region'           'Region'               10
New-Column $t 'crfdf_MfgRegion'        'Mfg Region'           20
New-Column $t 'crfdf_InstallRegion'    'Install Region'       20
New-BoolColumn $t 'crfdf_UlSign'       'UL Sign'              $false
New-Column $t 'crfdf_Notes'            'Notes'                4000
New-Column $t 'crfdf_LegacyStatus'     'Airtable Current Status' 100
New-Column $t 'crfdf_LegacyProcess'    'Airtable Process'     50

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
