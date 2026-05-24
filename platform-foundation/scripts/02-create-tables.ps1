<#
.SYNOPSIS
    Creates all 19 Lumineo Dataverse tables via Web API. Safe to re-run (skips existing tables).

.PARAMETER EnvironmentUrl
    Your Power Platform environment URL, e.g. https://myorg.crm.dynamics.com

.EXAMPLE
    .\02-create-tables.ps1 -EnvironmentUrl "https://myorg.crm.dynamics.com"
#>
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentUrl
)

$ErrorActionPreference = "Stop"

Write-Host "=== Lumineo Platform Foundation — Create Tables ===" -ForegroundColor Cyan

# --- Auth token ---
$token = (pac auth token 2>&1 | Select-String "Bearer (.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
if (-not $token) {
    Write-Error "No PAC auth token found. Run 01-setup.ps1 first."
    exit 1
}

$apiBase = $EnvironmentUrl.TrimEnd('/') + "/api/data/v9.2"
$headers = @{
    Authorization      = "Bearer $token"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    Accept             = "application/json"
    "Content-Type"     = "application/json"
}

# --- Helper: label object ---
function lbl($text) {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $text; LanguageCode = 1033 }); UserLocalizedLabel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $text; LanguageCode = 1033 } }
}

# --- Helper: required level ---
function rl($level = "None") {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = $level; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
}

# --- Attribute type helpers ---
function str($name, $display, $maxLen = 100, $req = "None") {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; SchemaName = $name; DisplayName = lbl $display; RequiredLevel = rl $req; MaxLength = $maxLen; FormatName = @{ Value = "Text" } }
}

function memo($name, $display, $maxLen = 2000) {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; SchemaName = $name; DisplayName = lbl $display; RequiredLevel = rl "None"; MaxLength = $maxLen }
}

function num($name, $display, $min = 0, $max = 2147483647) {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"; SchemaName = $name; DisplayName = lbl $display; RequiredLevel = rl "None"; MinValue = $min; MaxValue = $max }
}

function dec($name, $display, $precision = 2) {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.DecimalAttributeMetadata"; SchemaName = $name; DisplayName = lbl $display; RequiredLevel = rl "None"; Precision = $precision; MinValue = -100000000000; MaxValue = 100000000000 }
}

function dt($name, $display) {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; SchemaName = $name; DisplayName = lbl $display; RequiredLevel = rl "None"; Format = "DateAndTime"; DateTimeBehavior = @{ Value = "UserLocal" } }
}

function do_($name, $display) {
    return @{ "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; SchemaName = $name; DisplayName = lbl $display; RequiredLevel = rl "None"; Format = "DateOnly"; DateTimeBehavior = @{ Value = "DateOnly" } }
}

function bool_($name, $display) {
    return @{
        "@odata.type" = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
        SchemaName    = $name
        DisplayName   = lbl $display
        RequiredLevel = rl "None"
        OptionSet     = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"
            TrueOption    = @{ Value = 1; Label = lbl "Yes" }
            FalseOption   = @{ Value = 0; Label = lbl "No" }
        }
    }
}

function pick($name, $display, [hashtable[]]$options) {
    $opts = $options | ForEach-Object {
        @{ "@odata.type" = "Microsoft.Dynamics.CRM.OptionMetadata"; Value = $_.Value; Label = lbl $_.Label }
    }
    return @{
        "@odata.type" = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        SchemaName    = $name
        DisplayName   = lbl $display
        RequiredLevel = rl "None"
        OptionSet     = @{
            "@odata.type"  = "Microsoft.Dynamics.CRM.OptionSetMetadata"
            IsGlobal       = $false
            OptionSetType  = "Picklist"
            Options        = $opts
        }
    }
}

# File column — Dataverse File type (up to 128 MB per file)
function file_($name, $display, $maxSizeKB = 131072) {
    return @{
        "@odata.type" = "Microsoft.Dynamics.CRM.FileAttributeMetadata"
        SchemaName    = $name
        DisplayName   = lbl $display
        RequiredLevel = rl "None"
        MaxSizeInKB   = $maxSizeKB
    }
}

# --- Create table helper ---
function New-Table($logicalName, $displayName, $pluralName, $description, $attributes) {
    # Check if exists
    try {
        $check = Invoke-RestMethod `
            -Uri "$apiBase/EntityDefinitions(LogicalName='$logicalName')?`$select=LogicalName" `
            -Headers $headers -Method GET -ErrorAction Stop
        Write-Host "  SKIPPED  $logicalName (already exists)" -ForegroundColor DarkGray
        return
    } catch {
        if ($_.Exception.Response.StatusCode -ne 404) { throw }
    }

    $body = @{
        "@odata.type"          = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName             = ($logicalName.Substring(0,1).ToUpper() + $logicalName.Substring(1))
        DisplayName            = lbl $displayName
        DisplayCollectionName  = lbl $pluralName
        Description            = lbl $description
        OwnershipType          = "UserOwned"
        HasActivities          = $false
        HasNotes               = $false
        IsActivity             = $false
        Attributes             = @(
            @{
                "@odata.type"     = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
                SchemaName        = ($logicalName + "_name")
                RequiredLevel     = rl "ApplicationRequired"
                MaxLength         = 200
                FormatName        = @{ Value = "Text" }
                IsPrimaryName     = $true
                DisplayName       = lbl "Name"
            }
        ) + $attributes
    } | ConvertTo-Json -Depth 20

    try {
        Invoke-RestMethod -Uri "$apiBase/EntityDefinitions" -Headers $headers -Method POST -Body $body | Out-Null
        Write-Host "  CREATED  $logicalName" -ForegroundColor Green
    } catch {
        $msg = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        Write-Host "  ERROR    $logicalName — $($msg.error.message ?? $_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nCreating 19 tables..." -ForegroundColor Yellow

# 1. lum_UserProfile
New-Table "lum_userprofile" "User Profile" "User Profiles" "Entra ID -> Dataverse user record with role and preferences" @(
    str  "lum_azureadobjectid"  "Azure AD Object ID"  100 "SystemRequired"
    str  "lum_email"            "Email"               255
    str  "lum_role"             "Role"                100
    str  "lum_department"       "Department"          100
    str  "lum_jobtitle"         "Job Title"           100
    bool_ "lum_isactive"        "Is Active"
)

# 2. lum_Job
New-Table "lum_job" "Job" "Jobs" "Core job/project record linked to BC Sales Orders" @(
    str  "lum_jobnumber"    "Job Number"     50
    str  "lum_customername" "Customer Name"  200
    str  "lum_status"       "Status"         100
    dt   "lum_startdate"    "Start Date"
    dt   "lum_duedate"      "Due Date"
    str  "lum_bcsalesorderid" "BC Sales Order ID" 100
    memo "lum_notes"        "Notes"
)

# 3. lum_Task
New-Table "lum_task" "Task" "Tasks" "Subtasks assigned to jobs and crew members" @(
    str  "lum_description"  "Description"    500
    str  "lum_status"       "Status"         100
    str  "lum_assignedto"   "Assigned To"    100
    dt   "lum_duedate"      "Due Date"
    bool_ "lum_iscomplete"  "Is Complete"
)

# 4. lum_TimeEntry
New-Table "lum_timeentry" "Time Entry" "Time Entries" "Clock-in/out records for production and installation crew" @(
    dt   "lum_clockin"     "Clock In"
    dt   "lum_clockout"    "Clock Out"
    dec  "lum_hoursworked" "Hours Worked"
    str  "lum_crewmember"  "Crew Member"    200
    memo "lum_notes"       "Notes"
)

# 5. lum_Photo — Dataverse File column (up to 128 MB per photo)
New-Table "lum_photo" "Photo" "Photos" "Job site photos captured by crew; stored as Dataverse File columns" @(
    file_ "lum_photofile"   "Photo File"
    str  "lum_caption"      "Caption"        500
    str  "lum_jobreference" "Job Reference"  100
    str  "lum_takenby"      "Taken By"       200
    dt   "lum_takendatetime" "Taken Date/Time"
    str  "lum_thumbnailurl" "Thumbnail URL"  500
)

# 6. lum_SignSpec
New-Table "lum_signspec" "Sign Spec" "Sign Specs" "Sign specifications created in Sign Builder Pro" @(
    str  "lum_signtype"     "Sign Type"      100
    str  "lum_material"     "Material"       100
    dec  "lum_width"        "Width (in)"
    dec  "lum_height"       "Height (in)"
    str  "lum_finishcolor"  "Finish Color"   100
    str  "lum_vinylcolor"   "Vinyl Color"    100
    memo "lum_specjson"     "Spec JSON"      8000
    str  "lum_status"       "Status"         100
)

# 7. lum_Opportunity
New-Table "lum_opportunity" "Opportunity" "Opportunities" "Sales opportunities tracked in Sales Hub" @(
    str  "lum_customername" "Customer Name"  200
    dec  "lum_estimatedvalue" "Estimated Value"
    str  "lum_stage"        "Stage"          100
    str  "lum_ownerusername" "Owner"         200
    dt   "lum_expectedclosedate" "Expected Close Date"
    memo "lum_notes"        "Notes"
)

# 8. lum_Announcement
New-Table "lum_announcement" "Announcement" "Announcements" "Home screen announcements shown to all staff" @(
    memo "lum_body"         "Body"           2000
    str  "lum_priority"     "Priority"       50
    dt   "lum_startdate"    "Start Date"
    dt   "lum_enddate"      "End Date"
    bool_ "lum_isactive"    "Is Active"
)

# 9. lum_Event
New-Table "lum_event" "Event" "Events" "Calendar events displayed on home screens" @(
    memo "lum_description"  "Description"    1000
    dt   "lum_startdatetime" "Start Date/Time"
    dt   "lum_enddatetime"  "End Date/Time"
    str  "lum_location"     "Location"       200
    str  "lum_audienceroles" "Audience Roles" 500
)

# 10. lum_SafetyMetric
New-Table "lum_safetymetric" "Safety Metric" "Safety Metrics" "Daily safety KPI tracking" @(
    do_  "lum_date"           "Date"
    num  "lum_dayssinceinc"   "Days Since Incident"
    num  "lum_nearmisstotal"  "Near Miss Total"
    memo "lum_notes"          "Notes"
)

# 11. lum_SafetyIncident
New-Table "lum_safetyincident" "Safety Incident" "Safety Incidents" "Safety incident reports" @(
    dt   "lum_incidentdatetime" "Incident Date/Time"
    str  "lum_reportedby"    "Reported By"    200
    str  "lum_severity"      "Severity"       50
    memo "lum_description"   "Description"    4000
    bool_ "lum_isresolved"   "Is Resolved"
)

# 12. lum_KpiSnapshot
New-Table "lum_kpisnapshot" "KPI Snapshot" "KPI Snapshots" "Nightly precomputed KPIs — never query live on splash" @(
    do_  "lum_snapshotdate"  "Snapshot Date"
    dec  "lum_revenuemtd"    "Revenue MTD"
    num  "lum_jobsopen"      "Jobs Open"
    num  "lum_jobsclosed"    "Jobs Closed"
    num  "lum_crewheadcount" "Crew Headcount"
    num  "lum_dayssinceinc"  "Days Since Incident"
    str  "lum_weathersummary" "Weather Summary" 500
)

# 13. lum_CrewAssignment
New-Table "lum_crewassignment" "Crew Assignment" "Crew Assignments" "Crew member to job assignments" @(
    dt   "lum_assigneddate"  "Assigned Date"
    str  "lum_crewmember"    "Crew Member"    200
    str  "lum_truckid"       "Truck ID"       100
    str  "lum_role"          "Role"           100
)

# 14. lum_WeatherCache
New-Table "lum_weathercache" "Weather Cache" "Weather Cache" "Cached weather data refreshed every 15 minutes by flow" @(
    str  "lum_location"      "Location"       200
    dt   "lum_lastupdated"   "Last Updated"
    str  "lum_conditiontext" "Condition"      200
    dec  "lum_tempc"         "Temp (C)"
    dec  "lum_tempf"         "Temp (F)"
    num  "lum_humidity"      "Humidity %"
    str  "lum_iconurl"       "Icon URL"       500
)

# 15. lum_SystemConfig
New-Table "lum_systemconfig" "System Config" "System Configs" "Key-value config store for app settings" @(
    str  "lum_key"           "Key"            200 "ApplicationRequired"
    memo "lum_value"         "Value"          4000
    str  "lum_description"   "Description"    500
)

# 16. lum_PendingBCWrites
New-Table "lum_pendingbcwrites" "Pending BC Write" "Pending BC Writes" "Queued write operations to Business Central — processed when API access granted" @(
    str  "lum_entitytype"    "Entity Type"    100
    str  "lum_operation"     "Operation"      50
    memo "lum_payload"       "Payload JSON"   8000
    str  "lum_status"        "Status"         50
    dt   "lum_queueddate"    "Queued Date"
    dt   "lum_processeddate" "Processed Date"
    memo "lum_errormessage"  "Error Message"  2000
    num  "lum_retrycount"    "Retry Count"
)

# 17. lum_SyncLog
New-Table "lum_synclog" "Sync Log" "Sync Logs" "Audit log for Airtable and BC sync operations" @(
    str  "lum_synctype"      "Sync Type"      100
    dt   "lum_syncstart"     "Sync Start"
    dt   "lum_syncend"       "Sync End"
    num  "lum_recordssynced" "Records Synced"
    num  "lum_errorcount"    "Error Count"
    str  "lum_status"        "Status"         50
    memo "lum_details"       "Details"        4000
)

# 18. lum_Spotlight
New-Table "lum_spotlight" "Spotlight" "Spotlights" "Employee spotlight cards shown on home screen" @(
    str  "lum_employeename"  "Employee Name"  200
    str  "lum_jobtitle"      "Job Title"      100
    memo "lum_bio"           "Bio"            2000
    file_ "lum_headshot"     "Headshot"
    dt   "lum_featuredfrom"  "Featured From"
    dt   "lum_featuredto"    "Featured To"
    bool_ "lum_isactive"     "Is Active"
)

# 19. lum_Suggestion
New-Table "lum_suggestion" "Suggestion" "Suggestions" "Employee suggestion box submissions" @(
    memo "lum_body"          "Suggestion"     4000
    str  "lum_submittedby"   "Submitted By"   200
    dt   "lum_submitteddate" "Submitted Date"
    str  "lum_status"        "Status"         50
    bool_ "lum_isanonymous"  "Is Anonymous"
    memo "lum_adminresponse" "Admin Response" 2000
)

Write-Host "`n=== Done. Run 01-setup.ps1 if solution needs creating. ===" -ForegroundColor Cyan
Write-Host "Next step: security roles, BC virtual tables, AirtableMirror_Sync flow." -ForegroundColor Gray
