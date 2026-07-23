<#
  Creates the BC planning-step write-back OUTBOX table:

    crfdf_bcpushqueue — one row per pending push to Business Central's
      projectPlanningEntries (sign365) API. The Code App writes a "pending" row
      on every board commit that changes a start/end/assignee or a dept's
      started/complete state; a Dataverse-triggered Power Automate flow
      (BCPush_PlanningSteps) drains it, PATCHes BC, and writes the status back.
      See apps/scheduling/flows/BCPush_PlanningSteps.md.

      Columns:
        crfdf_jobno         (text)  — BC project/job no (projectNo join key)
        crfdf_kind          (text)  — "schedule" | "completion"
        crfdf_planningstep  (text)  — BC planningStepDescription (join key)
        crfdf_deptkey       (text)  — app department id (completion resolution)
        crfdf_startdatetime (date+time)
        crfdf_enddatetime   (date+time)
        crfdf_assignedto    (text)  — app employee id; flow maps → BC resource
        crfdf_assignedtoname(text)
        crfdf_complete      (Yes/No)
        crfdf_started       (Yes/No)
        crfdf_status        (text)  — "pending" | "synced" | "failed" (flow writes)
        crfdf_statusmessage (text)  — BC error / systemId written by the flow
        crfdf_sourcelineid  (text)  — schedule-line id (traceability / de-dupe)

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

function New-DateTimeColumn($entity, $schema, $label) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  $body = @{
    '@odata.type'     = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    AttributeType     = 'DateTime'; AttributeTypeName = @{ Value='DateTimeType' }
    Format            = 'DateAndTime'; SchemaName = $schema
    DisplayName       = (New-Label $label)
  }
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0} (datetime)" -f $schema.ToLower()) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $schema.ToLower()) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $schema.ToLower(), $msg) -ForegroundColor Red }
  }
}

Write-Host "BC push-queue (outbox) table…" -ForegroundColor Cyan
New-Table 'crfdf_BcPushQueue' 'BC Push Queue' 'BC Push Queue'
New-Column         'crfdf_bcpushqueue' 'crfdf_JobNo'          'Job No'           40
New-Column         'crfdf_bcpushqueue' 'crfdf_Kind'           'Kind'             20
New-Column         'crfdf_bcpushqueue' 'crfdf_PlanningStep'   'Planning Step'    200
New-Column         'crfdf_bcpushqueue' 'crfdf_DeptKey'        'Dept Key'         50
New-DateTimeColumn 'crfdf_bcpushqueue' 'crfdf_StartDateTime'  'Start Date Time'
New-DateTimeColumn 'crfdf_bcpushqueue' 'crfdf_EndDateTime'    'End Date Time'
New-Column         'crfdf_bcpushqueue' 'crfdf_AssignedTo'     'Assigned To'      50
New-Column         'crfdf_bcpushqueue' 'crfdf_AssignedToName' 'Assigned To Name' 100
New-BoolColumn     'crfdf_bcpushqueue' 'crfdf_Complete'       'Complete'         $false
New-BoolColumn     'crfdf_bcpushqueue' 'crfdf_Started'        'Started'          $false
New-Column         'crfdf_bcpushqueue' 'crfdf_Status'         'Status'           20
New-Column         'crfdf_bcpushqueue' 'crfdf_StatusMessage'  'Status Message'   400
New-Column         'crfdf_bcpushqueue' 'crfdf_SourceLineId'   'Source Line Id'   50

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
