<#
  Creates the two app-owned tables that back job scheduling targets, dates, and
  the production stepper:

    crfdf_jobschedule       — one row per job (keyed by crfdf_jobno):
                              releaseddate (stamped when BC status first = Open),
                              scheduledinstalldate, reddate (drop-dead due date).
                              Target-complete + install window are COMPUTED from
                              releaseddate in the app, so they aren't stored.

    crfdf_jobdeptcompletion — one row per (job, department) marked complete:
                              completedby (user) + completeddate. A department is
                              "completed" when a row exists; the stepper derives
                              included (from planning lines) and active (first
                              not-completed) itself.

  These are app-owned — the BC sync never overwrites scheduled/red dates. Only the
  releaseddate is stamped by the BCSync_Jobs flow (write-once).

  Same device-code auth as the other create-/add- scripts. Run it, open the
  printed URL, enter the code, sign in as asmith@lumineosigns.com. Safe to re-run.
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
    OwnershipType         = 'UserOwned'; HasActivities = $false; HasNotes = $false; IsActivity = $false
    Attributes            = @(
      @{
        '@odata.type'='Microsoft.Dynamics.CRM.StringAttributeMetadata'; AttributeType='String'
        AttributeTypeName=@{ Value='StringType' }; SchemaName='crfdf_Name'; MaxLength=200; IsPrimaryName=$true
        DisplayName=(New-Label 'Name')
      }
    )
  }
  Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host ("+ created table {0}" -f $logical) -ForegroundColor Green
}

function Add-Attr($entity, $body, $logical) {
  $attrUri = "$base/EntityDefinitions(LogicalName='$($entity.ToLower())')/Attributes"
  try {
    Invoke-RestMethod -Method Post -Uri $attrUri -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
    Write-Host ("  + {0}" -f $logical) -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match 'already exists' -or $msg -match 'duplicate') { Write-Host ("  = {0} exists, skipping" -f $logical) -ForegroundColor Yellow }
    else { Write-Host ("  ! {0} failed: {1}" -f $logical, $msg) -ForegroundColor Red }
  }
}
function Str($entity, $schema, $label, $len) {
  Add-Attr $entity @{
    '@odata.type'='Microsoft.Dynamics.CRM.StringAttributeMetadata'; AttributeType='String'
    AttributeTypeName=@{ Value='StringType' }; FormatName=@{ Value='Text' }; MaxLength=$len; SchemaName=$schema
    DisplayName=(New-Label $label)
  } $schema.ToLower()
}
function DateOnly($entity, $schema, $label) {
  Add-Attr $entity @{
    '@odata.type'='Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'; AttributeType='DateTime'
    AttributeTypeName=@{ Value='DateTimeType' }; Format='DateOnly'; DateTimeBehavior=@{ Value='DateOnly' }; SchemaName=$schema
    DisplayName=(New-Label $label)
  } $schema.ToLower()
}

Write-Host "Job schedule table..." -ForegroundColor Cyan
New-Table 'crfdf_JobSchedule' 'Job Schedule' 'Job Schedules'
Str      'crfdf_jobschedule' 'crfdf_JobNo'                'Job No'                 40
DateOnly 'crfdf_jobschedule' 'crfdf_ReleasedDate'         'Released Date'
DateOnly 'crfdf_jobschedule' 'crfdf_ScheduledInstallDate' 'Scheduled Install Date'
DateOnly 'crfdf_jobschedule' 'crfdf_RedDate'              'Red Date'

Write-Host "Job department completion table..." -ForegroundColor Cyan
New-Table 'crfdf_JobDeptCompletion' 'Job Dept Completion' 'Job Dept Completions'
Str      'crfdf_jobdeptcompletion' 'crfdf_JobNo'         'Job No'         40
Str      'crfdf_jobdeptcompletion' 'crfdf_DeptId'        'Department Id'  60
Str      'crfdf_jobdeptcompletion' 'crfdf_CompletedBy'   'Completed By'   200
DateOnly 'crfdf_jobdeptcompletion' 'crfdf_CompletedDate' 'Completed Date'

try {
  Invoke-RestMethod -Method Post -Uri "$base/PublishAllXml" -Headers $headers | Out-Null
  Write-Host "Published all customizations." -ForegroundColor Green
} catch { Write-Host "Publish step skipped." -ForegroundColor Yellow }

Write-Host "Done." -ForegroundColor Cyan
