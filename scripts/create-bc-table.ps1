$ErrorActionPreference = 'Stop'

$orgUrl   = 'https://org8fa22efd.crm.dynamics.com'
$pac      = 'C:\Users\Alex\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd'
$apiBase  = "$orgUrl/api/data/v9.2"

# ── Get token via Azure CLI ──────────────────────────────────────────────────
Write-Host "Getting auth token..."
$tokenJson = az account get-access-token --resource $orgUrl --output json 2>&1
$token = ($tokenJson | ConvertFrom-Json).accessToken
if (-not $token) {
    Write-Error "Could not retrieve access token. Run 'az login --allow-no-subscriptions' first."
    exit 1
}
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type'  = 'application/json; charset=utf-8'
    'Accept'        = 'application/json'
    'OData-MaxVersion' = '4.0'
    'OData-Version'    = '4.0'
}

# ── Check if table already exists ────────────────────────────────────────────
Write-Host "Checking if lni_bcplanningline already exists..."
$entityId = $null
try {
    $check = Invoke-RestMethod -Uri "$apiBase/EntityDefinitions(LogicalName='lni_bcplanningline')" `
        -Headers $headers -Method GET -ErrorAction Stop
    $entityId = $check.MetadataId
    Write-Host "Table already exists (MetadataId: $entityId). Skipping entity creation, will add missing attributes."
} catch {
    Write-Host "Table does not exist — creating..."
}

# ── Create the entity via CreateEntity action ─────────────────────────────────
function Make-Label($text) {
    @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
       LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $text; LanguageCode = 1033 }) }
}

if (-not $entityId) {
    $createBody = @{
        '@odata.type'         = 'Microsoft.Dynamics.CRM.EntityMetadata'
        SchemaName            = 'lni_bcplanningline'
        DisplayName           = Make-Label 'LNI BC Planning Line'
        DisplayCollectionName = Make-Label 'LNI BC Planning Lines'
        Description           = Make-Label 'Business Central project planning line data synced via Power Automate'
        OwnershipType         = 'UserOwned'
        IsActivity            = $false
        HasActivities         = $false
        HasNotes              = $false
        Attributes            = @(
            @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
                IsPrimaryName = $true
                SchemaName    = 'lni_jobno'
                RequiredLevel = @{ Value = 'None' }
                MaxLength     = 100
                FormatName    = @{ Value = 'Text' }
                DisplayName   = Make-Label 'Job No'
                Description   = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @() }
            }
        )
    } | ConvertTo-Json -Depth 20

    Write-Host "Creating entity..."
    $createResp = Invoke-WebRequest -Uri "$apiBase/EntityDefinitions" `
        -Headers $headers -Method POST -Body $createBody -ContentType 'application/json'
    $entityUri = $createResp.Headers['OData-EntityId']
    if (-not $entityUri) { $entityUri = $createResp.Headers['Location'] }
    $entityId = ($entityUri -replace '.*EntityDefinitions\((.+)\).*', '$1').Trim("'")
    if (-not $entityId) {
        $fetched = Invoke-RestMethod -Uri "$apiBase/EntityDefinitions(LogicalName='lni_bcplanningline')" `
            -Headers $headers -Method GET
        $entityId = $fetched.MetadataId
    }
    Write-Host "Entity created. MetadataId: $entityId"
}

# ── Helper: add an attribute ─────────────────────────────────────────────────
function Add-Attr($odataType, $schema, $label, $extra = @{}) {
    $body = @{
        '@odata.type' = $odataType
        SchemaName    = $schema
        RequiredLevel = @{ Value = 'None' }
        DisplayName   = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
            LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $label; LanguageCode = 1033 }) }
        Description   = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @() }
    }
    foreach ($k in $extra.Keys) { $body[$k] = $extra[$k] }
    $json = $body | ConvertTo-Json -Depth 10
    try {
        Invoke-RestMethod -Uri "$apiBase/EntityDefinitions($entityId)/Attributes" `
            -Headers $headers -Method POST -Body $json -ErrorAction Stop | Out-Null
        Write-Host "  + $schema"
    } catch {
        if ($_ -match 'already exists' -or $_ -match '0x80044330' -or $_ -match 'duplicate') {
            Write-Host "  ~ $schema (already exists, skipping)"
        } else {
            Write-Warning "  ! $schema failed: $_"
        }
    }
}

Write-Host "Adding attributes..."

Add-Attr 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata' 'lni_sortorder' 'Sort Order' @{
    MinValue = -2147483648; MaxValue = 2147483647; Format = 'None'
}
Add-Attr 'Microsoft.Dynamics.CRM.StringAttributeMetadata' 'lni_stagename' 'Stage Name' @{
    MaxLength = 100; FormatName = @{ Value = 'Text' }
}
Add-Attr 'Microsoft.Dynamics.CRM.StringAttributeMetadata' 'lni_description' 'Description' @{
    MaxLength = 250; FormatName = @{ Value = 'Text' }
}
Add-Attr 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata' 'lni_started' 'Started' @{
    DefaultValue = $false
    OptionSet    = @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
        TrueOption    = @{ Value = 1; Label = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = 'Yes'; LanguageCode = 1033 }) } }
        FalseOption   = @{ Value = 0; Label = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = 'No'; LanguageCode = 1033 }) } }
    }
}
Add-Attr 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata' 'lni_completed' 'Completed' @{
    DefaultValue = $false
    OptionSet    = @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
        TrueOption    = @{ Value = 1; Label = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = 'Yes'; LanguageCode = 1033 }) } }
        FalseOption   = @{ Value = 0; Label = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = 'No'; LanguageCode = 1033 }) } }
    }
}
Add-Attr 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata' 'lni_startdate' 'Start Date' @{
    Format = 'DateOnly'; DateTimeBehavior = @{ Value = 'UserLocal' }
}
Add-Attr 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata' 'lni_enddate' 'End Date' @{
    Format = 'DateOnly'; DateTimeBehavior = @{ Value = 'UserLocal' }
}
Add-Attr 'Microsoft.Dynamics.CRM.StringAttributeMetadata' 'lni_assignedto' 'Assigned To' @{
    MaxLength = 50; FormatName = @{ Value = 'Text' }
}
Add-Attr 'Microsoft.Dynamics.CRM.StringAttributeMetadata' 'lni_assignedtoname' 'Assigned To Name' @{
    MaxLength = 100; FormatName = @{ Value = 'Text' }
}
Add-Attr 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata' 'lni_lastsynced' 'Last Synced' @{
    Format = 'DateAndTime'; DateTimeBehavior = @{ Value = 'UserLocal' }
}

Write-Host ""
Write-Host "Done. Table 'lni_bcplanningline' created with all columns."
Write-Host "It may take 1-2 minutes to appear in make.powerapps.com."
